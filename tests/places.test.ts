import assert from "node:assert/strict";
import { test } from "node:test";
import { commonsFile, nearCity, parseCommonsCredit, parseNominatim, parseSummary, pickWikiTitle } from "../src/lib/place-parse.ts";

test("picks the right Wikipedia article and rejects weak matches", () => {
  assert.equal(pickWikiTitle("Belém monuments", "Lisbon", [{ title: "Belém Tower" }, { title: "Jerónimos Monastery" }]), "Belém Tower");
  assert.equal(pickWikiTitle("Senso-ji and Nakamise-dori", "Tokyo", [{ title: "Sensō-ji" }, { title: "Asakusa" }]), "Sensō-ji");
  assert.equal(pickWikiTitle("Free time around Alfama", "Lisbon", [{ title: "Lisbon Metro" }]), undefined);
  assert.equal(pickWikiTitle("Rooftop aperitivo", "Rome", [{ title: "Spritz Veneziano" }, { title: "Aperitivo (disambiguation)" }]), undefined);
});

test("parses Wikipedia summaries safely", () => {
  const info = parseSummary({
    type: "standard",
    title: "Belém Tower",
    description: "Fortified tower in Lisbon, Portugal",
    extract: "Belém Tower is a 16th-century fortification located in Lisbon that served as a point of embarkation for Portuguese explorers.",
    coordinates: { lat: 38.6916, lon: -9.216 },
    thumbnail: { source: "https://upload.wikimedia.org/x.jpg" },
    content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Bel%C3%A9m_Tower" } },
  })!;
  assert.equal(info.lat, 38.6916);
  assert.match(info.extract!, /16th-century/);
  assert.equal(parseSummary({ type: "disambiguation", extract: "x" }), undefined);
  assert.equal(parseSummary({ extract: "x", thumbnail: { source: "javascript:alert(1)" } })?.thumbnail, undefined, "only Wikimedia image URLs");
  assert.equal(parseSummary({ extract: "x", thumbnail: { source: "https://upload.wikimedia.org/wikipedia/en/a/ab/Logo.png" } })?.thumbnail, undefined, "no non-free English-Wikipedia uploads");
});

test("Commons photo credits", () => {
  assert.equal(commonsFile("https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Past%C3%A9is_de_Nata.jpg/320px-Past%C3%A9is_de_Nata.jpg"), "File:Pastéis_de_Nata.jpg");
  assert.equal(commonsFile("https://upload.wikimedia.org/wikipedia/commons/5/5f/Nata.jpg"), "File:Nata.jpg");
  assert.equal(commonsFile("https://upload.wikimedia.org/wikipedia/en/5/5f/Nata.jpg"), undefined);
  const credit = parseCommonsCredit({ query: { pages: [{ imageinfo: [{ extmetadata: { Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:A">A &amp; B</a>' }, LicenseShortName: { value: "CC BY 2.0" } } }] }] } }, "File:Nata.jpg");
  assert.deepEqual(credit, { page: "https://commons.wikimedia.org/wiki/File:Nata.jpg", author: "A & B", license: "CC BY 2.0" });
  assert.deepEqual(parseCommonsCredit(undefined, "File:Nata.jpg"), { page: "https://commons.wikimedia.org/wiki/File:Nata.jpg", author: undefined, license: undefined });
});

test("geocoding fallback and distance sanity check", () => {
  assert.deepEqual(parseNominatim([{ lat: "38.7139", lon: "-9.1335", display_name: "Castelo" }]), { lat: 38.7139, lon: -9.1335, name: "Castelo" });
  assert.equal(parseNominatim([]), undefined);
  const lisbon = { lat: 38.7223, lon: -9.1393 };
  assert.ok(nearCity({ lat: 38.69, lon: -9.21 }, lisbon, false));
  assert.ok(!nearCity({ lat: 16.74, lon: -62.19 }, lisbon, true), "Montserrat the island is not near Lisbon");
  assert.ok(nearCity({ lat: 38.79, lon: -9.39 }, lisbon, true), "Sintra is fine for a day trip");
});
