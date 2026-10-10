/** Types for tests; the worker itself is plain JavaScript so it can be pasted into Cloudflare. */
declare const worker: { email(message: unknown, env: { INBOUND_URL: string; INBOUND_SECRET?: string }): Promise<void> };
export default worker;
