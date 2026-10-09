/**
 * The site's public base URL: APP_URL when set (e.g. https://girotrips.com), else Vercel's
 * production domain, else localhost. Never derived from a request's Host header, which an
 * attacker can spoof (e.g. to poison password-reset links).
 */
export function siteUrl(): string {
  const explicit = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
