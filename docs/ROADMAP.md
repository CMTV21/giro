# Giro roadmap & growth ideas

Giro's wedge is **curation first, booking second**. Most competitors start from inventory (here are 4,000 hotels); Giro starts from the trip you'll actually have, and earns on every booking it routes. The ideas below build on that.

## Near term: make the core loop sticky

1. **Accounts and cloud sync.** Replace `src/lib/storage.ts` with an API so trips follow you across devices. This unlocks everything below.
2. **Live prices in the Book tab.** Integrate one flight API (Duffel or Amadeus) and Booking.com's Demand API so the budget uses real fares and rates instead of estimates.
3. **Price-watch alerts.** "Tell me when flights to Lisbon drop under $600." This is a high-intent return trigger and a natural reason to collect email.
4. **Maps view.** Plot each day's stops on a map, with drag-to-reorder and a "nearby" panel for swaps.

## Differentiators: things TripHobo-style planners don't do well

5. **Group trips that actually decide.** Share a draft with friends; everyone votes on stops, the itinerary resolves conflicts, and a built-in cost-split ledger (Splitwise-style) tracks who paid for what. Group trips mean larger baskets and viral invites.
6. **"Where can I go for $2,000 in March?"** Reverse search: start from a budget, dates and interests, and get ranked destinations with full plans. The Explore page's scoring (`inspire()` in `curate.ts`) is the seed of this.
7. **Giro Live, a day-of companion.** On the day, re-plan around reality: rain moves the indoor museum up, a late start shifts the afternoon, a sold-out ticket triggers a swap. This needs weather and opening-hours data plus Giro AI.
8. **Trip DNA.** Learn from swaps, removals and bookings ("you always cut museums after 3pm", "you love food markets") so each new trip starts better. Over time this becomes the moat.
9. **Points & miles mode.** Show when a fare is cheaper in points and which card or loyalty program to use. Travel-hacking audiences are vocal and loyal.

## Revenue

| Stream | Notes |
|---|---|
| Affiliate commissions | Booking.com, Expedia Group, GetYourGuide, Viator, Skyscanner and Kayak all run partner programs. IDs are already wired in via `NEXT_PUBLIC_*` env vars. |
| **Giro Plus** subscription | Unlimited Giro AI, price alerts, offline trip packs, group voting, Giro Live. |
| Creator itineraries | Travel creators publish Giro trips and earn a share of booking commissions. This brings a content and SEO engine plus distribution. |
| B2B / white-label | Planning engine for travel agents, corporate offsites, wedding planners and tourism boards. The engine and catalog are already headless. |
| Sponsored experiences | Clearly labelled, opt-in placements from tour operators. Never inside the curated plan itself. |

## Content & catalog

- Grow the catalog from 14 cities toward the top 100 destinations, using Giro AI to draft entries and human editors to verify them.
- Add opening hours, seasonal closures and neighbourhood coordinates so clustering uses real distances.
- Localise currency (the engine currently estimates in USD).
