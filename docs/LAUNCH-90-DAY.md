# Giro: 90-day launch experiment

**Bet:** Canadians who organize a trip abroad with friends or family will plan it in Giro, bring the group in, book through our links, and pay a small per-trip fee for the group tools.
**Window:** 13 weeks from public launch (Day 0). Decision meeting in week 13. Solo planning stays free throughout.

## The offer: Group Trip Pass

- **One payment per trip, paid by the organizer.** No subscription. Test **C$24**, then **C$19 vs C$29** (a split by week) from week 9.
- **Free:** plan a trip, share a read-only link, invite up to 3 people, all booking links.
- **Pass unlocks:** unlimited travellers, voting, shared expenses with settle-up, forward-to-trip booking emails and receipts, calendar feed, offline trip pack.
- **Week 1–8:** an honest "coming soon" test. A **Get the Pass** button explains the price and takes a waitlist sign-up ("we'll email you when it's ready; nothing is charged"). **Week 9 on:** real payments (Stripe Payment Link), *only after* the lawyer review, refund terms and Law 25 items below are done.

## Go / no-go metrics

Counted over the 90 days, from the production database (queries below). "Group trip" = a saved trip with at least 2 members.

| Metric | Definition | Go | Iterate | Stop |
|---|---|---|---|---|
| Trips planned | Saved trips created | ≥ 1,000 | 300–999 | < 300 |
| Invite rate | Saved trips with ≥ 1 invite sent | ≥ 25% | 10–24% | < 10% |
| Invite acceptance | Invites that became a member | ≥ 40% | 20–39% | < 20% |
| Booking click-through | Saved trips with ≥ 1 partner click | ≥ 20% | 8–19% | < 8% |
| Pass intent (wk 1–8) | Pass waitlist sign-ups ÷ group trips | ≥ 10% | 4–9% | < 4% |
| Passes sold (wk 9–13) | Paid passes | ≥ 30 | 10–29 | < 10 |

**Go:** at least 4 of 6 metrics hit Go, and none hits Stop. Build real payments into the product, expand from 26 to 50 cities, and start paid acquisition.
**Iterate:** run one more 45-day cycle with a single change chosen from the weakest metric: onboarding if trips are low, the invite flow if invites are low, or the offer if pass numbers are low.
**Stop:** invite rate *and* pass numbers both hit Stop. The group angle isn't working. Keep Giro free on affiliate revenue and SEO guides, with minimal running costs.

The group thesis rests on the **invite rate**. If it fails, the price doesn't matter.

## Timeline

| Weeks | Focus | Done when |
|---|---|---|
| 0–2 | **Instrument and seed.** Add the two missing counters (below). Turn on the integrations whose keys are ready. Publish 10 guides aimed at "group trip to X from Toronto/Vancouver/Montréal". Recruit 20 organizers you know. | Scorecard runs weekly; 20 organizers have planned a real trip |
| 3–6 | **Acquire organizers, not travellers.** Bachelor/ette parties, destination weddings, reunions, university clubs, sports teams. One channel at a time: Reddit and Facebook groups for trip planning, then short videos ("we planned 5 friends in Lisbon for C$1,400 each"). | ≥ 300 trips planned; a channel that works is identified |
| 7–8 | **Fix the weakest step** (sign-up, inviting, booking) from the scorecard and 10 organizer interviews. | One shipped fix with a before/after number |
| 9–12 | **Charge.** Real Pass payments; two price points. Referral: the organizer's next Pass is free when 4 invitees join. | Passes sold measurable; refund flow tested |
| 13 | **Decide** using the table above. Write a one-page result. | Decision recorded in `docs/ROADMAP.md` |

## Measurement

**Live: `/admin/launch`** (admins only) shows all six metrics against the thresholds, with an "if we decided today" verdict. Set `LAUNCH_DATE` (YYYY-MM-DD) in Vercel on Day 0 so it counts from launch.

Data behind it:
- `trips`, `trip_members`, `trip_invites`, `clicks` (with `trip_id`).
- `funnel_events`: anonymous events with no IP or account. `planned` comes from the planner for every new trip, signed in or not, with city/day/party counts. `pass_viewed` comes from `/pass`. `pass_waitlist` is recorded by the server, and `pass_paid` is reserved for week 9.
- `pass_waitlist`: email (+ account and trip if signed in) and price shown. The Pass page is `/pass`, linked from the Group tab (owners) and the footer. The price is set in `src/lib/pass.ts`.

Manual check (Neon SQL editor):

```sql
-- trips, invite rate, acceptance, click-through since launch
with t as (select id from trips where created_at >= :launch)
select
  (select count(*) from t) as trips_planned,
  (select count(distinct trip_id) from trip_invites where trip_id in (select id from t))::float / nullif((select count(*) from t), 0) as invite_rate,
  (select count(*) from trip_members where role <> 'owner' and trip_id in (select id from t))::float
    / nullif((select count(*) from trip_invites where trip_id in (select id from t)), 0) as invite_acceptance,  -- approximation: invite links are reusable
  (select count(distinct trip_id) from clicks where trip_id in (select id from t))::float / nullif((select count(*) from t), 0) as click_through,
  (select count(*) from (select trip_id from trip_members where trip_id in (select id from t) group by trip_id having count(*) >= 2) g) as group_trips;
```

Also record the revenue view at `/admin/revenue` and Vercel Analytics visitors weekly. Both funnel percentages need visitors as the denominator.

## Must be done before charging (week 9)

- **Lawyer review** of terms, the refund policy for the Pass, and the affiliate disclosure.
- **Quebec Law 25:** a named privacy officer on `/privacy`, a privacy impact note for receipts/inbound email, consent wording at sign-up, and a deletion process.
- **CIPO trademark search** for "Giro" in classes 39/42 before spending on the brand. There are existing marks named "Giro" (e.g. the cycling brand), so check for conflicts in the travel classes.
- **Neon storage:** receipts are the main source of growth. Set a per-trip size cap, or move files to object storage, before group trips start uploading in bulk.
- **Cost guards:** Google Places is now capped (`GOOGLE_PLACES_MONTHLY_CAP`, default 900). Watch Claude API spend per trip planned.

## Not in this experiment

Live hotel rates, GetYourGuide, insurance, a subscription plan, and cities beyond the current 26. Each gets revisited only after a Go.
