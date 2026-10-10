/**
 * Heads-up notes for catalog cities: long-standing, widely reported scams, pickpocket spots,
 * transport rip-offs, natural hazards and rules that carry fines. Practical, not alarmist; no
 * named businesses. Reviewed October 2026. Always point travellers to official advice too.
 */

export type HeadsUpKind = "scam" | "pickpockets" | "transport" | "safety" | "rules";

export interface HeadsUp {
  kind: HeadsUpKind;
  text: string;
}

export const HEADS_UP_REVIEWED = "October 2026";

/** Government of Canada advisories (the official source for Canadian travellers). */
export const OFFICIAL_ADVICE_URL = "https://travel.gc.ca/travelling/advisories";

export const HEADS_UP: Record<string, HeadsUp[]> = {
  paris: [
    { kind: "scam", text: "Around Sacré-Cœur and the Eiffel Tower, people push \"friendship bracelets\" onto your wrist or ask you to sign a petition, then demand money. Keep walking." },
    { kind: "pickpockets", text: "Pickpockets work the Métro (especially line 1 and RER B from the airport), the Louvre and crowded viewpoints. Use a zipped bag worn in front." },
    { kind: "transport", text: "Take official taxis from the rank or an app. Taxis from CDG and Orly to central Paris charge a fixed fare; refuse anyone offering a ride inside the terminal." },
  ],
  tokyo: [
    { kind: "scam", text: "In Kabukichō and Roppongi, street touts lead visitors to bars that run up huge bills, and drink spiking has been reported. Don't follow touts; choose bars yourself." },
    { kind: "rules", text: "Smoking on the street is banned in much of central Tokyo outside marked smoking areas, and fines apply." },
    { kind: "safety", text: "Learn your hotel's earthquake procedure. Most phones get Japan's emergency alerts automatically." },
  ],
  kyoto: [
    { kind: "rules", text: "Some private lanes in Gion ban photography and entry, with posted fines. Never photograph geiko or maiko without permission." },
    { kind: "transport", text: "City buses get very full near Kiyomizu and Kinkaku-ji. Trains and walking are often faster, and large luggage is better sent ahead with a delivery service." },
    { kind: "safety", text: "Kyoto summers are very hot and humid; carry water and plan temple visits for the morning." },
  ],
  lisbon: [
    { kind: "scam", text: "In Baixa, Rossio and Bairro Alto, men quietly offer drugs to tourists. These are usually fake, and buying is still illegal. Just say no and walk on." },
    { kind: "pickpockets", text: "Tram 28 is a pickpocket favourite. Keep your bag in front, or ride early in the morning." },
    { kind: "safety", text: "Cobbled hills get slippery when wet; wear shoes with grip." },
  ],
  rome: [
    { kind: "scam", text: "Costumed \"gladiators\" near the Colosseum and people offering roses or bracelets expect payment after a photo or a \"gift\". Agree a price first, or decline." },
    { kind: "pickpockets", text: "Pickpockets are active on bus 64 to the Vatican, on the Metro and at the Trevi Fountain." },
    { kind: "rules", text: "Sitting on the Spanish Steps and wading in fountains bring fines. Most of the historic centre is a limited-traffic zone (ZTL) that fines cars automatically." },
  ],
  barcelona: [
    { kind: "pickpockets", text: "Barcelona has some of Europe's busiest pickpockets: La Rambla, the Metro, Sagrada Família and beach towels. Never hang a bag on a chair." },
    { kind: "scam", text: "Watch for distraction tricks, such as someone \"helping\" clean a stain off your clothes, or a petition, while an accomplice takes your phone." },
    { kind: "rules", text: "Swimsuits and bare chests away from the beach can bring fines, and drinking in the street is restricted." },
  ],
  london: [
    { kind: "scam", text: "The \"cup and ball\" shell game on Westminster Bridge is rigged, with planted \"winners\". Don't play." },
    { kind: "transport", text: "Only use black cabs or minicabs booked through a licensed operator or app. Unbooked minicabs picking people up on the street are illegal and unsafe." },
    { kind: "pickpockets", text: "Phone snatching by people on bikes and scooters is common. Step back from the kerb when using your phone." },
  ],
  "new-york": [
    { kind: "scam", text: "In Times Square, costumed characters expect tips for photos, and people pressing \"free\" CDs into your hand will then ask for money." },
    { kind: "transport", text: "Use yellow cabs, green cabs or apps. Ignore anyone offering rides inside the airport terminals." },
    { kind: "safety", text: "The subway runs all night. Late at night, ride in a busy car, often the conductor's car near the middle of the train." },
  ],
  "mexico-city": [
    { kind: "transport", text: "Don't hail taxis on the street. Use a ride app or an authorised taxi stand (sitio), including the prepaid booths at the airport." },
    { kind: "safety", text: "Use ATMs inside banks or shopping centres during the day, and keep your phone out of sight on busy streets." },
    { kind: "safety", text: "The city is at 2,240 m. Take it easy on day one, drink water, and go light on alcohol." },
  ],
  bali: [
    { kind: "scam", text: "Some street money changers short-change visitors with sleight of hand. Use bank-affiliated changers or ATMs inside banks, and count your cash at the counter." },
    { kind: "rules", text: "Respect temple dress codes (a sarong and sash), and never sit or climb on shrines. Foreign visitors have been deported for disrespectful behaviour." },
    { kind: "safety", text: "Scooter crashes are the most common serious injury. Only ride if you're licensed, insured and wearing a helmet." },
  ],
  bangkok: [
    { kind: "scam", text: "A friendly stranger says the Grand Palace is \"closed today\" and offers a cheap tuk-tuk tour that ends at a gem or tailor shop. It isn't closed. Walk to the main gate." },
    { kind: "transport", text: "Insist on the meter in taxis, or use a ride app. Agree tuk-tuk fares before you get in." },
    { kind: "rules", text: "Criticising the monarchy is a serious crime in Thailand. Cover your shoulders and knees at temples." },
  ],
  marrakech: [
    { kind: "scam", text: "In the medina, people may say a street is \"closed\" or offer to guide you, then demand payment. Politely refuse, and use a map app or a licensed guide." },
    { kind: "scam", text: "At Jemaa el-Fna, snake charmers, monkey handlers and henna artists may start before you agree, then ask for a lot. Settle the price first." },
    { kind: "transport", text: "Agree taxi fares before setting off, or ask for the meter in petit taxis." },
  ],
  reykjavik: [
    { kind: "safety", text: "At Reynisfjara black-sand beach, sneaker waves have killed visitors. Stay well back from the water and never turn your back on the sea." },
    { kind: "safety", text: "Check road and weather conditions before every drive. Conditions change fast, and off-road driving is illegal and heavily fined." },
    { kind: "rules", text: "Stay on marked paths at geothermal areas; the ground can be thin over boiling water." },
  ],
  "cape-town": [
    { kind: "scam", text: "At ATMs, decline help from strangers, and watch for card skimmers. Use machines inside banks or malls." },
    { kind: "safety", text: "Hike Lion's Head and Table Mountain in groups, on popular routes and in daylight. Leave valuables behind and carry water." },
    { kind: "safety", text: "Use ride apps after dark rather than walking, even short distances, and keep phones out of sight in parked cars." },
  ],
  amsterdam: [
    { kind: "safety", text: "Red lanes are for bikes, which come fast and silently. Look both ways before stepping off the pavement." },
    { kind: "scam", text: "Street dealers offering drugs often sell fakes or dangerous substances. Buying on the street is illegal." },
    { kind: "rules", text: "Smoking cannabis in the street is banned in the red-light district, and photographing workers in the windows is forbidden." },
  ],
  dublin: [
    { kind: "pickpockets", text: "Pickpockets and bag snatchers target busy pubs in Temple Bar and O'Connell Street. Keep your bag on your lap, not on a hook." },
    { kind: "transport", text: "Licensed taxis display a roof sign and a driver ID on the dashboard. Use them or apps late at night." },
    { kind: "safety", text: "On cliff walks such as Howth, keep to the path; edges can be crumbly, and the weather turns quickly." },
  ],
  prague: [
    { kind: "scam", text: "Some exchange offices advertise \"0% commission\" but use terrible rates. Check the amount you'll actually get before handing over cash, or use a bank ATM." },
    { kind: "scam", text: "At ATMs and card machines, always choose to be charged in Czech koruna (CZK), not your home currency, to avoid poor conversion rates." },
    { kind: "transport", text: "Avoid hailing taxis in the old town; use ride apps or book through your hotel." },
  ],
  florence: [
    { kind: "pickpockets", text: "Pickpockets work the crowds around the Duomo, the Ponte Vecchio and the station." },
    { kind: "rules", text: "The historic centre is a limited-traffic zone (ZTL). Cameras fine unauthorised cars automatically, often months later." },
    { kind: "scam", text: "Restaurants right on the main squares can charge a lot; check prices and any cover charge (coperto) on the menu before sitting." },
  ],
  athens: [
    { kind: "scam", text: "A friendly stranger invites you for a drink at a bar, where the bill turns out to be huge. Choose bars yourself." },
    { kind: "pickpockets", text: "Pickpockets are active on Metro line 1 (Piraeus–Monastiraki) and around the Acropolis entrances." },
    { kind: "safety", text: "In summer, visit the Acropolis right at opening. It closes during extreme heat, and the marble is slippery." },
  ],
  istanbul: [
    { kind: "scam", text: "A shoe-shiner \"drops\" a brush. You hand it back, he shines your shoes as thanks, then demands payment. Just keep walking." },
    { kind: "scam", text: "Friendly strangers inviting solo travellers to a bar can lead to an enormous bill. Pick your own venues." },
    { kind: "transport", text: "Use ride apps or insist on the meter in taxis, and know your route. Overcharging from the airport is common." },
  ],
  seoul: [
    { kind: "transport", text: "Use regular metered or app taxis. Unofficial drivers at the airport may overcharge, so use the official taxi stands." },
    { kind: "rules", text: "Jaywalking and littering can be fined, and smoking is banned in many outdoor public areas." },
    { kind: "safety", text: "Seoul is very safe. The main hazard is fast delivery scooters on pavements." },
  ],
  singapore: [
    { kind: "rules", text: "Fines are strict and enforced: no eating or drinking on the MRT, no chewing gum imports, and no littering or jaywalking." },
    { kind: "scam", text: "When buying electronics, agree the total price in writing before paying, and refuse surprise \"warranties\" or add-ons." },
    { kind: "safety", text: "Heat and sudden thunderstorms are the real risks. Carry water and an umbrella." },
  ],
  cancun: [
    { kind: "transport", text: "Agree taxi fares before you get in (there are no meters), or book transfers in advance. Ignore the timeshare and transport sellers in the airport arrivals hall." },
    { kind: "scam", text: "\"Free\" breakfasts and tours are often timeshare sales pitches lasting hours. Decline anything tied to a presentation." },
    { kind: "safety", text: "Check the beach flags: red means dangerous currents. Seaweed (sargassum) season can also close beaches." },
  ],
  vancouver: [
    { kind: "safety", text: "Car break-ins are common. Never leave anything visible in a parked car, especially at trailheads and viewpoints." },
    { kind: "safety", text: "Around East Hastings Street, open drug use and street disorder are visible. Stick to main routes, especially at night, and use transit or a cab between neighbourhoods." },
    { kind: "safety", text: "On North Shore hikes, carry water and a light, and start early. Rescues are frequent when hikers underestimate the trails." },
  ],
  montreal: [
    { kind: "safety", text: "In winter, sidewalks can be icy. Wear boots with grip, and watch for snow falling from roofs during thaws." },
    { kind: "transport", text: "Road construction and detours are constant in summer, so allow extra time and use the Métro when you can." },
    { kind: "rules", text: "Right turns on red are not allowed anywhere on the island of Montréal." },
  ],
  sydney: [
    { kind: "safety", text: "Rip currents are a leading cause of drowning at Australian beaches. Swim between the red and yellow flags, where lifeguards patrol." },
    { kind: "safety", text: "The sun is fierce, even on cloudy days. Wear sunscreen, a hat and sunglasses, and stay in the shade at midday." },
    { kind: "rules", text: "Tap on and off with a contactless card or Opal card. Fines for not having a valid fare are steep." },
  ],
};
