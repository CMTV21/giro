import "server-only";
import { siteUrl } from "../lib/site.ts";

/**
 * Transactional email via Resend's REST API (no SDK needed).
 *
 * - RESEND_API_KEY: required to send. Without it, development logs emails to the console and
 *   production reports "not configured" so the UI can offer a copyable link instead.
 * - EMAIL_FROM: e.g. "Giro <hello@girotrips.com>" once your domain is verified in Resend.
 *   Resend's shared test sender only delivers to your own Resend account address.
 */

const FROM = () => process.env.EMAIL_FROM?.trim() || "Giro <onboarding@resend.dev>";

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim());

/** Absolute base URL for links in emails (see `siteUrl`). */
export const appUrl = siteUrl;

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface EmailResult {
  sent: boolean;
  reason?: "not_configured" | "dev_logged" | "provider_error";
}

/** Sent emails in tests/dev, newest last. */
export const outbox: { to: string; subject: string; text: string }[] = [];

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV === "production") return { sent: false, reason: "not_configured" };
    outbox.push({ to: msg.to, subject: msg.subject, text: msg.text });
    if (process.env.NODE_ENV !== "test") console.info(`\n[email to ${msg.to}] ${msg.subject}\n${msg.text}\n`);
    return { sent: false, reason: "dev_logged" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM(), to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("Resend error", res.status, await res.text().catch(() => ""));
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("Email send failed", err);
    return { sent: false, reason: "provider_error" };
  }
}

/** A simple, client-safe branded layout. All interpolated values must already be escaped. */
function layout(title: string, body: string, cta: { label: string; url: string }, footnote: string): string {
  return `<!doctype html><html><body style="margin:0;background:#faf9f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0b1220">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e8e5de;border-radius:16px">
<tr><td style="padding:28px 28px 8px;font-size:22px;font-weight:700;letter-spacing:-0.02em">giro</td></tr>
<tr><td style="padding:8px 28px 0;font-size:20px;font-weight:700">${title}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.6;color:#334155">${body}</td></tr>
<tr><td style="padding:24px 28px"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#ff5a36;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${cta.label}</a></td></tr>
<tr><td style="padding:0 28px 28px;font-size:12px;line-height:1.5;color:#64748b">${footnote}<br><br>If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(cta.url)}</span></td></tr>
</table></td></tr></table></body></html>`;
}

export function resetEmail(url: string) {
  return {
    subject: "Reset your Giro password",
    html: layout("Reset your password", "Someone (hopefully you) asked to reset the password for your Giro account. This link works once and expires in one hour.", { label: "Choose a new password", url }, "If you didn't ask for this, ignore this email; your password won't change."),
    text: `Reset your Giro password (link works once, expires in 1 hour):\n${url}\n\nIf you didn't ask for this, ignore this email.`,
  };
}

export function verifyEmail(url: string, name: string) {
  return {
    subject: "Confirm your email for Giro",
    html: layout(`Welcome, ${escapeHtml(name)}`, "Confirm your email so we can send you trip invites, price alerts and account notices.", { label: "Confirm my email", url }, "This link expires in 7 days."),
    text: `Welcome to Giro, ${name}! Confirm your email:\n${url}`,
  };
}

export function inviteEmail(url: string, inviter: string, tripTitle: string, role: "editor" | "viewer") {
  const can = role === "editor" ? "help plan" : "vote on plans and split costs";
  return {
    subject: `${inviter} invited you to “${tripTitle}” on Giro`,
    html: layout(`You're invited: ${escapeHtml(tripTitle)}`, `${escapeHtml(inviter)} wants you to ${can} for this trip on Giro.`, { label: "Join the trip", url }, "The invite link expires in 14 days. You'll need a free Giro account to join."),
    text: `${inviter} invited you to "${tripTitle}" on Giro, to ${can}.\nJoin: ${url}\n(Link expires in 14 days.)`,
  };
}
