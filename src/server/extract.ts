import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AI_MODEL } from "../lib/ai.ts";
import { CURRENCIES } from "../lib/currency.ts";
import { HttpError } from "./errors.ts";
import type { SafeMime } from "./files.ts";

/** Read booking confirmations and receipts with Claude's vision, returning structured fields to review. */

const FlightOut = z.object({
  airline: z.string().describe("Airline name, or empty string"),
  flightNumber: z.string().describe("e.g. AC1906, or empty string"),
  from: z.string().describe("Departure airport IATA code if shown, else city"),
  to: z.string().describe("Arrival airport IATA code if shown, else city"),
  departDate: z.string().describe("YYYY-MM-DD"),
  departTime: z.string().describe("24-hour HH:MM local time"),
  arriveDate: z.string().describe("YYYY-MM-DD"),
  arriveTime: z.string().describe("24-hour HH:MM local time"),
  confirmation: z.string().describe("Booking reference, or empty string"),
});

const StayOut = z.object({
  name: z.string().describe("Hotel or rental name"),
  address: z.string().describe("Full address, or empty string"),
  city: z.string(),
  checkInDate: z.string().describe("YYYY-MM-DD"),
  checkOutDate: z.string().describe("YYYY-MM-DD"),
  checkInTime: z.string().describe("24-hour HH:MM, or empty string"),
  checkOutTime: z.string().describe("24-hour HH:MM, or empty string"),
  confirmation: z.string().describe("Booking reference, or empty string"),
  total: z.number().describe("Total price paid for this stay including taxes and fees, exactly as shown; 0 if not shown"),
  currency: z.string().describe("ISO 4217 code of that total, e.g. EUR; empty string if not shown"),
});

const BookingOut = z.object({
  flights: z.array(FlightOut),
  stays: z.array(StayOut),
  flightsTotal: z.number().describe("Total price paid for all flights in this booking, for all passengers, including taxes; 0 if not shown"),
  flightsCurrency: z.string().describe("ISO 4217 code of the flights total; empty string if not shown"),
});

const ReceiptOut = z.object({
  merchant: z.string().describe("Business name, or empty string"),
  total: z.number().describe("Grand total actually paid, including tax and tip; 0 if unreadable"),
  currency: z.string().describe("ISO 4217 code such as CAD, EUR, USD"),
  date: z.string().describe("YYYY-MM-DD, or empty string"),
  description: z.string().describe("Two to four words, e.g. 'Dinner at Taberna'"),
});

export type ExtractedBooking = z.infer<typeof BookingOut>;
export type ExtractedReceipt = z.infer<typeof ReceiptOut> & { currency: (typeof CURRENCIES)[number] | string };

function fileBlock(mime: SafeMime, bytes: Uint8Array) {
  const data = Buffer.from(bytes).toString("base64");
  return mime === "application/pdf"
    ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
    : ({ type: "image", source: { type: "base64", media_type: mime, data } } as const);
}

async function extract<T extends z.ZodType>(schema: T, instruction: string, mime: SafeMime, bytes: Uint8Array, client: Anthropic): Promise<z.infer<T>> {
  let message;
  try {
    message = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: [fileBlock(mime, bytes), { type: "text", text: instruction }] }],
    });
  } catch (err) {
    // An API-side problem (credits, rate limits, outages) isn't the traveller's fault; say so plainly.
    if (!(err instanceof Anthropic.APIError)) throw err;
    console.error("document reading failed", err.status, err.message);
    throw new HttpError(503, "ai_unavailable", "Reading documents isn't available right now. Please try again later.");
  }
  if (message.stop_reason === "refusal") throw new HttpError(422, "unreadable", "We couldn't read that document.");
  const parsed = message.parsed_output as z.infer<T> | null | undefined;
  if (!parsed) throw new HttpError(422, "unreadable", "We couldn't read that document. Try a clearer photo.");
  return parsed;
}

export function readBooking(mime: SafeMime, bytes: Uint8Array, client = new Anthropic()): Promise<ExtractedBooking> {
  return extract(
    BookingOut,
    "This is a travel booking confirmation (flight, hotel or rental). Extract every flight segment and every accommodation exactly as written. Use local times in 24-hour format. Include the total price paid only when it is stated (the grand total, not a per-night or per-person rate unless that's all there is). Leave a field empty or 0 rather than guessing. If it contains neither, return empty lists.",
    mime,
    bytes,
    client,
  );
}

export async function readReceipt(mime: SafeMime, bytes: Uint8Array, client = new Anthropic()): Promise<ExtractedReceipt> {
  const r = await extract(ReceiptOut, "This is a receipt or bill. Extract the merchant, the grand total actually paid (including tax and tip if shown), the currency and the date. Don't guess: use 0 or an empty string when unclear.", mime, bytes, client);
  return { ...r, currency: r.currency.toUpperCase().slice(0, 3) };
}
