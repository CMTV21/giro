# Giro roadmap & growth ideas

Giro's wedge is **curation first, booking second**. Most competitors start from inventory; Giro starts from the trip you'll actually have, and earns on every booking it routes.

## Shipped

- Curation engine over 26 hand-curated cities, plus any city via the generic planner or Giro AI
- CAD-first multi-currency pricing with Canadian partner storefronts
- Accounts with server-synced trips (Postgres)
- Group trips: invite links, roles, voting, shared expenses with minimal settle-up
- Discover: budget-first search across the catalog with distance-based fares from your home airport
- Today (Giro Live): now/next, forecast, rain plan, running-late re-plan
- Travel DNA taste profile that learns from behaviour and nudges curation
- Commission tracking: `/go` click logging, sub-IDs, projected revenue dashboard
- Catalog pipeline: AI draft → human review → promote, validated by schema tests
- Planner: flights and stays, clock-time schedules, drag-and-drop ideas, history and facts, day maps, printable guide, receipts
- Photos for stops and dishes (credited Commons images), Tripadvisor review links, and an Eat & drink guide for every catalog city

## Next: turn on revenue

1. **Join partner programs.** Booking.com, Expedia Group, GetYourGuide, Viator and Skyscanner (via Impact). Add the IDs to the environment; the dashboard flags missing ones.
2. **Replace illustrative rates** in `src/lib/affiliates.ts` with contracted terms, and import partner payout reports to compare projected and actual commission per sub-ID.
3. **Production database.** Point `DATABASE_URL` at managed Postgres (Neon or Supabase both have free tiers) and add daily backups.
4. **Tripadvisor affiliate.** Review links already route through `/go`; once approved, add the partner parameters in `src/lib/affiliates.ts` to earn on hotel clicks.
5. **Restaurant reservations.** OpenTable and TheFork run affiliate programs; a "Reserve" button on food-guide picks marked "Reserve ahead" is a natural next commission stream.

## Near term: retention

5. **Price-watch alerts.** "Tell me when Toronto to Lisbon drops under C$800." This needs a flight API (Duffel or Amadeus) and a scheduled job.
6. **Live prices in the Book tab.** Swap estimates for real fares and nightly rates where APIs allow.
7. **Group polish.** Real-time updates (server-sent events instead of 15-second polling), comments on stops, and "group picks" that rank stops by votes.
8. **Maps view** with drag-to-reorder and walking times between stops.

## Differentiators

9. **Points & miles mode.** Aeroplan and WestJet Rewards first, for the Canadian market: show when a fare is cheaper in points.
10. **Creator itineraries.** Travel creators publish Giro trips and earn a share of the booking commission, which brings content, SEO and distribution.
11. **Giro Plus subscription.** Unlimited Giro AI, price alerts, offline trip packs, Giro Live notifications.
12. **B2B / white-label.** The planning engine for travel agents, corporate offsites, wedding planners and tourism boards.

## Catalog targets

- 50 cities by drafting a few per day with `npm run catalog:draft` plus review, prioritising Canadian demand (Caribbean, Mexico, Europe, Japan).
- Add opening hours, seasonal closures and neighbourhood coordinates so clustering uses real distances.
