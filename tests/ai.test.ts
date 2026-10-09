import assert from "node:assert/strict";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { AIRefusalError, curateWithClaude } from "../src/lib/ai.ts";
import type { TripRequest } from "../src/lib/types.ts";

const req: TripRequest = {
  destinations: ["Porto"],
  origin: "",
  startDate: "2026-06-01",
  endDate: "2026-06-03",
  adults: 2,
  children: 0,
  budgetTier: "comfort",
  pace: "balanced",
  interests: ["food"],
  stayType: "hotel",
  useAI: true,
};

function fakeClient(message: object) {
  const calls: Record<string, unknown>[] = [];
  const client = { beta: { messages: { stream: (params: Record<string, unknown>) => (calls.push(params), { finalMessage: async () => message }) } } };
  return { client: client as unknown as Anthropic, calls };
}

const act = (title: string, slot: string) => ({ title, description: "d", category: "food", slot, durationHrs: 2, estCost: 20, area: "Ribeira", tip: "", bookable: false });

test("merges Claude's plan onto Giro's date skeleton", async () => {
  const { client, calls } = fakeClient({
    stop_reason: "end_turn",
    parsed_output: {
      title: "Porto, slowly",
      summary: "Port wine and river views.",
      days: [{ theme: "Arrive", eat: "Francesinha", activities: [act("Arrive in Porto", "morning"), act("Ribeira walk", "evening")] }, { theme: "Wine", eat: "", activities: [act("Port lodge tasting", "afternoon")] }],
      stays: [{ city: "Porto", area: "Ribeira", why: "On the river." }],
      tips: ["Wear good shoes."],
      packing: [],
    },
  });
  const trip = await curateWithClaude(req, { client });
  assert.equal(calls[0].model, "claude-opus-5-5");
  assert.equal(trip.source, "ai");
  assert.equal(trip.days.length, 3, "skeleton always wins on length");
  assert.equal(trip.days[1].activities[0].title, "Port lodge tasting");
  assert.equal(trip.days[2].theme, "Farewell, Porto", "missing AI days fall back to the engine");
  assert.equal(trip.stays[0].area, "Ribeira");
  assert.ok(trip.packing.length > 0, "empty AI packing list falls back");
  assert.equal(trip.days[0].activities[0].tip, undefined);
});

test("surfaces refusals distinctly", async () => {
  const { client } = fakeClient({ stop_reason: "refusal", parsed_output: null });
  await assert.rejects(curateWithClaude(req, { client }), AIRefusalError);
});
