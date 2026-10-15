import type { ActivityDetails } from "../../lib/activity-details.ts";
import { DETAILS as PARIS } from "./paris.ts";
import { DETAILS as TOKYO } from "./tokyo.ts";
import { DETAILS as KYOTO } from "./kyoto.ts";
import { DETAILS as LISBON } from "./lisbon.ts";
import { DETAILS as ROME } from "./rome.ts";
import { DETAILS as BARCELONA } from "./barcelona.ts";
import { DETAILS as LONDON } from "./london.ts";
import { DETAILS as NEW_YORK } from "./new-york.ts";
import { DETAILS as MEXICO_CITY } from "./mexico-city.ts";
import { DETAILS as BALI } from "./bali.ts";
import { DETAILS as BANGKOK } from "./bangkok.ts";
import { DETAILS as MARRAKECH } from "./marrakech.ts";
import { DETAILS as REYKJAVIK } from "./reykjavik.ts";
import { DETAILS as CAPE_TOWN } from "./cape-town.ts";
import { DETAILS as AMSTERDAM } from "./amsterdam.ts";
import { DETAILS as DUBLIN } from "./dublin.ts";
import { DETAILS as PRAGUE } from "./prague.ts";
import { DETAILS as FLORENCE } from "./florence.ts";
import { DETAILS as ATHENS } from "./athens.ts";
import { DETAILS as ISTANBUL } from "./istanbul.ts";
import { DETAILS as SEOUL } from "./seoul.ts";
import { DETAILS as SINGAPORE } from "./singapore.ts";
import { DETAILS as CANCUN } from "./cancun.ts";
import { DETAILS as VANCOUVER } from "./vancouver.ts";
import { DETAILS as MONTREAL } from "./montreal.ts";
import { DETAILS as SYDNEY } from "./sydney.ts";

/** Written details per city slug, then catalog activity key. */
export const DETAILS: Record<string, Record<string, ActivityDetails>> = {
  "paris": PARIS,
  "tokyo": TOKYO,
  "kyoto": KYOTO,
  "lisbon": LISBON,
  "rome": ROME,
  "barcelona": BARCELONA,
  "london": LONDON,
  "new-york": NEW_YORK,
  "mexico-city": MEXICO_CITY,
  "bali": BALI,
  "bangkok": BANGKOK,
  "marrakech": MARRAKECH,
  "reykjavik": REYKJAVIK,
  "cape-town": CAPE_TOWN,
  "amsterdam": AMSTERDAM,
  "dublin": DUBLIN,
  "prague": PRAGUE,
  "florence": FLORENCE,
  "athens": ATHENS,
  "istanbul": ISTANBUL,
  "seoul": SEOUL,
  "singapore": SINGAPORE,
  "cancun": CANCUN,
  "vancouver": VANCOUVER,
  "montreal": MONTREAL,
  "sydney": SYDNEY,
};
