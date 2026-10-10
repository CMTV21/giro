import type { CatalogActivity } from "./destinations.ts";

/**
 * Access needs: steer plans away from stops that don't suit them. Ratings are Giro's own
 * best-effort guidance (lifts, steps and surfaces change), so the UI always says to check
 * with the venue. Unrated stops are judged by length only.
 */

export const ACCESS_NEEDS = ["low-walking", "step-free", "stroller"] as const;
export type AccessNeed = (typeof ACCESS_NEEDS)[number];

export const ACCESS_LABELS: Record<AccessNeed, { label: string; hint: string }> = {
  "low-walking": { label: "Less walking", hint: "Shorter distances, no hikes or climbs" },
  "step-free": { label: "Step-free", hint: "Wheelchair or mobility aid: avoid stairs and rough ground" },
  stroller: { label: "Stroller-friendly", hint: "Avoid stairs, steep cobbles and boat boarding" },
};

export type EffortLevel = "easy" | "moderate" | "strenuous";

export interface Effort {
  level: EffortLevel;
  /** Many stairs, steep slopes, cobbles, sand, or boarding boats. */
  rough: boolean;
  /** You take part physically: cycling, surfing, kayaking, snorkelling, climbing. */
  active: boolean;
  /** Hand-rated rather than inferred. */
  rated: boolean;
}

// effort level, then flags: r = rough, a = active
type Rating = `${"E" | "M" | "S"}${"" | "r" | "a" | "ra"}`;

/** Framework stops for cities outside the catalog, keyed "<city>-<suffix>". */
const GENERIC: Record<string, Rating> = { "walking-tour": "M", "food-tour": "M", "day-trip": "M", bike: "Ma" };

const RATINGS: Record<string, Rating> = {
  // Paris
  louvre: "M", eiffel: "E", "marais-walk": "M", montmartre: "Mr", versailles: "M", "food-tour": "M", "bike-tour": "Ma",
  // Tokyo
  teamlab: "E", meiji: "M", "golden-gai": "Er", nikko: "Mr", yanaka: "M", "mt-takao": "Sra",
  // Kyoto
  fushimi: "Mr", arashiyama: "M", gion: "M", kiyomizu: "Mr", philosophers: "M", nara: "M", kimono: "M",
  // Lisbon
  alfama: "Mr", belem: "M", "bairro-alto": "Mr", sintra: "Mr", cascais: "M", surf: "Sra", miradouro: "Er",
  // Rome
  colosseum: "Mr", vatican: "M", stpeters: "Sr", "pantheon-trevi": "Mr", trastevere: "Mr", appian: "Mra", testaccio: "M",
  // Barcelona
  "park-guell": "Mr", gothic: "M", beach: "Er", montjuic: "Mr", "tapas-tour": "M", montserrat: "Mr", bunkers: "Mr", sailing: "Er",
  // London
  "british-museum": "M", westminster: "M", tower: "Mr", "tate-modern": "M", shoreditch: "M", hampstead: "Mr", "pub-crawl": "M", camden: "M",
  // New York
  "central-park": "M", met: "M", "high-line": "M", statue: "M", "brooklyn-bridge": "M", williamsburg: "M", "food-tour-ny": "M",
  // Mexico City
  teotihuacan: "Sr", anthro: "M", zocalo: "M", xochimilco: "Er", "taco-tour": "M", chapultepec: "Mr", "roma-condesa": "M",
  // Bali
  tegallalang: "Mr", "monkey-forest": "Mr", uluwatu: "Mr", batur: "Sra", "surf-bali": "Sra", "nusa-penida": "Sra", "tanah-lot": "Mr",
  // Bangkok
  "grand-palace": "M", "wat-pho": "M", "wat-arun": "Mr", chinatown: "M", floating: "Mr", chatuchak: "M", ayutthaya: "M",
  // Marrakech
  jemaa: "M", souks: "Mr", atlas: "Mr", agafay: "Er", balloon: "Er",
  // Reykjavík
  "golden-circle": "M", "south-coast": "Mr", whale: "Er", glacier: "Sra", silfra: "Mra", "bar-crawl-is": "M",
  // Cape Town
  "table-mountain": "M", "cape-point": "Mr", robben: "Mr", "bo-kaap": "Mr", "lions-head": "Sra", "camps-bay": "Er", shark: "Mra",
  // Amsterdam
  rijks: "M", "anne-frank": "Er", "canal-cruise-ams": "Er", jordaan: "M", vondelpark: "Ma", zaanse: "M", "brown-cafe": "M",
  // Dublin
  kilmainham: "Mr", howth: "Sr", glendalough: "Mr", "literary-pub": "M", "phoenix-park": "M",
  // Prague
  castle: "Mr", "charles-bridge": "Mr", "jewish-quarter": "M", "beer-tour": "M", petrin: "Mr", "kutna-hora": "Mr", vysehrad: "Mr",
  // Florence
  uffizi: "M", duomo: "Sr", chianti: "M", piazzale: "Mr", boboli: "Mr", "oltrarno-artisans": "Mr", "pisa-siena": "M",
  // Athens
  acropolis: "Sr", "acropolis-museum": "E", agora: "Mr", plaka: "Mr", sounion: "Mr", aegina: "M", "food-tour-ath": "M", lycabettus: "Mr",
  // Istanbul
  topkapi: "M", "grand-bazaar": "M", "basilica-cistern": "Er", kadikoy: "M", galata: "Mr", balat: "Mr", istiklal: "M",
  // Seoul
  gyeongbok: "M", bukchon: "Mr", "n-tower": "Mr", dmz: "M", "hongdae-night": "M", bukhansan: "Sra", myeongdong: "M", "lotte-world": "M",
  // Singapore
  "gardens-bay": "M", zoo: "M", "chinatown-sg": "M", "kampong-glam": "M", sentosa: "M", macritchie: "Sr",
  // Cancún
  "chichen-itza": "M", cenotes: "Mra", "tulum-ruins": "Mr", "isla-mujeres": "M", snorkel: "Mra", "beach-day": "Er", xcaret: "M", "catamaran-cun": "Era",
  // Vancouver
  "stanley-park": "Ma", capilano: "Mr", grouse: "M", gastown: "Mr", whistler: "M", "kayak-van": "Mra", brewery: "M",
  // Montréal
  "old-montreal": "Mr", "mont-royal": "Mr", "plateau-walk": "Mr", biodome: "M", "mtl-food-tour": "M", "st-laurent": "M", lachine: "Ma", "mont-tremblant": "M",
  // Sydney
  "bondi-coogee": "Mr", "bridge-climb": "Sra", "rocks-walk": "Mr", "blue-mountains": "Mr", taronga: "Mr", "surf-lesson": "Sra", newtown: "M",
};

const LEVEL: Record<string, EffortLevel> = { E: "easy", M: "moderate", S: "strenuous" };

export function effortOf(act: Pick<CatalogActivity, "key" | "hrs">): Effort {
  const r = RATINGS[act.key] ?? Object.entries(GENERIC).find(([suffix]) => act.key.endsWith(`-${suffix}`))?.[1];
  if (r) return { level: LEVEL[r[0]], rough: r.includes("r"), active: r.includes("a"), rated: true };
  // Unrated: long outings mean a lot of time on your feet.
  return { level: act.hrs >= 6 ? "moderate" : "easy", rough: false, active: false, rated: false };
}

/** Score adjustment for the traveller's needs: -Infinity rules a stop out. */
export function accessPenalty(effort: Effort, needs: readonly AccessNeed[] | undefined): number {
  if (!needs?.length) return 0;
  let penalty = 0;
  for (const need of needs) {
    if (effort.level === "strenuous" || effort.active) return -Infinity;
    if ((need === "step-free" || need === "stroller") && effort.rough) return -Infinity;
    if (effort.level === "moderate") penalty -= need === "stroller" ? 1 : need === "step-free" ? 2 : 3;
  }
  return penalty;
}

/** Plain-language caution for a stop that's in the plan despite the traveller's needs. */
export function accessCaution(effort: Effort, needs: readonly AccessNeed[] | undefined): string | undefined {
  if (!needs?.length) return undefined;
  if (effort.level === "strenuous" || effort.active) return "Physically demanding";
  if (effort.rough && (needs.includes("step-free") || needs.includes("stroller"))) return "Stairs or uneven ground";
  if (effort.level === "moderate" && needs.includes("low-walking")) return "A fair amount of walking";
  return undefined;
}

export const isAccessNeed = (v: unknown): v is AccessNeed => typeof v === "string" && (ACCESS_NEEDS as readonly string[]).includes(v);
