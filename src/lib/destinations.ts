import type { BudgetTier, Climate, Interest, Slot } from "./types.ts";

export interface CatalogActivity {
  key: string;
  title: string;
  description: string;
  cats: Interest[];
  slot: Slot | "any";
  hrs: number;
  /** Approximate cost per adult in USD. */
  cost: number;
  area: string;
  tip?: string;
  bookable?: boolean;
  /** Good with children. */
  kids?: boolean;
}

export interface Destination {
  slug: string;
  name: string;
  country: string;
  aliases: string[];
  /** Primary IATA airport/city code. */
  airport: string;
  climate: Climate;
  palette: [string, string];
  tagline: string;
  /** Months (1-12) with the best balance of weather and crowds. */
  bestMonths: number[];
  /** Where to stay, by budget tier. */
  areas: Record<BudgetTier, { name: string; why: string }>;
  /** Typical daily costs in USD: lodging per room-night, food & local transport per person-day. */
  daily: Record<BudgetTier, { lodging: number; food: number; transport: number }>;
  /** Typical economy round-trip fare in USD from a major hub. Indicative only. */
  flightEst: number;
  eats: string[];
  tips: string[];
  activities: CatalogActivity[];
}

export const DESTINATIONS: Destination[] = [
  {
    slug: "paris",
    name: "Paris",
    country: "France",
    aliases: ["paris france"],
    airport: "PAR",
    climate: "temperate",
    palette: ["#1e3a8a", "#f472b6"],
    tagline: "Boulevards, bistros and the world's great museums.",
    bestMonths: [4, 5, 6, 9, 10],
    areas: {
      shoestring: { name: "Canal Saint-Martin (10th)", why: "Lively, local and well connected by Métro, with lower prices than the centre." },
      comfort: { name: "Le Marais (3rd/4th)", why: "Walkable to the Louvre, Notre-Dame and the islands, full of cafés and boutiques." },
      luxury: { name: "Saint-Germain-des-Prés (6th)", why: "Classic Left Bank elegance, literary cafés and the Luxembourg Gardens on your doorstep." },
    },
    daily: {
      shoestring: { lodging: 110, food: 45, transport: 8 },
      comfort: { lodging: 260, food: 90, transport: 12 },
      luxury: { lodging: 750, food: 220, transport: 45 },
    },
    flightEst: 780,
    eats: [
      "Breakfast croissants from a neighbourhood boulangerie (look for 'Artisan Boulanger')",
      "A classic steak-frites at a Left Bank bistro",
      "Falafel on Rue des Rosiers in the Marais",
      "Cheese and wine picnic from Marché des Enfants Rouges",
      "Crêpes in Montparnasse, the Breton quarter",
    ],
    tips: [
      "Most national museums are free on the first Sunday of some months — check before you go, and expect crowds.",
      "Buy a Navigo Easy card for the Métro instead of paper tickets.",
      "Many restaurants close Sunday and Monday; book dinner ahead on weekends.",
    ],
    activities: [
      { key: "louvre", title: "The Louvre", description: "See the Winged Victory, the Venus de Milo and the Mona Lisa, then lose the crowds in the Islamic Art wing.", cats: ["art", "culture", "history"], slot: "morning", hrs: 3.5, cost: 25, area: "1st arrondissement", tip: "Use the Carrousel entrance and pre-book a timed slot.", bookable: true, kids: true },
      { key: "eiffel", title: "Eiffel Tower summit", description: "Ride to the top for the city panorama, then picnic on the Champ de Mars.", cats: ["culture"], slot: "evening", hrs: 2.5, cost: 40, area: "7th arrondissement", tip: "The sparkle runs for five minutes on the hour after dark.", bookable: true, kids: true },
      { key: "orsay", title: "Musée d'Orsay", description: "Impressionist masterpieces in a Beaux-Arts railway station, including Monet, Degas and Van Gogh.", cats: ["art", "culture"], slot: "morning", hrs: 2.5, cost: 18, area: "7th arrondissement", bookable: true },
      { key: "marais-walk", title: "Le Marais wander", description: "Medieval lanes, Place des Vosges, hidden courtyards and independent boutiques.", cats: ["culture", "shopping", "history"], slot: "afternoon", hrs: 3, cost: 0, area: "Le Marais", kids: true },
      { key: "seine-cruise", title: "Seine river cruise", description: "An hour gliding past Notre-Dame, the Louvre and the Eiffel Tower.", cats: ["culture", "relaxation"], slot: "evening", hrs: 1.5, cost: 20, area: "Pont Neuf", bookable: true, kids: true },
      { key: "montmartre", title: "Montmartre and Sacré-Cœur", description: "Climb the butte, watch the painters at Place du Tertre and catch the view from the basilica steps.", cats: ["culture", "art", "history"], slot: "afternoon", hrs: 3, cost: 0, area: "Montmartre", kids: true },
      { key: "versailles", title: "Palace of Versailles day trip", description: "The Hall of Mirrors, the royal apartments and Marie Antoinette's estate in the gardens.", cats: ["history", "culture"], slot: "morning", hrs: 6, cost: 32, area: "Versailles", tip: "Go Tuesday–Friday and arrive at opening.", bookable: true, kids: true },
      { key: "food-tour", title: "Saint-Germain food tour", description: "Cheese, chocolate, macarons and charcuterie with a local guide.", cats: ["food"], slot: "afternoon", hrs: 3, cost: 120, area: "Saint-Germain", bookable: true },
      { key: "sainte-chapelle", title: "Sainte-Chapelle and Île de la Cité", description: "Thirteenth-century stained glass at its most luminous, then a stroll around the islands.", cats: ["history", "art"], slot: "morning", hrs: 2, cost: 22, area: "Île de la Cité", bookable: true },
      { key: "luxembourg", title: "Jardin du Luxembourg", description: "Parisian life at its most relaxed: chess players, the Medici Fountain and toy sailboats.", cats: ["nature", "relaxation", "family"], slot: "any", hrs: 1.5, cost: 0, area: "6th arrondissement", kids: true },
      { key: "cabaret", title: "Cabaret night in Pigalle", description: "A classic Parisian revue with champagne.", cats: ["nightlife"], slot: "evening", hrs: 3, cost: 150, area: "Pigalle", bookable: true },
      { key: "canal-apero", title: "Apéro along Canal Saint-Martin", description: "Natural-wine bars and canal-side evenings where locals actually hang out.", cats: ["nightlife", "food"], slot: "evening", hrs: 2.5, cost: 35, area: "10th arrondissement" },
      { key: "galeries", title: "Galeries Lafayette and the passages", description: "Department-store glamour, the free rooftop terrace and the nineteenth-century covered arcades.", cats: ["shopping"], slot: "afternoon", hrs: 2.5, cost: 0, area: "Opéra" },
      { key: "bike-tour", title: "Bike tour of the Left Bank", description: "A guided ride along the river past the city's icons.", cats: ["adventure", "culture"], slot: "morning", hrs: 3, cost: 45, area: "7th arrondissement", bookable: true, kids: true },
    ],
  },
  {
    slug: "tokyo",
    name: "Tokyo",
    country: "Japan",
    aliases: ["tokyo japan"],
    airport: "TYO",
    climate: "subtropical",
    palette: ["#be123c", "#1e1b4b"],
    tagline: "Neon, nature and the best food city on earth.",
    bestMonths: [3, 4, 5, 10, 11],
    areas: {
      shoestring: { name: "Asakusa", why: "Traditional streets, good-value hotels and hostels, and easy airport trains." },
      comfort: { name: "Shinjuku", why: "Tokyo's transport hub, with endless dining and nightlife on your doorstep." },
      luxury: { name: "Marunouchi / Ginza", why: "Refined hotels, flagship shopping and quick bullet-train access." },
    },
    daily: {
      shoestring: { lodging: 80, food: 35, transport: 10 },
      comfort: { lodging: 200, food: 75, transport: 15 },
      luxury: { lodging: 650, food: 200, transport: 40 },
    },
    flightEst: 1150,
    eats: [
      "A conveyor-belt sushi lunch",
      "Late-night ramen in Shinjuku",
      "Yakitori under the tracks at Yurakucho",
      "A depachika (department-store food hall) grazing session",
      "Monjayaki on Tsukishima's Monja Street",
    ],
    tips: [
      "Load a Suica or Pasmo card onto your phone for trains, convenience stores and vending machines.",
      "Tipping isn't expected and can cause confusion.",
      "Many smaller restaurants are cash-only, so keep some yen on hand.",
    ],
    activities: [
      { key: "sensoji", title: "Senso-ji and Nakamise-dori", description: "Tokyo's oldest temple, with street snacks along the approach.", cats: ["culture", "history"], slot: "morning", hrs: 2, cost: 0, area: "Asakusa", tip: "Arrive before 8am for a calm visit.", kids: true },
      { key: "tsukiji", title: "Tsukiji Outer Market breakfast", description: "Tamagoyaki, fresh uni and the best tuna you'll ever eat.", cats: ["food"], slot: "morning", hrs: 2, cost: 35, area: "Tsukiji", kids: true },
      { key: "teamlab", title: "teamLab Planets", description: "Walk barefoot through immersive digital art installations.", cats: ["art", "family"], slot: "afternoon", hrs: 2, cost: 30, area: "Toyosu", bookable: true, kids: true },
      { key: "meiji", title: "Meiji Shrine and Harajuku", description: "A forested shrine, then the creative chaos of Takeshita Street.", cats: ["culture", "shopping"], slot: "morning", hrs: 3, cost: 0, area: "Harajuku", kids: true },
      { key: "shibuya", title: "Shibuya Crossing and Sky", description: "The world's busiest crossing, then sunset from the open-air rooftop.", cats: ["culture", "nightlife"], slot: "evening", hrs: 2.5, cost: 18, area: "Shibuya", bookable: true, kids: true },
      { key: "golden-gai", title: "Golden Gai bar crawl", description: "Six alleys and some 200 tiny bars, each seating about eight people.", cats: ["nightlife"], slot: "evening", hrs: 3, cost: 50, area: "Shinjuku" },
      { key: "omakase", title: "Omakase sushi counter", description: "A chef-led tasting at a counter in Ginza.", cats: ["food"], slot: "evening", hrs: 2, cost: 180, area: "Ginza", bookable: true },
      { key: "nikko", title: "Nikko day trip", description: "Ornate Toshogu shrine, cedar forests and Kegon Falls.", cats: ["nature", "history"], slot: "morning", hrs: 9, cost: 60, area: "Nikko", kids: true },
      { key: "akihabara", title: "Akihabara", description: "Retro game shops, anime culture and multi-floor arcades.", cats: ["shopping", "family"], slot: "afternoon", hrs: 2.5, cost: 20, area: "Akihabara", kids: true },
      { key: "shinjuku-gyoen", title: "Shinjuku Gyoen", description: "Japanese, English and French gardens, best in cherry-blossom season.", cats: ["nature", "relaxation"], slot: "any", hrs: 1.5, cost: 4, area: "Shinjuku", kids: true },
      { key: "onsen", title: "Onsen and sento soak", description: "Unwind at a traditional bathhouse or a modern onsen complex.", cats: ["relaxation"], slot: "evening", hrs: 2, cost: 25, area: "Odaiba" },
      { key: "yanaka", title: "Yanaka old town walk", description: "Pre-war Tokyo: wooden houses, craft shops and temple cats.", cats: ["culture", "history"], slot: "afternoon", hrs: 2.5, cost: 0, area: "Yanaka" },
      { key: "mt-takao", title: "Hike Mount Takao", description: "An easy mountain hike an hour from the city, with Fuji views on clear days.", cats: ["nature", "adventure"], slot: "morning", hrs: 5, cost: 10, area: "Hachioji", kids: true },
      { key: "ghibli", title: "Ghibli Museum", description: "A whimsical museum of Studio Ghibli animation.", cats: ["art", "family"], slot: "afternoon", hrs: 2, cost: 10, area: "Mitaka", tip: "Tickets sell out weeks ahead.", bookable: true, kids: true },
    ],
  },
  {
    slug: "kyoto",
    name: "Kyoto",
    country: "Japan",
    aliases: ["kyoto japan"],
    airport: "OSA",
    climate: "subtropical",
    palette: ["#b45309", "#7f1d1d"],
    tagline: "Temples, tea houses and a thousand years of craft.",
    bestMonths: [3, 4, 5, 10, 11],
    areas: {
      shoestring: { name: "Kyoto Station area", why: "Budget hotels and the best transport links." },
      comfort: { name: "Downtown (Kawaramachi)", why: "Walk to Nishiki Market, Gion and the riverbank restaurants." },
      luxury: { name: "Higashiyama", why: "Ryokan and boutique stays among the temples." },
    },
    daily: {
      shoestring: { lodging: 75, food: 30, transport: 8 },
      comfort: { lodging: 190, food: 65, transport: 12 },
      luxury: { lodging: 700, food: 180, transport: 35 },
    },
    flightEst: 1150,
    eats: ["Kaiseki dinner", "Yudofu (tofu hot pot) near Nanzen-ji", "Matcha everything in Uji", "Grazing at Nishiki Market", "Obanzai home-style Kyoto cooking"],
    tips: ["Buses get crowded; combine walking with subway lines.", "Start at the big sights at opening time to beat tour groups.", "Photography of geiko and maiko in Gion's private lanes is restricted."],
    activities: [
      { key: "fushimi", title: "Fushimi Inari", description: "Hike through thousands of vermilion torii gates up Mount Inari.", cats: ["culture", "nature", "history"], slot: "morning", hrs: 3, cost: 0, area: "Fushimi", tip: "Go at 7am or near sunset.", kids: true },
      { key: "arashiyama", title: "Arashiyama bamboo grove", description: "The bamboo forest, Tenryu-ji garden and the Togetsukyo Bridge.", cats: ["nature", "culture"], slot: "morning", hrs: 4, cost: 5, area: "Arashiyama", kids: true },
      { key: "kinkakuji", title: "Kinkaku-ji (Golden Pavilion)", description: "A gold-leafed pavilion reflected in a mirror pond.", cats: ["culture", "history"], slot: "afternoon", hrs: 1.5, cost: 4, area: "Kita", kids: true },
      { key: "gion", title: "Gion evening stroll", description: "Lantern-lit Hanamikoji and Shirakawa canal at dusk.", cats: ["culture", "history"], slot: "evening", hrs: 2, cost: 0, area: "Gion" },
      { key: "tea", title: "Tea ceremony", description: "A hands-on matcha ceremony in a machiya townhouse.", cats: ["culture"], slot: "afternoon", hrs: 1.5, cost: 45, area: "Higashiyama", bookable: true, kids: true },
      { key: "kiyomizu", title: "Kiyomizu-dera and Sannenzaka", description: "The wooden-stage temple and the preserved slopes below it.", cats: ["culture", "history", "shopping"], slot: "afternoon", hrs: 3, cost: 3, area: "Higashiyama", kids: true },
      { key: "nishiki", title: "Nishiki Market", description: "\"Kyoto's kitchen\": pickles, skewers and sweets.", cats: ["food"], slot: "any", hrs: 1.5, cost: 25, area: "Downtown", kids: true },
      { key: "philosophers", title: "Philosopher's Path", description: "A canal walk linking Ginkaku-ji and Nanzen-ji.", cats: ["nature", "relaxation"], slot: "morning", hrs: 2.5, cost: 5, area: "Higashiyama", kids: true },
      { key: "nara", title: "Nara day trip", description: "Bowing deer and the giant Buddha at Todai-ji.", cats: ["history", "family"], slot: "morning", hrs: 6, cost: 20, area: "Nara", kids: true },
      { key: "kaiseki", title: "Kaiseki dinner", description: "Kyoto's seasonal multi-course haute cuisine.", cats: ["food"], slot: "evening", hrs: 2.5, cost: 150, area: "Gion", bookable: true },
      { key: "pontocho", title: "Pontocho alley bars", description: "A narrow lantern alley with riverside terraces.", cats: ["nightlife", "food"], slot: "evening", hrs: 2, cost: 40, area: "Pontocho" },
      { key: "kimono", title: "Kimono rental and photo walk", description: "Dress in kimono for a day among the temples.", cats: ["culture", "family"], slot: "morning", hrs: 4, cost: 50, area: "Higashiyama", bookable: true, kids: true },
    ],
  },
  {
    slug: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    aliases: ["lisboa", "lisbon portugal"],
    airport: "LIS",
    climate: "mediterranean",
    palette: ["#0e7490", "#facc15"],
    tagline: "Sunlit hills, tiled facades and the Atlantic.",
    bestMonths: [4, 5, 6, 9, 10],
    areas: {
      shoestring: { name: "Intendente / Arroios", why: "Up-and-coming, multicultural and well priced." },
      comfort: { name: "Chiado / Baixa", why: "Central, flat by Lisbon standards, and steps from trams and the river." },
      luxury: { name: "Príncipe Real", why: "Leafy squares, design boutiques and palace hotels." },
    },
    daily: {
      shoestring: { lodging: 70, food: 30, transport: 6 },
      comfort: { lodging: 170, food: 60, transport: 10 },
      luxury: { lodging: 480, food: 150, transport: 35 },
    },
    flightEst: 700,
    eats: ["Pastéis de nata from Manteigaria", "Bifana pork sandwiches", "Grilled sardines in Alfama (June is festa season)", "Petiscos (Portuguese tapas) with vinho verde", "Seafood feast at a cervejaria"],
    tips: ["Wear grippy shoes because the limestone pavements are slippery.", "Tram 28 is iconic but packed; ride it early or walk the route.", "The couvert (bread, olives) on the table isn't free; send it back if you don't want it."],
    activities: [
      { key: "alfama", title: "Alfama and São Jorge Castle", description: "Maze-like lanes up to the Moorish castle with views over the river.", cats: ["history", "culture"], slot: "morning", hrs: 3.5, cost: 15, area: "Alfama", kids: true },
      { key: "belem", title: "Belém monuments", description: "Jerónimos Monastery, Belém Tower and the original pastel de nata.", cats: ["history", "culture", "food"], slot: "morning", hrs: 4, cost: 20, area: "Belém", bookable: true, kids: true },
      { key: "fado", title: "Fado dinner", description: "Portugal's soulful music over dinner in a tiny Alfama tavern.", cats: ["culture", "nightlife", "food"], slot: "evening", hrs: 3, cost: 60, area: "Alfama", bookable: true },
      { key: "sintra", title: "Sintra day trip", description: "The fairy-tale Pena Palace, Quinta da Regaleira and misty forests.", cats: ["history", "nature"], slot: "morning", hrs: 8, cost: 40, area: "Sintra", tip: "Pre-book Pena Palace and take the early train from Rossio.", bookable: true, kids: true },
      { key: "lx-factory", title: "LX Factory", description: "A converted industrial complex with bookshops, street art and Sunday markets.", cats: ["shopping", "art"], slot: "afternoon", hrs: 2, cost: 0, area: "Alcântara" },
      { key: "time-out", title: "Time Out Market", description: "Lisbon's top chefs under one roof.", cats: ["food"], slot: "any", hrs: 1.5, cost: 25, area: "Cais do Sodré", kids: true },
      { key: "bairro-alto", title: "Bairro Alto night", description: "Street-drinking culture, miradouros and late bars.", cats: ["nightlife"], slot: "evening", hrs: 3, cost: 30, area: "Bairro Alto" },
      { key: "gulbenkian", title: "Gulbenkian Museum and gardens", description: "A world-class private art collection in modernist gardens.", cats: ["art", "relaxation"], slot: "afternoon", hrs: 2.5, cost: 15, area: "Avenidas Novas" },
      { key: "cascais", title: "Cascais beaches", description: "Take the coastal train to sandy coves and the Boca do Inferno cliffs.", cats: ["relaxation", "nature", "family"], slot: "afternoon", hrs: 5, cost: 10, area: "Cascais", kids: true },
      { key: "oceanario", title: "Oceanário de Lisboa", description: "One of Europe's best aquariums.", cats: ["family", "nature"], slot: "afternoon", hrs: 2.5, cost: 25, area: "Parque das Nações", bookable: true, kids: true },
      { key: "surf", title: "Surf lesson at Costa da Caparica", description: "Beginner-friendly Atlantic waves 30 minutes from the city.", cats: ["adventure"], slot: "morning", hrs: 3, cost: 50, area: "Costa da Caparica", bookable: true },
      { key: "miradouro", title: "Sunset at Miradouro da Senhora do Monte", description: "Lisbon's highest viewpoint at golden hour.", cats: ["relaxation", "culture"], slot: "evening", hrs: 1, cost: 0, area: "Graça", kids: true },
    ],
  },
  {
    slug: "rome",
    name: "Rome",
    country: "Italy",
    aliases: ["roma", "rome italy"],
    airport: "ROM",
    climate: "mediterranean",
    palette: ["#9a3412", "#fbbf24"],
    tagline: "Three thousand years of history around every corner.",
    bestMonths: [4, 5, 6, 9, 10],
    areas: {
      shoestring: { name: "Monti", why: "Bohemian, central and close to the Colosseum." },
      comfort: { name: "Centro Storico (near Piazza Navona)", why: "Walk everywhere: the Pantheon, Trevi and Campo de' Fiori." },
      luxury: { name: "Spanish Steps / Via Condotti", why: "Grand hotels, designer streets and rooftop bars." },
    },
    daily: {
      shoestring: { lodging: 95, food: 40, transport: 6 },
      comfort: { lodging: 220, food: 80, transport: 10 },
      luxury: { lodging: 650, food: 200, transport: 40 },
    },
    flightEst: 820,
    eats: ["Cacio e pepe in Trastevere", "Supplì (fried rice balls) from a takeaway counter", "Pizza al taglio by weight", "Carciofi alla giudia in the Jewish Ghetto", "Gelato from a gelateria that stores it in covered metal tins"],
    tips: ["Book Vatican and Colosseum slots a few weeks out.", "Cover shoulders and knees for churches.", "Fill up at the free nasoni drinking fountains."],
    activities: [
      { key: "colosseum", title: "Colosseum and Roman Forum", description: "The arena, Palatine Hill and the heart of ancient Rome.", cats: ["history", "culture"], slot: "morning", hrs: 4, cost: 30, area: "Monti", bookable: true, kids: true },
      { key: "vatican", title: "Vatican Museums and Sistine Chapel", description: "Raphael's Rooms, the map gallery and Michelangelo's ceiling.", cats: ["art", "history", "culture"], slot: "morning", hrs: 4, cost: 30, area: "Vatican", tip: "Book the earliest slot, then see St Peter's afterwards.", bookable: true },
      { key: "stpeters", title: "St Peter's Basilica dome climb", description: "Climb the dome for the city's best view.", cats: ["history", "culture"], slot: "afternoon", hrs: 2, cost: 15, area: "Vatican", kids: true },
      { key: "pantheon-trevi", title: "Pantheon, Navona and Trevi walk", description: "Baroque Rome's greatest hits on foot.", cats: ["history", "culture"], slot: "evening", hrs: 2.5, cost: 5, area: "Centro Storico", kids: true },
      { key: "trastevere", title: "Trastevere evening", description: "Ivy-draped lanes, trattorias and piazza life.", cats: ["food", "nightlife"], slot: "evening", hrs: 3, cost: 45, area: "Trastevere" },
      { key: "borghese", title: "Galleria Borghese", description: "Bernini sculptures and Caravaggio in an intimate villa.", cats: ["art"], slot: "afternoon", hrs: 2, cost: 25, area: "Villa Borghese", tip: "Entry is by reservation only.", bookable: true },
      { key: "pasta-class", title: "Pasta-making class", description: "Learn fettuccine and tiramisu from a Roman chef.", cats: ["food", "family"], slot: "afternoon", hrs: 3, cost: 75, area: "Centro Storico", bookable: true, kids: true },
      { key: "appian", title: "Appian Way by bike", description: "Ride the ancient road past catacombs and aqueducts.", cats: ["adventure", "history", "nature"], slot: "morning", hrs: 4, cost: 35, area: "Appia Antica", bookable: true },
      { key: "testaccio", title: "Testaccio Market food crawl", description: "Rome's working-class food quarter.", cats: ["food"], slot: "morning", hrs: 2.5, cost: 30, area: "Testaccio" },
      { key: "villa-borghese-park", title: "Villa Borghese park and Pincio terrace", description: "Rent a rowboat and catch sunset over Piazza del Popolo.", cats: ["nature", "relaxation", "family"], slot: "any", hrs: 2, cost: 5, area: "Villa Borghese", kids: true },
      { key: "aperitivo", title: "Rooftop aperitivo", description: "Spritz with dome views at sunset.", cats: ["nightlife", "relaxation"], slot: "evening", hrs: 1.5, cost: 30, area: "Spanish Steps" },
      { key: "monti-shop", title: "Monti boutiques and vintage shops", description: "Independent designers and Sunday markets.", cats: ["shopping"], slot: "afternoon", hrs: 2, cost: 0, area: "Monti" },
    ],
  },
  {
    slug: "barcelona",
    name: "Barcelona",
    country: "Spain",
    aliases: ["barcelona spain", "bcn"],
    airport: "BCN",
    climate: "mediterranean",
    palette: ["#c2410c", "#0369a1"],
    tagline: "Gaudí, beaches and dinner at 10pm.",
    bestMonths: [5, 6, 9, 10],
    areas: {
      shoestring: { name: "Gràcia", why: "A village feel, with plazas and good-value stays." },
      comfort: { name: "Eixample", why: "Modernista architecture, central and calm at night." },
      luxury: { name: "Passeig de Gràcia / Barceloneta seafront", why: "Design hotels on the city's grand boulevard or right by the beach." },
    },
    daily: {
      shoestring: { lodging: 90, food: 40, transport: 7 },
      comfort: { lodging: 210, food: 75, transport: 10 },
      luxury: { lodging: 600, food: 190, transport: 40 },
    },
    flightEst: 760,
    eats: ["Tapas crawl in El Born", "Paella by the sea in Barceloneta", "Pintxos on Carrer de Blai", "Vermut on a Sunday", "Churros con chocolate"],
    tips: ["Pickpocketing is common on Las Ramblas and the metro; use a zipped bag.", "Sagrada Família sells out, so book days ahead.", "Lunch is the big meal; menú del día deals are excellent."],
    activities: [
      { key: "sagrada", title: "Sagrada Família", description: "Gaudí's still-unfinished basilica, a forest of light inside.", cats: ["art", "culture", "history"], slot: "morning", hrs: 2, cost: 33, area: "Eixample", bookable: true, kids: true },
      { key: "park-guell", title: "Park Güell", description: "Mosaic terraces and city views.", cats: ["art", "nature"], slot: "morning", hrs: 2, cost: 12, area: "Gràcia", bookable: true, kids: true },
      { key: "gothic", title: "Gothic Quarter and El Born", description: "Roman walls, the cathedral and the Picasso Museum.", cats: ["history", "culture", "art"], slot: "afternoon", hrs: 3, cost: 15, area: "Ciutat Vella", kids: true },
      { key: "boqueria", title: "La Boqueria market", description: "Jamón, fresh juices and counter tapas.", cats: ["food"], slot: "morning", hrs: 1.5, cost: 20, area: "Las Ramblas", kids: true },
      { key: "casa-batllo", title: "Casa Batlló", description: "A building inspired by dragons and the sea.", cats: ["art", "culture"], slot: "afternoon", hrs: 1.5, cost: 35, area: "Passeig de Gràcia", bookable: true, kids: true },
      { key: "beach", title: "Barceloneta beach afternoon", description: "Sun, swims and a chiringuito beach bar.", cats: ["relaxation", "family"], slot: "afternoon", hrs: 3, cost: 10, area: "Barceloneta", kids: true },
      { key: "montjuic", title: "Montjuïc cable car and Magic Fountain", description: "The castle, gardens and the evening fountain show.", cats: ["nature", "family"], slot: "evening", hrs: 3, cost: 15, area: "Montjuïc", kids: true },
      { key: "tapas-tour", title: "Tapas and wine tour", description: "Four bars and a local guide.", cats: ["food", "nightlife"], slot: "evening", hrs: 3, cost: 95, area: "El Born", bookable: true },
      { key: "montserrat", title: "Montserrat day trip", description: "A mountain monastery and serrated peaks.", cats: ["nature", "adventure", "history"], slot: "morning", hrs: 7, cost: 45, area: "Montserrat", bookable: true, kids: true },
      { key: "bunkers", title: "Bunkers del Carmel sunset", description: "Civil War bunkers with a 360° panorama.", cats: ["nature", "history"], slot: "evening", hrs: 2, cost: 0, area: "El Carmel" },
      { key: "flamenco", title: "Flamenco show", description: "An intimate tablao performance.", cats: ["culture", "nightlife"], slot: "evening", hrs: 1.5, cost: 45, area: "Ciutat Vella", bookable: true },
      { key: "sailing", title: "Catamaran sail", description: "A sunset sail along the coast.", cats: ["adventure", "relaxation"], slot: "evening", hrs: 2, cost: 50, area: "Port Olímpic", bookable: true, kids: true },
    ],
  },
  {
    slug: "london",
    name: "London",
    country: "United Kingdom",
    aliases: ["london uk", "london england"],
    airport: "LON",
    climate: "temperate",
    palette: ["#1f2937", "#dc2626"],
    tagline: "Free museums, royal parks and a pub on every corner.",
    bestMonths: [5, 6, 7, 8, 9],
    areas: {
      shoestring: { name: "King's Cross", why: "Excellent transport links and a regenerated canal-side quarter." },
      comfort: { name: "South Bank / Southwark", why: "Riverside walks, Borough Market and Tate Modern nearby." },
      luxury: { name: "Mayfair", why: "Grand hotels between Hyde Park and the West End." },
    },
    daily: {
      shoestring: { lodging: 130, food: 45, transport: 12 },
      comfort: { lodging: 280, food: 90, transport: 15 },
      luxury: { lodging: 800, food: 230, transport: 50 },
    },
    flightEst: 700,
    eats: ["Sunday roast at a gastropub", "Borough Market grazing", "Curry on Brick Lane", "Afternoon tea", "Fish and chips"],
    tips: ["Tap a contactless card or phone on the Tube; daily fares are capped automatically.", "Most major museums are free.", "Stand on the right on escalators."],
    activities: [
      { key: "british-museum", title: "British Museum", description: "The Rosetta Stone, the Parthenon sculptures and Egyptian mummies.", cats: ["history", "culture"], slot: "morning", hrs: 3, cost: 0, area: "Bloomsbury", kids: true },
      { key: "westminster", title: "Westminster walk", description: "Big Ben, the Abbey and Buckingham Palace, through St James's Park.", cats: ["history", "culture"], slot: "morning", hrs: 3, cost: 0, area: "Westminster", kids: true },
      { key: "tower", title: "Tower of London", description: "The Crown Jewels, the Beefeaters and 1,000 years of history.", cats: ["history", "family"], slot: "morning", hrs: 3, cost: 40, area: "Tower Hill", bookable: true, kids: true },
      { key: "tate-modern", title: "Tate Modern and South Bank", description: "Modern art in a power station, then a riverside stroll.", cats: ["art", "culture"], slot: "afternoon", hrs: 3, cost: 0, area: "South Bank", kids: true },
      { key: "borough", title: "Borough Market", description: "London's oldest food market.", cats: ["food"], slot: "any", hrs: 1.5, cost: 25, area: "Southwark", kids: true },
      { key: "west-end", title: "West End show", description: "A musical or play in Theatreland.", cats: ["culture", "nightlife", "family"], slot: "evening", hrs: 3, cost: 90, area: "Covent Garden", bookable: true, kids: true },
      { key: "nhm", title: "Natural History Museum", description: "Dinosaurs and the blue whale.", cats: ["family", "nature"], slot: "afternoon", hrs: 2.5, cost: 0, area: "South Kensington", kids: true },
      { key: "shoreditch", title: "Shoreditch street art and Brick Lane", description: "Murals, vintage markets and bagels.", cats: ["art", "shopping", "food"], slot: "afternoon", hrs: 3, cost: 10, area: "Shoreditch" },
      { key: "hampstead", title: "Hampstead Heath and Kenwood", description: "Wild parkland and the Parliament Hill view.", cats: ["nature", "relaxation"], slot: "morning", hrs: 3, cost: 0, area: "Hampstead", kids: true },
      { key: "pub-crawl", title: "Historic pubs of the City", description: "Seventeenth-century taverns and Fleet Street lore.", cats: ["nightlife", "history"], slot: "evening", hrs: 3, cost: 40, area: "The City" },
      { key: "afternoon-tea", title: "Afternoon tea", description: "Scones, sandwiches and fine china.", cats: ["food", "relaxation"], slot: "afternoon", hrs: 2, cost: 70, area: "Mayfair", bookable: true, kids: true },
      { key: "camden", title: "Camden Market", description: "Alternative fashion and global street food.", cats: ["shopping", "food"], slot: "afternoon", hrs: 2.5, cost: 15, area: "Camden", kids: true },
    ],
  },
  {
    slug: "new-york",
    name: "New York",
    country: "United States",
    aliases: ["new york city", "nyc", "manhattan", "new york ny"],
    airport: "NYC",
    climate: "temperate",
    palette: ["#0f172a", "#f59e0b"],
    tagline: "The city that never sleeps, and you won't want to either.",
    bestMonths: [4, 5, 6, 9, 10, 12],
    areas: {
      shoestring: { name: "Long Island City", why: "One subway stop from Midtown, with skyline views and lower rates." },
      comfort: { name: "Lower East Side / East Village", why: "Character, nightlife and great food." },
      luxury: { name: "SoHo / Tribeca", why: "Loft hotels, galleries and designer shopping." },
    },
    daily: {
      shoestring: { lodging: 170, food: 55, transport: 12 },
      comfort: { lodging: 340, food: 110, transport: 15 },
      luxury: { lodging: 900, food: 260, transport: 60 },
    },
    flightEst: 450,
    eats: ["A bagel with schmear", "A New York slice", "Pastrami on rye at Katz's", "Dumplings in Chinatown", "Smorgasburg on a weekend"],
    tips: ["Tap to pay on the subway (OMNY); fares cap weekly.", "Plan to tip 18–22% at restaurants.", "Walk the High Line north to south to end near the Village."],
    activities: [
      { key: "central-park", title: "Central Park", description: "Bethesda Terrace, Bow Bridge and Strawberry Fields, on foot or by bike.", cats: ["nature", "relaxation", "family"], slot: "morning", hrs: 3, cost: 0, area: "Central Park", kids: true },
      { key: "met", title: "The Met", description: "Two million years of art. Pick three wings and the rooftop.", cats: ["art", "culture", "history"], slot: "afternoon", hrs: 3, cost: 30, area: "Upper East Side", bookable: true, kids: true },
      { key: "high-line", title: "High Line to Chelsea Market", description: "An elevated park walk ending in a food hall.", cats: ["nature", "food", "art"], slot: "afternoon", hrs: 2.5, cost: 15, area: "Chelsea", kids: true },
      { key: "statue", title: "Statue of Liberty and Ellis Island", description: "The ferry, the pedestal and the immigration museum.", cats: ["history", "family"], slot: "morning", hrs: 5, cost: 25, area: "Battery Park", bookable: true, kids: true },
      { key: "brooklyn-bridge", title: "Brooklyn Bridge to DUMBO", description: "Walk the bridge for the skyline, then pizza under it.", cats: ["culture", "food"], slot: "evening", hrs: 2.5, cost: 15, area: "DUMBO", kids: true },
      { key: "broadway", title: "Broadway show", description: "Theatre in the Theater District.", cats: ["culture", "nightlife", "family"], slot: "evening", hrs: 3, cost: 150, area: "Times Square", bookable: true, kids: true },
      { key: "moma", title: "MoMA", description: "Starry Night, Warhol and design.", cats: ["art"], slot: "morning", hrs: 2.5, cost: 30, area: "Midtown", bookable: true },
      { key: "top-rock", title: "Top of the Rock", description: "Observation deck with Empire State views.", cats: ["culture", "family"], slot: "evening", hrs: 1.5, cost: 45, area: "Midtown", bookable: true, kids: true },
      { key: "jazz", title: "Jazz in the Village", description: "Late sets at a historic basement club.", cats: ["nightlife", "culture"], slot: "evening", hrs: 2.5, cost: 45, area: "Greenwich Village", bookable: true },
      { key: "williamsburg", title: "Williamsburg", description: "Vintage shops, breweries and waterfront views.", cats: ["shopping", "nightlife", "food"], slot: "afternoon", hrs: 3, cost: 20, area: "Williamsburg" },
      { key: "911", title: "9/11 Memorial and Museum", description: "A moving tribute at the World Trade Center site.", cats: ["history"], slot: "morning", hrs: 2.5, cost: 35, area: "Financial District", bookable: true },
      { key: "food-tour-ny", title: "Lower East Side food tour", description: "Knishes, pickles and dumplings.", cats: ["food", "history"], slot: "afternoon", hrs: 3, cost: 85, area: "Lower East Side", bookable: true },
    ],
  },
  {
    slug: "mexico-city",
    name: "Mexico City",
    country: "Mexico",
    aliases: ["cdmx", "mexico city mexico", "ciudad de mexico"],
    airport: "MEX",
    climate: "subtropical",
    palette: ["#be185d", "#16a34a"],
    tagline: "Tacos, murals and one of the world's great art scenes.",
    bestMonths: [3, 4, 10, 11, 12],
    areas: {
      shoestring: { name: "Centro Histórico", why: "Historic, affordable and next to the big sights." },
      comfort: { name: "Roma Norte", why: "Leafy streets, cafés and the city's best restaurants." },
      luxury: { name: "Polanco", why: "Upscale hotels, fine dining and the museum district." },
    },
    daily: {
      shoestring: { lodging: 55, food: 25, transport: 5 },
      comfort: { lodging: 140, food: 55, transport: 10 },
      luxury: { lodging: 420, food: 160, transport: 35 },
    },
    flightEst: 450,
    eats: ["Tacos al pastor at a late-night taquería", "Churros at El Moro", "Mezcal tasting in Roma", "Tlacoyos at a street market", "A tasting menu at a world-famous kitchen"],
    tips: ["Use Uber or Didi rather than hailing taxis.", "Many museums close on Mondays.", "Altitude is 2,240m; take it easy on day one and hydrate."],
    activities: [
      { key: "teotihuacan", title: "Teotihuacán pyramids", description: "Climb the Pyramid of the Sun, or float over it in a balloon.", cats: ["history", "adventure"], slot: "morning", hrs: 6, cost: 30, area: "Teotihuacán", bookable: true, kids: true },
      { key: "anthro", title: "National Museum of Anthropology", description: "Aztec, Maya and Olmec treasures, including the Sun Stone.", cats: ["history", "culture"], slot: "morning", hrs: 3, cost: 6, area: "Chapultepec", kids: true },
      { key: "frida", title: "Frida Kahlo Museum and Coyoacán", description: "The Blue House, then Coyoacán's plazas.", cats: ["art", "culture"], slot: "afternoon", hrs: 3.5, cost: 15, area: "Coyoacán", bookable: true },
      { key: "zocalo", title: "Zócalo and Templo Mayor", description: "The cathedral, the Aztec ruins and the Diego Rivera murals in the Palacio Nacional.", cats: ["history", "art"], slot: "morning", hrs: 3, cost: 5, area: "Centro", kids: true },
      { key: "xochimilco", title: "Xochimilco trajinera ride", description: "Colourful boats, mariachi and floating gardens.", cats: ["culture", "family", "nightlife"], slot: "afternoon", hrs: 3, cost: 25, area: "Xochimilco", kids: true },
      { key: "taco-tour", title: "Street taco tour", description: "Al pastor, suadero and campechano with a guide.", cats: ["food"], slot: "evening", hrs: 3, cost: 60, area: "Roma / Condesa", bookable: true },
      { key: "lucha", title: "Lucha libre night", description: "Masked wrestling at Arena México.", cats: ["nightlife", "culture", "family"], slot: "evening", hrs: 2.5, cost: 25, area: "Doctores", bookable: true, kids: true },
      { key: "chapultepec", title: "Chapultepec Park and Castle", description: "A huge urban park with a hilltop castle.", cats: ["nature", "history", "family"], slot: "afternoon", hrs: 3, cost: 5, area: "Chapultepec", kids: true },
      { key: "roma-condesa", title: "Roma and Condesa stroll", description: "Art deco streets, galleries and boutiques.", cats: ["shopping", "art"], slot: "afternoon", hrs: 2.5, cost: 0, area: "Roma Norte" },
      { key: "mezcal", title: "Mezcal bar hop", description: "Small-batch mezcal tasting with a pro.", cats: ["nightlife", "food"], slot: "evening", hrs: 2.5, cost: 45, area: "Roma Norte" },
      { key: "bellas-artes", title: "Palacio de Bellas Artes", description: "Art nouveau palace, murals and folkloric ballet.", cats: ["art", "culture"], slot: "evening", hrs: 2, cost: 40, area: "Centro", bookable: true },
      { key: "cooking-mx", title: "Mexican cooking class", description: "Market tour, then make mole and tortillas.", cats: ["food", "family"], slot: "morning", hrs: 4, cost: 80, area: "Roma", bookable: true, kids: true },
    ],
  },
  {
    slug: "bali",
    name: "Bali",
    country: "Indonesia",
    aliases: ["ubud", "seminyak", "bali indonesia", "denpasar", "canggu"],
    airport: "DPS",
    climate: "tropical",
    palette: ["#047857", "#f97316"],
    tagline: "Rice terraces, temples and long beach sunsets.",
    bestMonths: [4, 5, 6, 7, 8, 9],
    areas: {
      shoestring: { name: "Canggu", why: "Surf, cafés and affordable guesthouses." },
      comfort: { name: "Ubud", why: "The cultural heart, with jungle views and wellness." },
      luxury: { name: "Uluwatu / Nusa Dua", why: "Cliff-top villas and private beaches." },
    },
    daily: {
      shoestring: { lodging: 35, food: 18, transport: 8 },
      comfort: { lodging: 110, food: 40, transport: 20 },
      luxury: { lodging: 450, food: 120, transport: 60 },
    },
    flightEst: 1250,
    eats: ["Babi guling (suckling pig) in Ubud", "Nasi campur at a warung", "Fresh seafood on Jimbaran Bay", "Smoothie bowls in Canggu", "A Balinese cooking class feast"],
    tips: ["Hire a driver for the day (~$45) rather than renting a scooter if you're inexperienced.", "Wear a sarong at temples; they're often lent at the entrance.", "Nyepi (Day of Silence) shuts the island down for a day, usually in March."],
    activities: [
      { key: "tegallalang", title: "Tegallalang rice terraces", description: "Emerald terraces at sunrise.", cats: ["nature"], slot: "morning", hrs: 2.5, cost: 5, area: "Ubud", kids: true },
      { key: "monkey-forest", title: "Sacred Monkey Forest", description: "Temple ruins in a jungle full of macaques.", cats: ["nature", "family"], slot: "morning", hrs: 1.5, cost: 6, area: "Ubud", tip: "Hide sunglasses and snacks.", kids: true },
      { key: "uluwatu", title: "Uluwatu Temple and Kecak dance", description: "A cliff-top temple and fire dance at sunset.", cats: ["culture", "history"], slot: "evening", hrs: 3, cost: 15, area: "Uluwatu", bookable: true, kids: true },
      { key: "batur", title: "Mount Batur sunrise trek", description: "Hike an active volcano in the dark for sunrise.", cats: ["adventure", "nature"], slot: "morning", hrs: 7, cost: 50, area: "Kintamani", bookable: true },
      { key: "tirta", title: "Tirta Empul water temple", description: "A purification ritual in holy springs.", cats: ["culture", "history"], slot: "morning", hrs: 2, cost: 4, area: "Tampaksiring" },
      { key: "spa", title: "Balinese massage and spa", description: "Two hours of Balinese bliss.", cats: ["relaxation"], slot: "afternoon", hrs: 2, cost: 35, area: "Ubud", bookable: true },
      { key: "surf-bali", title: "Surf lesson", description: "Beginner waves at Kuta or Canggu.", cats: ["adventure"], slot: "morning", hrs: 2.5, cost: 35, area: "Canggu", bookable: true, kids: true },
      { key: "nusa-penida", title: "Nusa Penida day trip", description: "Kelingking cliffs, manta rays and snorkelling.", cats: ["nature", "adventure"], slot: "morning", hrs: 10, cost: 75, area: "Nusa Penida", bookable: true },
      { key: "beach-club", title: "Beach club sunset", description: "Infinity pools and DJ sets.", cats: ["nightlife", "relaxation"], slot: "evening", hrs: 3, cost: 40, area: "Seminyak" },
      { key: "cooking-bali", title: "Balinese cooking class", description: "Market visit and a full spread.", cats: ["food", "family"], slot: "morning", hrs: 4, cost: 35, area: "Ubud", bookable: true, kids: true },
      { key: "ubud-art", title: "Ubud art market and galleries", description: "Woodcarving, batik and painting villages.", cats: ["art", "shopping"], slot: "afternoon", hrs: 2.5, cost: 0, area: "Ubud" },
      { key: "tanah-lot", title: "Tanah Lot sunset", description: "A sea temple on a rock at golden hour.", cats: ["culture", "nature"], slot: "evening", hrs: 2, cost: 5, area: "Tabanan", kids: true },
    ],
  },
  {
    slug: "bangkok",
    name: "Bangkok",
    country: "Thailand",
    aliases: ["bangkok thailand", "krung thep"],
    airport: "BKK",
    climate: "tropical",
    palette: ["#a16207", "#7c3aed"],
    tagline: "Golden temples, river life and street food at 2am.",
    bestMonths: [11, 12, 1, 2],
    areas: {
      shoestring: { name: "Banglamphu (near Khao San)", why: "Cheap stays, walkable to the Grand Palace." },
      comfort: { name: "Sukhumvit (Asok / Phrom Phong)", why: "On the BTS line with great dining." },
      luxury: { name: "Riverside", why: "Iconic hotels with boat shuttles." },
    },
    daily: {
      shoestring: { lodging: 35, food: 15, transport: 5 },
      comfort: { lodging: 110, food: 40, transport: 10 },
      luxury: { lodging: 400, food: 130, transport: 35 },
    },
    flightEst: 1100,
    eats: ["Pad thai and boat noodles from street stalls", "Mango sticky rice", "Michelin-listed street food on Yaowarat", "Som tam (papaya salad)", "Khao soi"],
    tips: ["Dress modestly for temples, with shoulders and knees covered.", "Use the BTS, MRT and river boats to dodge traffic.", "Ignore anyone who says the Grand Palace is 'closed today'; it's a common scam."],
    activities: [
      { key: "grand-palace", title: "Grand Palace and Wat Phra Kaew", description: "The Emerald Buddha and royal splendour.", cats: ["history", "culture"], slot: "morning", hrs: 3, cost: 15, area: "Rattanakosin", kids: true },
      { key: "wat-pho", title: "Wat Pho and Thai massage", description: "The reclining Buddha, plus a massage at the temple's famous school.", cats: ["culture", "relaxation"], slot: "afternoon", hrs: 2.5, cost: 20, area: "Rattanakosin", kids: true },
      { key: "wat-arun", title: "Wat Arun at sunset", description: "The Temple of Dawn, reached by a cross-river ferry.", cats: ["culture", "history"], slot: "evening", hrs: 1.5, cost: 5, area: "Thonburi", kids: true },
      { key: "chinatown", title: "Yaowarat street food", description: "Chinatown's neon food mile.", cats: ["food", "nightlife"], slot: "evening", hrs: 3, cost: 25, area: "Chinatown", kids: true },
      { key: "floating", title: "Floating market", description: "Damnoen Saduak or local Khlong Lat Mayom.", cats: ["food", "culture"], slot: "morning", hrs: 5, cost: 30, area: "Outskirts", bookable: true, kids: true },
      { key: "chatuchak", title: "Chatuchak Weekend Market", description: "15,000 stalls of everything.", cats: ["shopping", "food"], slot: "morning", hrs: 3, cost: 0, area: "Chatuchak", tip: "Saturdays and Sundays only.", kids: true },
      { key: "rooftop", title: "Rooftop bar", description: "Skyline cocktails high above the city.", cats: ["nightlife"], slot: "evening", hrs: 2, cost: 40, area: "Silom" },
      { key: "ayutthaya", title: "Ayutthaya day trip", description: "The ruined former capital by bike.", cats: ["history", "adventure"], slot: "morning", hrs: 8, cost: 40, area: "Ayutthaya", bookable: true },
      { key: "muay-thai", title: "Muay Thai fight night", description: "Live bouts at a historic stadium.", cats: ["nightlife", "culture"], slot: "evening", hrs: 3, cost: 60, area: "Pathum Wan", bookable: true },
      { key: "lumphini", title: "Lumphini Park", description: "Monitor lizards, paddle boats and tai chi.", cats: ["nature", "relaxation", "family"], slot: "morning", hrs: 1.5, cost: 0, area: "Silom", kids: true },
      { key: "thai-cooking", title: "Thai cooking class", description: "Curry pastes from scratch.", cats: ["food", "family"], slot: "afternoon", hrs: 4, cost: 40, area: "Silom", bookable: true, kids: true },
      { key: "jim-thompson", title: "Jim Thompson House", description: "Teak houses and a silk-trade mystery.", cats: ["art", "history"], slot: "afternoon", hrs: 1.5, cost: 7, area: "Pathum Wan" },
    ],
  },
  {
    slug: "marrakech",
    name: "Marrakech",
    country: "Morocco",
    aliases: ["marrakesh", "marrakech morocco"],
    airport: "RAK",
    climate: "desert",
    palette: ["#b91c1c", "#ea580c"],
    tagline: "Souks, riads and the edge of the Sahara.",
    bestMonths: [3, 4, 5, 10, 11],
    areas: {
      shoestring: { name: "Medina riad (near Jemaa el-Fnaa)", why: "Authentic courtyard guesthouses at great prices." },
      comfort: { name: "Medina riad (Mouassine)", why: "Quieter lanes with design riads and rooftop terraces." },
      luxury: { name: "Hivernage / Palmeraie", why: "Palace hotels, big pools and gardens." },
    },
    daily: {
      shoestring: { lodging: 45, food: 20, transport: 5 },
      comfort: { lodging: 130, food: 45, transport: 12 },
      luxury: { lodging: 500, food: 140, transport: 45 },
    },
    flightEst: 700,
    eats: ["Tagine and couscous in a riad", "Grilled meats at the Jemaa el-Fnaa food stalls", "Mint tea on a rooftop terrace", "Msemen pancakes for breakfast", "Tanjia, the city's slow-cooked specialty"],
    tips: ["Agree taxi fares before you set off.", "Haggling is expected in the souks; start around a third of the asking price.", "Politely decline unofficial 'guides' in the medina."],
    activities: [
      { key: "jemaa", title: "Jemaa el-Fnaa at dusk", description: "Storytellers, musicians and smoke from the food stalls.", cats: ["culture", "food", "nightlife"], slot: "evening", hrs: 2.5, cost: 15, area: "Medina", kids: true },
      { key: "souks", title: "Souk wander", description: "Spices, lanterns, leather and carpets.", cats: ["shopping", "culture"], slot: "afternoon", hrs: 3, cost: 0, area: "Medina", kids: true },
      { key: "majorelle", title: "Jardin Majorelle and YSL Museum", description: "Cobalt-blue villa and cactus gardens.", cats: ["art", "nature"], slot: "morning", hrs: 2, cost: 20, area: "Gueliz", bookable: true, kids: true },
      { key: "bahia", title: "Bahia Palace", description: "Zellige tilework and painted cedar ceilings.", cats: ["history", "art"], slot: "morning", hrs: 1.5, cost: 8, area: "Kasbah", kids: true },
      { key: "hammam", title: "Traditional hammam", description: "Steam, black soap and a gommage scrub.", cats: ["relaxation"], slot: "afternoon", hrs: 2, cost: 40, area: "Medina", bookable: true },
      { key: "atlas", title: "Atlas Mountains day trip", description: "Berber villages and waterfalls in the Ourika Valley.", cats: ["nature", "adventure"], slot: "morning", hrs: 8, cost: 45, area: "Ourika", bookable: true, kids: true },
      { key: "agafay", title: "Agafay desert sunset and dinner", description: "Camel ride and a dinner under the stars.", cats: ["adventure", "nightlife"], slot: "evening", hrs: 5, cost: 65, area: "Agafay", bookable: true, kids: true },
      { key: "cooking-ma", title: "Moroccan cooking class", description: "Tagine, bread and pastilla.", cats: ["food", "family"], slot: "morning", hrs: 4, cost: 55, area: "Medina", bookable: true, kids: true },
      { key: "ben-youssef", title: "Ben Youssef Madrasa", description: "A breathtaking fourteenth-century Islamic college.", cats: ["history", "art"], slot: "morning", hrs: 1.5, cost: 6, area: "Medina" },
      { key: "balloon", title: "Hot-air balloon at sunrise", description: "Drift over the palm groves and the Atlas foothills.", cats: ["adventure"], slot: "morning", hrs: 4, cost: 200, area: "Palmeraie", bookable: true },
      { key: "rooftop-ma", title: "Rooftop dinner", description: "Sunset over the Koutoubia minaret.", cats: ["food", "relaxation"], slot: "evening", hrs: 2, cost: 40, area: "Medina" },
    ],
  },
  {
    slug: "reykjavik",
    name: "Reykjavík",
    country: "Iceland",
    aliases: ["reykjavik", "iceland", "reykjavík iceland"],
    airport: "REK",
    climate: "cold",
    palette: ["#0f766e", "#6366f1"],
    tagline: "Glaciers, geysers and the northern lights.",
    bestMonths: [6, 7, 8, 9, 2, 3],
    areas: {
      shoestring: { name: "Hlemmur", why: "Bus-hub convenience and the food hall." },
      comfort: { name: "Downtown (Laugavegur)", why: "Walk to everything, with tour pickups nearby." },
      luxury: { name: "Harbour / Old Town", why: "Design hotels with sea and mountain views." },
    },
    daily: {
      shoestring: { lodging: 150, food: 55, transport: 15 },
      comfort: { lodging: 280, food: 100, transport: 30 },
      luxury: { lodging: 700, food: 220, transport: 80 },
    },
    flightEst: 600,
    eats: ["Hot dog from Bæjarins Beztu", "Lamb soup", "Fresh langoustine", "Skyr everything", "Geothermal rye bread"],
    tips: ["Book a rental car early for the Ring Road.", "Weather changes fast; check road.is and safetravel.is daily.", "Tap water is excellent; skip bottled."],
    activities: [
      { key: "golden-circle", title: "Golden Circle", description: "Þingvellir, Geysir and Gullfoss in one loop.", cats: ["nature", "adventure"], slot: "morning", hrs: 8, cost: 90, area: "South Iceland", bookable: true, kids: true },
      { key: "blue-lagoon", title: "Blue Lagoon", description: "The milky-blue geothermal spa.", cats: ["relaxation"], slot: "afternoon", hrs: 3, cost: 90, area: "Grindavík", bookable: true, kids: true },
      { key: "sky-lagoon", title: "Sky Lagoon", description: "An infinity-edge lagoon and the seven-step ritual.", cats: ["relaxation"], slot: "evening", hrs: 2.5, cost: 80, area: "Kópavogur", bookable: true },
      { key: "northern-lights", title: "Northern lights hunt", description: "Chase the aurora away from city lights (September–April).", cats: ["nature", "adventure"], slot: "evening", hrs: 4, cost: 80, area: "Countryside", bookable: true, kids: true },
      { key: "south-coast", title: "South Coast waterfalls and black sand", description: "Seljalandsfoss, Skógafoss and Reynisfjara.", cats: ["nature"], slot: "morning", hrs: 10, cost: 110, area: "Vík", bookable: true, kids: true },
      { key: "whale", title: "Whale watching", description: "Humpbacks and minke whales from the Old Harbour.", cats: ["nature", "family"], slot: "afternoon", hrs: 3, cost: 95, area: "Old Harbour", bookable: true, kids: true },
      { key: "hallgrims", title: "Hallgrímskirkja tower", description: "The basalt-inspired church with city views.", cats: ["culture"], slot: "morning", hrs: 1, cost: 10, area: "Downtown", kids: true },
      { key: "harpa", title: "Harpa and harbour walk", description: "The glass concert hall and the Sun Voyager sculpture.", cats: ["art", "culture"], slot: "afternoon", hrs: 2, cost: 0, area: "Harbour", kids: true },
      { key: "glacier", title: "Glacier hike", description: "Crampons on Sólheimajökull glacier.", cats: ["adventure", "nature"], slot: "morning", hrs: 6, cost: 130, area: "Sólheimajökull", bookable: true },
      { key: "silfra", title: "Snorkel Silfra fissure", description: "Snorkel between two continental plates.", cats: ["adventure"], slot: "morning", hrs: 4, cost: 170, area: "Þingvellir", bookable: true },
      { key: "bar-crawl-is", title: "Laugavegur bar crawl", description: "Happy hours and live music.", cats: ["nightlife"], slot: "evening", hrs: 3, cost: 50, area: "Downtown" },
    ],
  },
  {
    slug: "cape-town",
    name: "Cape Town",
    country: "South Africa",
    aliases: ["cape town south africa", "capetown"],
    airport: "CPT",
    climate: "mediterranean",
    palette: ["#1d4ed8", "#d97706"],
    tagline: "Mountains, wine country and two oceans.",
    bestMonths: [10, 11, 12, 1, 2, 3, 4],
    areas: {
      shoestring: { name: "Gardens / Tamboerskloof", why: "Central, with guesthouses under Table Mountain." },
      comfort: { name: "Sea Point / Green Point", why: "Promenade sunsets and close to the Waterfront." },
      luxury: { name: "Camps Bay / V&A Waterfront", why: "Beachfront villas and five-star harbour hotels." },
    },
    daily: {
      shoestring: { lodging: 55, food: 25, transport: 10 },
      comfort: { lodging: 150, food: 55, transport: 20 },
      luxury: { lodging: 500, food: 150, transport: 60 },
    },
    flightEst: 1300,
    eats: ["A braai (barbecue)", "Cape Malay curry in Bo-Kaap", "Fish and chips at Kalk Bay harbour", "Winelands tasting lunch", "Gatsby sandwich"],
    tips: ["Use Uber at night.", "Book Table Mountain's cableway online and check the wind forecast first.", "Load-shedding (power cuts) can still happen; most hotels have backup."],
    activities: [
      { key: "table-mountain", title: "Table Mountain", description: "The cableway up, or hike Platteklip Gorge.", cats: ["nature", "adventure"], slot: "morning", hrs: 4, cost: 25, area: "Table Mountain", bookable: true, kids: true },
      { key: "cape-point", title: "Cape Point and Boulders penguins", description: "The Chapman's Peak drive, penguins and the Cape of Good Hope.", cats: ["nature", "family"], slot: "morning", hrs: 9, cost: 40, area: "Cape Peninsula", bookable: true, kids: true },
      { key: "winelands", title: "Stellenbosch and Franschhoek wine day", description: "Cape Dutch estates and tastings.", cats: ["food", "relaxation"], slot: "morning", hrs: 8, cost: 70, area: "Winelands", bookable: true },
      { key: "robben", title: "Robben Island", description: "Nelson Mandela's prison, guided by former inmates.", cats: ["history"], slot: "morning", hrs: 4, cost: 35, area: "V&A Waterfront", bookable: true },
      { key: "bo-kaap", title: "Bo-Kaap walk and cooking class", description: "Colourful houses and Cape Malay cuisine.", cats: ["culture", "food"], slot: "afternoon", hrs: 3, cost: 50, area: "Bo-Kaap", bookable: true },
      { key: "lions-head", title: "Lion's Head sunset hike", description: "Chains, ladders and a 360° sunset.", cats: ["adventure", "nature"], slot: "evening", hrs: 3, cost: 0, area: "Signal Hill" },
      { key: "kirstenbosch", title: "Kirstenbosch Gardens", description: "The canopy walkway and summer concerts.", cats: ["nature", "relaxation", "family"], slot: "afternoon", hrs: 2.5, cost: 15, area: "Newlands", kids: true },
      { key: "zeitz", title: "Zeitz MOCAA", description: "Contemporary African art in a grain silo.", cats: ["art"], slot: "afternoon", hrs: 2, cost: 15, area: "V&A Waterfront" },
      { key: "camps-bay", title: "Camps Bay beach", description: "Twelve Apostles views and a sundowner.", cats: ["relaxation", "nightlife"], slot: "afternoon", hrs: 3, cost: 10, area: "Camps Bay", kids: true },
      { key: "shark", title: "Shark-cage diving", description: "Great whites in Gansbaai.", cats: ["adventure"], slot: "morning", hrs: 10, cost: 180, area: "Gansbaai", bookable: true },
      { key: "bree", title: "Bree Street dining", description: "The city's restaurant row.", cats: ["food", "nightlife"], slot: "evening", hrs: 2.5, cost: 45, area: "City Bowl" },
    ],
  },
];

/** Normalize a free-text city name for matching. */
export function normalizeCity(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findDestination(input: string): Destination | undefined {
  const q = normalizeCity(input);
  if (!q) return undefined;
  return (
    DESTINATIONS.find((d) => normalizeCity(d.name) === q || d.aliases.some((a) => normalizeCity(a) === q)) ??
    DESTINATIONS.find(
      (d) => q.startsWith(normalizeCity(d.name)) || d.aliases.some((a) => q.startsWith(normalizeCity(a))),
    )
  );
}
