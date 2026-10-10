# Giro — trips, curated

Giro turns a few details (where, when, who, what you love, budget) into a day-by-day itinerary. It then hands travellers off to Google Flights, Expedia, Skyscanner, Kayak, Airbnb, Booking.com, Vrbo, GetYourGuide and Viator, pre-filled with their dates, party size and currency. Every partner click is tracked for commission.

| Simple (default) | Advanced and beyond |
|---|---|
| Five questions → a full trip in under a second | Multi-city routing (up to 6 cities), open-jaw flights, transfer days |
| Prices in **CAD by default**, plus 9 other currencies | Pace, stay style, total budget, must-sees, things to skip |
| Days clustered by neighbourhood | Swap, reorder, remove or add stops; budget recalculates live |
| One-tap booking on Canadian storefronts (expedia.ca, airbnb.ca…) | **Accounts**: trips on every device; browser trips move in on sign-in |
| Budget estimate, packing list, tips | **Group trips**: invite links, roles, voting, shared expenses with settle-up |
| | **Discover**: "Where can we go for C$4,000?" across the whole catalog |
| | **Today (Giro Live)**: now/next, forecast, rain plan, running-late re-plan |
| | **Travel DNA**: learns from swaps, removals, bookings and votes |
| | **Giro AI**: Claude researches any destination and hand-picks real places |
| | **Partner revenue dashboard**: clicks, trip value and projected commission |
| | **Flights & stays**: add booked flights and hotels (or import from a confirmation photo/PDF); days re-time around landings and departures |
| | **Real clock times**: travel buffers, lunch and dinner, pinned start times, and an hour-by-hour timeline view |
| | **Ideas**: drag attractions into any day; removed or displaced stops wait here instead of disappearing |
| | **History & facts** for each stop (Wikipedia, attributed), **day maps**, and a **printable sightseeing guide** |
| | **Receipts** on shared expenses, read by Claude to fill in the amount and currency |
| | **Photos** of stops, ideas and dishes (freely licensed Wikimedia Commons images, photographer credited) and **Tripadvisor reviews** links |
| | **Your way**: children's ages (fares and picks fit them), access needs (less walking, step-free, stroller), edit any stop's time, length, cost and notes, change dates or length in place, start from scratch, "never suggest this again" |
| | **Notes & packing**: trip notepad and stop notes shared with the group, your own packing items, and a heads-up on scams, pickpockets and local rules per city |
| | **Community picks**: "Loved by N travellers" once at least 3 travellers book, pick or vote for a stop |
| | **Eat & drink**: must-try dishes and hand-picked restaurants for all 26 catalog cities (Giro AI writes one for other cities), with live Tripadvisor rankings and one-tap "add to a day" at the right meal |
| | **Trip guides** (`/guides`): public, indexable 3-, 5- and 7-day itineraries for every catalog city (a length is published only when every day is full), with where to stay, what to eat, a daily budget and "Make this trip mine" |

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000. Data is stored in an embedded Postgres under .data/
npm test           # ~100 tests: engine, currency, catalog, auth, groups, split, clicks, live, discover, editing, access, community
npm run typecheck
npm run build && npm start
```

Configuration lives in `.env.local` (see `.env.example`). Everything is optional for local development:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Turns on Giro AI (`claude-opus-5-5`, structured output, server-side refusal fallback). |
| `DATABASE_URL` | Postgres for production (Neon, Supabase, RDS, Railway…). Without it, PGlite (embedded Postgres) persists to `.data/`. **Serverless hosts need `DATABASE_URL`.** |
| `ADMIN_EMAILS` | Comma-separated emails allowed to see `/admin/revenue`. |
| `NEXT_PUBLIC_*` partner IDs | Appended to outbound links once you're accepted into each affiliate program. |
| `OPEN_METEO_API_KEY` | Commercial weather API for Giro Live (Open-Meteo is free for non-commercial use only). |
| `RESEND_API_KEY` | Sends password-reset, email-confirmation and invite emails via Resend. Without it, development prints emails to the console and production offers copyable invite links. |
| `EMAIL_FROM` | Sender address once your domain is verified in Resend, e.g. `Giro <hello@yourdomain.com>`. |
| `APP_URL` | Public address used in email links. Defaults to the Vercel production URL; it is never taken from request headers. |
| `NEXT_PUBLIC_MAP_TILE_URL` / `NEXT_PUBLIC_MAP_ATTRIBUTION` | Map tiles for day maps and guides. Defaults to OpenStreetMap's public tiles, which are fine for light use; switch to a provider such as MapTiler or Stadia (free tiers) before heavy traffic. |
| `CONTACT_EMAIL` | Privacy and legal contact shown on `/privacy`, `/terms` and `/affiliate-disclosure` (redeploy after changing). |

## Growing the city catalog

There are 26 hand-curated cities (300+ experiences), plus a fallback that plans any city on earth. There are three ways to grow:

1. **Hand-curate.** Add entries to `src/lib/destinations-more.ts`. `npm test` validates every entry against `src/lib/catalog-schema.ts`, checking prices, duplicates, evening and kid coverage, and coordinates.
2. **AI-drafted, human-reviewed (recommended for scale).**
   ```bash
   ANTHROPIC_API_KEY=… npm run catalog:draft -- "Porto"     # writes catalog-drafts/porto.json
   # review every place, price and coordinate, then:
   npm run catalog:promote -- porto                          # validates and adds to the live catalog
   ```
   With a reviewer approving a few cities a day, the catalog can reach the top 100 destinations in weeks.
3. **Giro AI on demand.** Any city outside the catalog is fully researched by Claude when Giro AI is on.

## How it works

```
src/
  app/                  pages and API routes (Next.js 16 App Router)
    plan/ trip/[id]/    planner; trip view (itinerary · today · book · budget · group · packing)
    discover/ explore/  budget-first search; inspiration
    login/ signup/ account/ join/[token]/
    admin/revenue/      partner clicks and projected commission (ADMIN_EMAILS only)
    go/                 outbound partner redirect + click logging (allow-listed hosts only)
    api/                auth, me, trips, invites, votes, expenses, curate (AI), rates, weather
  lib/                  shared logic (pure, tested)
    curate.ts           curation engine; taste-aware scoring; distance-based fares
    destinations*.ts    catalog · catalog-schema.ts validation
    currency.ts         10 currencies, CAD default, ECB rates via Frankfurter with offline fallback
    booking.ts          partner deep links (country storefronts by currency) · affiliates.ts programs
    discover.ts live.ts weather.ts taste.ts split.ts trip-schema.ts
  server/               server-only: db (Postgres/PGlite + migrations), auth, users, trips, clicks
scripts/                catalog draft/promote pipeline
tests/                  node:test suites (server tests run against in-memory Postgres)
```

**Planner internals.** `lib/schedule.ts` turns each day into clock times and re-fits trips around flights (`fitToFlights`). `lib/plan-edit.ts` holds the drag-and-drop operations, `lib/ideas.ts` the per-city suggestions, `server/places.ts` the Wikipedia/OpenStreetMap lookups (cached in Postgres; photos only from Wikimedia Commons with author and licence, and "did you know" facts generated only when the history panel or guide asks), `src/data/food.ts` the curated food guide, `server/extract.ts` the Claude readers for confirmations and receipts, and `server/receipts.ts` receipt storage. Receipts are identified by their bytes, served only to trip members with `nosniff` and a sandboxing CSP, and capped at 4 MB. Phone photos are shrunk in the browser first.

**Legal pages.** `/privacy` (written to PIPEDA principles), `/terms` and `/affiliate-disclosure` describe what Giro actually collects and does. They're a strong starting point, but have a Canadian lawyer review them before public launch.

**Security notes.** Passwords use scrypt with per-user salts. Sessions are random tokens stored only as SHA-256 hashes, in `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production). Every state-changing request must be same-origin, which defends against CSRF. Sign-in, sign-up, password reset and invite emails are rate-limited in the database. Reset and confirmation links are single-use, stored hashed, and expire after 1 hour and 7 days respectively. Resetting a password signs out every session. The reset form never reveals whether an email has an account. Trip documents are schema-validated and size-capped on every write. Shared trips use optimistic concurrency, so concurrent edits are reported rather than lost. `/go` redirects only to allow-listed partner hosts over HTTPS. Share links and imports are treated as untrusted input.

## About the integrations

Booking happens through **deep links**: public search URLs that open on the partner's site already filled in. Moving to in-app search and booking means joining partner APIs one at a time:

| Need | Realistic route |
|---|---|
| Live flight prices | Google Flights has no public API. Use Duffel, Amadeus Self-Service, Kiwi.com Tequila or the Skyscanner partner API. |
| Hotels | Booking.com Affiliate Partner Programme / Demand API; Expedia Group Rapid API |
| Homes | Airbnb doesn't offer a public booking API or affiliate program. Keep deep links, or add Vrbo through Expedia Group. |
| Tickets & tours | GetYourGuide and Viator partner programs (commission-based) |

### Commissions

Every partner link goes through `/go`, which records the click, the estimated trip value behind it and the projected commission. Booking.com (`label`) and GetYourGuide (`cmp`) clicks carry a per-click `giro-…` sub-ID, so payouts can be reconciled to individual clicks. Commission and conversion rates in `src/lib/affiliates.ts` are **illustrative defaults**. Replace them with your contracted terms, and confirm each program's parameter names in its partner dashboard when you activate it.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's next.
