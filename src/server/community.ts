import "server-only";
import { getDb } from "./db.ts";

/**
 * Community picks: stops other Giro travellers chose deliberately. A traveller "backs" a stop by
 * booking it, picking it themselves (from Ideas, a swap or the food guide) or voting it up on a
 * group trip. Only aggregate counts leave this module, and only once enough different travellers
 * agree, so no individual's choices can be inferred.
 */

export const MIN_TRAVELLERS = 3;
const CACHE_MS = 10 * 60_000;

export interface CommunityPick {
  /** Distinct travellers who backed it. */
  travellers: number;
  /** Distinct trips where it was marked booked. */
  booked: number;
}

interface Row {
  ref: string;
  travellers: number | string;
  booked: number | string;
  against: number | string;
}

let cache: { at: number; picks: Map<string, CommunityPick> } | undefined;

export async function communityPicks(): Promise<Map<string, CommunityPick>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.picks;
  const db = await getDb();
  const rows = await db.query<Row>(
    `with acts as (
       select t.id as trip_id, t.owner_id, a->>'ref' as ref, a->>'id' as aid,
              coalesce((a->>'booked')::boolean, false) as booked,
              coalesce((a->>'picked')::boolean, false) as picked
         from trips t
         cross join lateral jsonb_array_elements(t.data->'days') d
         cross join lateral jsonb_array_elements(d->'activities') a
        where a ? 'ref'
     ),
     votes_on as (
       select acts.ref, v.user_id, v.value from votes v join acts on acts.trip_id = v.trip_id and acts.aid = v.activity_id
     ),
     backers as (
       select ref, owner_id as user_id from acts where booked or picked
       union
       select ref, user_id from votes_on where value = 1
     )
     select b.ref,
            count(distinct b.user_id) as travellers,
            (select count(distinct x.trip_id) from acts x where x.ref = b.ref and x.booked) as booked,
            (select count(distinct v.user_id) from votes_on v where v.ref = b.ref and v.value = -1) as against
       from backers b
      group by b.ref`,
    [],
  );
  const picks = new Map<string, CommunityPick>();
  for (const r of rows) {
    const travellers = Number(r.travellers);
    // Enough independent backers, and clearly more for than against.
    if (travellers >= MIN_TRAVELLERS && travellers > 2 * Number(r.against)) picks.set(r.ref, { travellers, booked: Number(r.booked) });
  }
  cache = { at: Date.now(), picks };
  return picks;
}

/** For tests: forget the cached aggregate. */
export const resetCommunityCache = () => (cache = undefined);
