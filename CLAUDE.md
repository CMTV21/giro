@AGENTS.md

# Giro — project brief for Claude sessions

Giro (girotrips.com) is a Canadian AI trip planner: day-by-day itineraries, multi-city, CAD by default,
affiliate booking links, group trips (voting, shared expenses), public SEO trip guides. Pre-launch.
Owner: GitHub cmtv21. Read README.md for the feature table and every environment variable.

## Working rules (from the owner)
- Never ask for secrets in chat; they go in Vercel environment variables, set by the owner.
- Ask before any change to Vercel, DNS, Cloudflare or other live settings.
- Build on the branch, run tests and the build, then fast-forward `main` when ready
  (`git push origin HEAD:main` after `git merge-base --is-ancestor origin/main HEAD`). Vercel deploys `main`.
- Correct over fast. Professional tone. Bring creative growth ideas.
- Be credit-efficient: run the relevant test file for small changes, the full suite + build before merging;
  browser checks only for UI changes; prefer Sonnet-model subagents, at most two in parallel.

## Stack
- Next.js 16 App Router (breaking changes vs. older Next; check `node_modules/next/dist/docs/`), React, Tailwind.
- Postgres: Neon in production (`DATABASE_URL`), embedded PGlite locally/tests. Migrations are append-only
  arrays in `src/server/schema.ts` (never edit a shipped entry; 10 so far) and run on first DB use.
- Claude via `@anthropic-ai/sdk` (`src/lib/ai.ts` model id; curation, confirmation/receipt reading, facts).
- Hosting: Vercel (project `prj_K4sl9VGZvwDyr5klNATEYbgf8SCV`, team `team_uRWXWdqI0yAaAJkILwkka6uS`, Hobby plan,
  runtime logs kept 1 hour). Domain/email: Cloudflare (Email Routing to Gmail; Resend for sending).
- Map tiles: Stadia (domain auth). Rates: ECB via Frankfurter.

## Commands
- `npm test` (node:test, ~150 tests, PGlite in memory) · `npx tsc --noEmit -p .` · `npm run build`
- Single file: `NODE_ENV=test PGLITE_DIR=memory:// node --conditions=react-server --experimental-strip-types --test tests/<file>.test.ts`
- Local server for browser checks: `PGLITE_DIR=<scratch dir> npx next start -p 3101` (the default `.data/` may not exist).
  Playwright: `/opt/node-tools/node_modules/playwright` with executable
  `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`. Local trips live in localStorage `giro.trips.v1`.
- Cloud sandbox blocks most external APIs; verify third-party integrations through production after deploy.

## Map of the code
- Engine: `src/lib/curate.ts` (curateTrip, budget, recalcBudget), `schedule.ts` (clock times, travelMinutes),
  `plan-edit.ts`, `board.ts` (placeAtTime), `reschedule.ts`, `bookings.ts` (mergeBooking), `trip-schema.ts` (zod),
  `types.ts`, catalog `destinations.ts` (26 cities), `src/data/` (food, heads-up).
- Server: `src/server/*` (auth, trips, links, inbound email, hours, routing, tours, fares, events, flight-status,
  advisories, geo, cache). API routes in `src/app/api/*`; calendar feed `src/app/cal/[file]`.
- UI: `src/components/trip/*` (TripView, ItineraryBoard, BoardView, DayPlan, ActivityCard, BookPanel, FareCard,
  BookingsPanel, ForwardInbox, LivePanel, FlightStatusCard, EventsCard, AdvisoryNotice, CalendarDialog…).
- Guides: `src/app/guides/`, `src/lib/guides.ts`. Email worker: `workers/inbound-email/`.

## Status (Oct 2026)
- Live: everything in README, incl. board view, guides, calendar feeds, GoC advisories, Omio/Airalo/OpenTable links.
- Built but OFF until the owner sets keys: INBOUND_SECRET/INBOUND_ADDRESS (+ Cloudflare worker setup),
  GOOGLE_PLACES_API_KEY, STADIA_API_KEY, VIATOR_API_KEY, TRAVELPAYOUTS_TOKEN/_MARKER, TICKETMASTER_API_KEY,
  AERODATABOX_API_KEY. After each key is added: redeploy and verify real responses (Viator, Travelpayouts and
  AeroDataBox field names were built from partial docs).
- Not built: GetYourGuide API (needs approval), live hotel rates (Booking/Expedia approval), insurance links (legal).
- Open items: lawyer review, CIPO trademark check, Quebec Law 25 readiness, Neon storage limits for receipts,
  traveller tips / "Publish your trip". Google Places is capped monthly (`GOOGLE_PLACES_MONTHLY_CAP`, default 900).
- Strategy: market research in the owner's reports (AI trip planner competitive landscape). Positioning: group
  trips abroad for Canadians; per-trip "Group Trip Pass" pricing idea. 90-day plan with go/no-go metrics:
  `docs/LAUNCH-90-DAY.md` (week-0 gaps: anonymous trip_planned counter, pass_events table).
