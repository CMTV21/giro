/**
 * Group Trip Pass price in CAD, per trip. Unset while pricing is still being decided: no price is
 * shown anywhere and waitlist sign-ups record 0. Set it (e.g. 24) to show it on /pass and the Group tab.
 */
export const PASS_PRICE_CAD: number | undefined = undefined;

/** What stays free, and what the Pass will add when it launches (the beta keeps everything free). */
export const PASS_FREE = ["Plan any trip, with or without Giro AI", "Share a read-only link", "Invite up to 3 people", "Every booking link and price estimate"];
export const PASS_INCLUDES = [
  "Unlimited travellers on the trip",
  "Group voting on stops",
  "Shared expenses with settle-up",
  "Forward booking emails and receipts to the trip",
  "Calendar feed for everyone's phone",
  "Offline trip pack",
];

/** Events the browser may report. Waitlist sign-ups are recorded by the server itself. */
export const CLIENT_EVENTS = ["planned", "pass_viewed"] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];
