# Giro — trips, curated

Giro turns a few details (where, when, who, what you love, budget) into a day-by-day itinerary. It then hands you off to Google Flights, Expedia, Skyscanner, Kayak, Airbnb, Booking.com, Vrbo, GetYourGuide and Viator, pre-filled with your dates and party size.

It's inspired by planners like TripHobo, and built around two layers:

| Simple (default) | Advanced (one click away) |
|---|---|
| Five questions → a full trip in under a second | Multi-city routing (up to 6 cities) with transfer days and open-jaw flights |
| Days clustered by neighbourhood | Pace, stay style, total budget, must-sees, things to skip, free-text notes |
| One-tap booking links for flights, stays, tickets and cars | Swap, reorder, remove or add stops; the budget recalculates as you edit |
| Budget estimate and packing list | Calendar export (.ics), print/PDF, copy as text, share link |
| | **Giro AI**: Claude researches any destination and hand-picks real places |

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine, booking-link, export and AI-merge tests
npm run typecheck
npm run build && npm start
```

Copy `.env.example` to `.env.local` to configure the optional features:

- `ANTHROPIC_API_KEY` turns on **Giro AI**, which curates with Claude (`claude-opus-5-5`, structured JSON output, server-side refusal fallback). Without a key, the app uses the built-in engine and the AI toggle shows as unavailable.
- `NEXT_PUBLIC_*` affiliate IDs are appended to outbound partner links once you join each program.

## How it works

```
src/
  app/                    Next.js 16 App Router pages
    page.tsx              landing page (renders a real sample day from the engine)
    plan/                 planner (Simple / Advanced)
    trip/[id]/            itinerary · book · budget · packing & tips
    trips/  explore/      saved trips, destination inspiration
    shared/               opens a trip from a share link
    api/curate/           POST → Claude curation (validated, rate-limited)
  lib/
    curate.ts             built-in curation engine (deterministic, offline, instant)
    destinations.ts       curated catalog: 14 cities, 160+ real experiences, areas, costs
    booking.ts            partner deep-link builders (+ affiliate IDs)
    ai.ts                 Claude integration, merged onto the engine's date skeleton
    export.ts             .ics calendar, text export, compressed share links
    storage.ts            browser persistence (swap for an API when accounts land)
  components/             UI (Tailwind v4, lucide icons)
tests/                    node:test suites
```

**Curation engine.** It splits nights across cities, builds arrival, transfer and departure days, and sets the number of slots by pace. It scores each experience on interest overlap, family fit, budget tier, must-sees and avoids, then places stops near the day's anchor to cut transit. Full-day excursions are limited to one per three days. Cities outside the catalog get a sensible framework; Giro AI fills those with real places.

**Giro AI.** The server asks Claude for a schema-constrained plan, then merges it onto the engine's skeleton. Dates, legs and day count therefore always stay valid, and any day Claude misses falls back to the engine. If the AI is unavailable, busy, or refuses a request, the client silently uses the engine and shows a short notice.

## About the "integrations"

Today the integrations are **deep links**: search URLs pre-filled with destination, dates, travellers and a price filter, which open on the partner's site. That's how most planners start, and it needs no partnership approval. Moving to in-app search and booking means joining partner programs one provider at a time. Each provider is isolated in `src/lib/booking.ts`, so these are drop-in replacements:

| Need | Realistic route |
|---|---|
| Live flight prices | Google Flights has no public API. Use Duffel, Amadeus Self-Service, Kiwi.com Tequila or the Skyscanner partner API. |
| Hotels | Booking.com Affiliate Partner Program / Demand API; Expedia Group Rapid API |
| Homes | Airbnb doesn't offer a public booking API. Keep deep links, or add Vrbo through Expedia Group. |
| Tickets & tours | GetYourGuide and Viator partner APIs (both offer affiliate commissions) |

Trips are stored in the browser (`localStorage`). Share links carry the whole trip, compressed, in the URL fragment, which is never sent to a server. The decoder treats the payload as untrusted input.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for product and business directions.
