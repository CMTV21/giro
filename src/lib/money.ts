import { formatMoney, type FxSnapshot } from "./currency";
import type { Trip } from "./types";

const LEGACY: FxSnapshot = { currency: "USD", rate: 1, asOf: "", source: "fallback" };

/** Trips saved before currencies existed were planned in USD. */
export const tripFx = (trip: Pick<Trip, "fx">): FxSnapshot => trip.fx ?? LEGACY;

/** Format a USD amount in the trip's currency. */
export const money = (trip: Pick<Trip, "fx">, usd: number, approx = false) => formatMoney(usd, tripFx(trip), { approx });
