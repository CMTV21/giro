# Inbound email worker

Lets travellers forward booking confirmations to `trips+<token>@girotrips.com`. Giro reads them
and adds the flights and stays to the right trip.

## One-time setup

1. **Make a shared secret** on your own computer (never paste it into chat):
   `openssl rand -hex 32`
2. **Vercel** → Project → Settings → Environment Variables (Production):
   - `INBOUND_SECRET` = the secret
   - `INBOUND_ADDRESS` = `trips@girotrips.com`
   Then redeploy.
3. **Cloudflare** → Workers & Pages → Create → Worker. Name it `giro-inbound`, paste `worker.js`, deploy.
   In the worker's Settings → Variables and Secrets add:
   - `INBOUND_URL` (text) = `https://girotrips.com/api/inbound`
   - `INBOUND_SECRET` (secret) = the same secret
4. **Cloudflare** → girotrips.com → Email → Email Routing:
   - Settings: turn on **Subaddressing** (so `trips+anything@` reaches the `trips@` rule).
   - Routing rules → Create: custom address `trips@girotrips.com`, action **Send to a Worker**, worker `giro-inbound`.

Mail to `trips+<token>@` from a trip member (owner or editor, by their Giro account email) is
added straight away and they get a short confirmation email. Mail from anyone else waits in the
trip for a member to add or dismiss.
