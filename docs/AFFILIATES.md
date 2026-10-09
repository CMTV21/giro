# Affiliate applications

Copy-ready answers for each program, plus what to wire up in Giro once you're approved. Program terms change often, and several of the details below come from third-party summaries. **Confirm commission, cookie window and payout terms on each program's own pages when you apply**, then replace the illustrative rates in `src/lib/affiliates.ts`.

## Before you apply (reviewers check these)

- [ ] girotrips.com is live on HTTPS, with `/privacy`, `/terms` and `/affiliate-disclosure` reachable from the footer
- [ ] `CONTACT_EMAIL` is set, so a real address appears on the legal pages. Use a domain address such as hello@ or partners@; free-mail addresses read as hobby sites.
- [ ] A sample trip looks good with photos (fixed in this release) and a working food guide
- [ ] Vercel Web Analytics is on, so you can quote real visitor numbers. Reviewers ask for them, and a number with a source beats an estimate.
- [ ] Business details are ready: legal name (or sole proprietorship), mailing address, GST/HST number if registered, and payout details (PayPal or a CAD/USD bank account)
- [ ] Apply to the programs with the lowest bar first (GetYourGuide, Viator, then Booking.com and Expedia). An approval or two, and some click history in `/admin/revenue`, make the stricter programs easier.

## Standard answers

**Website:** https://girotrips.com

**Site name:** Giro: trips, curated

**Category:** Travel planning / itinerary planner (tool, not a blog)

**Short description (≈50 words)**
> Giro is a Canadian trip-planning web app. Travellers enter where, when, who's going, what they love and their budget, and Giro builds a day-by-day itinerary with flights, stays, tours and restaurants, priced in Canadian dollars. Every booking step links to a partner site already filled in with the traveller's dates and party size.

**Long description (≈150 words)**
> Giro (girotrips.com) helps travellers, primarily Canadians, go from "we should go to Lisbon" to a bookable plan in under a minute. The planner turns a few inputs into a day-by-day itinerary clustered by neighbourhood, with clock times, day maps, history for each stop, a curated food guide and a budget in the traveller's currency. Group trips are built in: invite links, voting on stops and shared expenses with settle-up.
>
> Giro doesn't take bookings itself. At each step (flights, hotels, homes, tours, restaurants) it sends the traveller to a partner pre-filled with their destination, dates, party size and currency, on the partner's country storefront (for example expedia.ca). This puts partners in front of users with high purchase intent: someone who has already chosen a destination, set their dates and seen an itinerary. Affiliate relationships are disclosed on every page and at /affiliate-disclosure.

**How you'll promote (promotional methods)**
> Contextual deep links inside personalised itineraries (the main placement, at the moment of booking intent); SEO destination guides; organic social video (short itinerary breakdowns); email trip reminders to registered users. No paid search on partner brand terms, no coupon or incentive traffic, no pop-ups, no cookie stuffing. Links are only shown to users actively planning a matching trip.

**Audience**
> Primarily Canadian adults aged 25 to 55 planning leisure trips (couples, families and friend groups), with secondary audiences in the US, UK and Australia. Typical trips are 4 to 14 days in Europe, Mexico, the Caribbean, Japan and the US.

**Current traffic (be honest; reviewers check)**
> Giro launched on girotrips.com in October 2026. Current traffic is early-stage. Report the actual number from Vercel Analytics on the day you apply, e.g. "about 1,200 monthly visitors, growing".

**Traffic plan (12 months)**
> 1. **SEO destination guides:** public, indexable "X days in [city]" itineraries for every catalog city (26 now, 100 planned), targeting long-tail planning queries.
> 2. **Social video:** two to three short itinerary breakdowns a week on TikTok, Instagram Reels and YouTube Shorts, each linking to the full plan.
> 3. **Canadian travel communities:** genuinely helpful participation where self-promotion is allowed (RedFlagDeals travel forum, travel subreddits), plus Canadian travel newsletters.
> 4. **Built-in virality:** group trips need invite links, so every planner brings in co-travellers.
> 5. **Creator itineraries:** travel creators publish Giro trips and share in the commission.
>
> Targets: 5,000 monthly visitors by month 3, 25,000 by month 6, 100,000 by month 12.

(Label targets as targets. Don't present them as current traffic.)

## Program by program

### Booking.com: Affiliate Partner Programme
- **Apply:** Booking.com Affiliate Partner Centre ("Become an affiliate"). Some regions are routed through networks (Awin or CJ are commonly reported); follow whichever the sign-up flow shows for Canada.
- **They ask:** website, monthly visitors, traffic sources, countries, promotional methods.
- **Angle:** hotel links already carry checkin/checkout, group size and currency, which is a high-intent hand-off.
- **Wire up:** set `NEXT_PUBLIC_BOOKING_AID`. `label` already carries a per-click `giro-…` sub-ID for reconciliation.

### Expedia Group: Travel Creator Program (formerly the Affiliate Program)
- **Apply:** Expedia Group's Travel Creator / Affiliate Hub, administered by Partnerize (Performance Horizon). One account covers Expedia, Hotels.com and Vrbo.
- **They ask:** website or social profiles, audience, content strategy. Reviews reportedly take a few days.
- **Wire up:** `NEXT_PUBLIC_EXPEDIA_AFFCID` is in place. **Check the link format in the hub after approval:** Partnerize programs often use their own tracking links (a `camref`-style parameter) rather than `affcid`, which would need a small change in `src/lib/booking.ts`. Vrbo clicks become commissionable through the same account.

### GetYourGuide: Partner Program
- **Apply:** partner.getyourguide.com (direct, no network). Usually the quickest approval.
- **Reported terms:** about 8% commission, 30-day cookie, monthly payouts (verify).
- **Wire up:** `NEXT_PUBLIC_GETYOURGUIDE_PARTNER_ID`. `cmp` already carries the per-click sub-ID.

### Viator (a Tripadvisor company): Affiliate Program
- **Apply:** Viator Partner Program, the affiliate track, not the supplier track for tour operators.
- **Reported terms:** up to 8% commission (verify).
- **Wire up:** `NEXT_PUBLIC_VIATOR_PID`. Ask in the partner dashboard whether a sub-ID parameter (such as `mcid` or `subid`) is available, and add it as `subIdParam`.

### Tripadvisor: Affiliate Program
- **Apply:** tripadvisor.com/affiliates. The program runs through a network partner; that page names the current one. Sign up with that network, then apply to Tripadvisor inside it.
- **Important:** Tripadvisor typically pays on **hotel** booking referrals. Giro's current Tripadvisor links are *reviews and restaurant searches*, which likely earn nothing. Once approved, add Tripadvisor hotel links on the Book tab, and use the network's link generator for the review links, so these clicks can earn.
- **Wire up:** network-generated links rather than a single ID parameter. Add the network's redirect host to `AFFILIATES` (and `hostAllowed`) when you know it.

### Restaurant reservations: OpenTable *and* TheFork (not either/or)
They cover different countries, so a region-routed "Reserve" button wants both:

| | OpenTable (Booking Holdings) | TheFork (a Tripadvisor company) |
|---|---|---|
| Strongest in | Canada, US, UK, Mexico, Japan, Germany, Australia | France, Italy, Spain, Portugal, Belgium, Netherlands, Switzerland, Sweden, Australia |
| Giro catalog fit | North American and UK cities, Tokyo | Paris, Rome, Barcelona, Lisbon and most of Europe |
| How to apply | Affiliate link in the opentable.com footer; reportedly through a network (Impact or Rakuten), paying per seated diner (verify) | Per-country programs on networks (Awin for Italy; Kwanko/NetAffiliation for France). Some countries are closed, so check each. |

**Recommendation:** apply to OpenTable first (one program covers your home market), then TheFork for France, Italy and Spain. Ask the Tripadvisor network contact about TheFork, since it's a Tripadvisor company.

### Also worth applying (already wired)
- **Skyscanner** (via Impact): `NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID`; pays per click, which suits flight search.

## After each approval

1. Add the ID in Vercel → Environment Variables (Production *and* Preview), then redeploy. `NEXT_PUBLIC_*` values are baked in at build time.
2. Update the commission and conversion figures for that program in `src/lib/affiliates.ts` to the contracted terms.
3. Click a link from a real trip, confirm it lands with the ID attached, and check that the network dashboard records the click within 24 hours.
4. Monthly: compare network payouts with `/admin/revenue` projections by sub-ID.
