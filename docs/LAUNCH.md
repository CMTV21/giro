# girotrips.com launch runbook

The order matters. Each step lists who does it and how to confirm it worked. Secrets never go in chat or in this repo; they go in Vercel → giro → Settings → Environment Variables.

## 1. Point the domain at Vercel (Cloudflare)

`girotrips.com` and `www.girotrips.com` are already on the Vercel project `giro`. `www` permanently redirects (308) to the apex. Both are verified, so Vercel needs no TXT ownership record.

In Cloudflare → girotrips.com → DNS → Records, add the following. Set every record to **DNS only (grey cloud)**. A proxied (orange) record breaks Vercel's certificate issuance and doubles up the CDN.

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| A | `@` | `216.198.79.1` | DNS only | Auto |
| A | `@` | `64.29.17.1` | DNS only | Auto |
| CNAME | `www` | `c1a9216659ce925e.vercel-dns-017.com` | DNS only | Auto |

Delete any other A, AAAA or CNAME records on `@` or `www` (Cloudflare sometimes adds parking records). Also check SSL/TLS → Overview: with grey-cloud records the mode doesn't matter. If you ever switch to orange, it must be **Full (strict)**.

**Done when:** Vercel → giro → Settings → Domains shows both names as *Valid Configuration* with a certificate.

## 2. Make `main` the production branch (Vercel)

Today Vercel builds production from `claude/great-keller-bpyxa1`, and pushes to `main` only create previews. Go to Vercel → giro → Settings → Environments → Production → Branch Tracking, and set the branch to **`main`**.

**Done when:** the next push to `main` shows *Production* in Vercel → Deployments.

## 3. Verify girotrips.com in Resend

1. Resend → Domains → Add Domain → `girotrips.com`, region **North Virginia (us-east-1)**. That's next to Vercel's `iad1` functions and the Neon database.
2. Resend shows three or four records. Add each in Cloudflare exactly as shown, all **DNS only**:
   - **MX** on `send` → `feedback-smtp.us-east-1.amazonses.com`, priority 10 (bounce handling)
   - **TXT** on `send` → `v=spf1 include:amazonses.com ~all`
   - **TXT** on `resend._domainkey` → the long DKIM key (`p=MIGf…`). Copy it from Resend; it's unique to your account.
   - Optional but recommended: **TXT** on `_dmarc` → `v=DMARC1; p=none; rua=mailto:hello@girotrips.com`. Tighten to `p=quarantine` after a few clean weeks.
3. Click **Verify DNS records** in Resend. It usually turns green within minutes.

These records live on the `send` and `resend._domainkey` subdomains, so they **don't conflict** with Cloudflare Email Routing, which uses the apex MX and SPF (step 5).

**Done when:** Resend shows the domain as *Verified*. Don't set `EMAIL_FROM` before then. Resend rejects mail from an unverified domain, which would break password resets.

## 4. Production environment variables, then redeploy

| Key | Value | Environments | Type |
|---|---|---|---|
| `APP_URL` | `https://girotrips.com` | Production | Plain |
| `EMAIL_FROM` | `Giro <hello@girotrips.com>` | Production | Plain |
| `CONTACT_EMAIL` | the address shown on `/privacy`, `/terms` and `/affiliate-disclosure` | Production | Plain |

`robots.txt`, `sitemap.xml` and the share-card URLs are generated at **build** time, so a redeploy is required after changing these.

## 5. hello@girotrips.com → your inbox (Cloudflare Email Routing)

1. Cloudflare → girotrips.com → Email → Email Routing → Get started / Enable.
2. Let Cloudflare add its records: three **MX** on `@` (`route1/2/3.mx.cloudflare.net`) and a **TXT** on `@` (`v=spf1 include:_spf.mx.cloudflare.net ~all`). If an SPF TXT already exists on `@`, merge them rather than adding a second one; two SPF records is an error.
3. Destination addresses → add your personal inbox and click the link in the confirmation email Cloudflare sends.
4. Routing rules → Custom address `hello@girotrips.com` → Send to → your inbox. Consider adding `privacy@` and `partners@` the same way; affiliate networks like seeing a role address.
5. Optional: a **catch-all** rule forwarding to your inbox, so typos still arrive.

**Done when:** an email from a different account to hello@girotrips.com arrives in your inbox (check spam the first time).

> Replying *as* hello@girotrips.com from Gmail needs an SMTP server. Resend's SMTP (`smtp.resend.com`, port 465, username `resend`, password = a Resend API key with *sending* access only) works in Gmail → Settings → Accounts → "Send mail as".

## 6. Live checks on girotrips.com

- `https://girotrips.com/robots.txt` lists `Sitemap: https://girotrips.com/sitemap.xml`
- `https://girotrips.com/sitemap.xml` lists only `https://girotrips.com/…` URLs
- The share preview: paste the URL into a Slack or iMessage draft, or open `https://girotrips.com/opengraph-image`
- `https://www.girotrips.com` redirects to `https://girotrips.com`
- Forgot password and sign-up confirmation emails arrive *from Giro <hello@girotrips.com>*, and their links point at girotrips.com
- A Lisbon or Paris trip shows photos with credits, History & facts and day maps
- The Eat & drink tab's Reviews and "Add to…" work
- Import from confirmation and Read receipt fill in their forms

## 7. Google Search Console

1. search.google.com/search-console → Add property → **Domain** → `girotrips.com`.
2. Google shows a TXT value `google-site-verification=…`. Add it in Cloudflare as **TXT** on `@` (DNS only), then click Verify. A Domain property covers both `www` and the apex, and http and https.
3. Sitemaps → enter `sitemap.xml` → Submit. The status should read *Success*, with 8 discovered URLs.
4. URL Inspection → `https://girotrips.com/` → Request indexing, to get the homepage crawled sooner.
5. Optional: Bing Webmaster Tools → Import from Google Search Console. That also covers Bing, DuckDuckGo and ChatGPT search.
