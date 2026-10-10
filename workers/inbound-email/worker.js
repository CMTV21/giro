/**
 * Giro inbound email worker (Cloudflare Email Routing → Email Worker).
 *
 * Receives mail for trips+<token>@your-domain, signs the raw message with INBOUND_SECRET and posts
 * it to Giro's /api/inbound. No dependencies, so it can be pasted into the Cloudflare dashboard.
 *
 * Settings (Worker → Settings → Variables and Secrets):
 *   INBOUND_URL     plain text, e.g. https://girotrips.com/api/inbound
 *   INBOUND_SECRET  secret, the same value as INBOUND_SECRET in Vercel
 */

const MAX_BYTES = 4_300_000; // Giro's host accepts request bodies up to 4.5 MB

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export default {
  async email(message, env) {
    const to = String(message.to).trim().toLowerCase();
    const from = String(message.from).trim().toLowerCase();
    if (!/\+[0-9a-f]{32}@/.test(to)) return message.setReject("Unknown address.");
    if (message.rawSize > MAX_BYTES) return message.setReject("This email is too large for Giro. Upload the confirmation in your trip instead.");

    const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const prefix = new TextEncoder().encode(`${timestamp}.${to}.${from}.`);
    const signed = new Uint8Array(prefix.length + raw.length);
    signed.set(prefix);
    signed.set(raw, prefix.length);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.INBOUND_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = hex(await crypto.subtle.sign("HMAC", key, signed));

    const res = await fetch(env.INBOUND_URL, {
      method: "POST",
      headers: { "content-type": "message/rfc822", "x-giro-timestamp": timestamp, "x-giro-to": to, "x-giro-from": from, "x-giro-signature": signature },
      body: raw,
    });
    if (res.status === 404) return message.setReject("This trip address isn't active. Check the address shown in your Giro trip.");
    if (res.status === 429) return message.setReject("Too many emails for this trip today. Please try again tomorrow.");
    if (res.status === 413) return message.setReject("This email is too large for Giro. Upload the confirmation in your trip instead.");
    // Anything else unexpected: fail so Cloudflare reports it, rather than dropping mail silently.
    if (!res.ok) throw new Error(`Giro answered ${res.status}`);
  },
};
