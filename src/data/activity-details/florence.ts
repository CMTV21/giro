import type { ActivityDetails } from "../../lib/activity-details.ts";

export const DETAILS: Record<string, ActivityDetails> = {
  "uffizi": {
    about: "The Uffizi is one of the world's great Renaissance collections, set in a long Medici-era building beside the Arno. Rooms are arranged by period and lead to Botticelli's Birth of Venus and Primavera, works by Leonardo, Michelangelo and Raphael, and Caravaggio's later canvases. Allow a full three hours, and pick a few rooms rather than trying to see everything.",
    bestTime: "Go first thing in the morning or in the last hours before closing, when crowds thin. Midday in summer is the most crowded and warmest.",
    tickets: "Paid, around 25 to 30 euros, with a booking fee for reserved slots. Timed tickets sell out in high season, so book online well ahead and check the official site before you go.",
    access: "The museum has lifts to the upper floors and is step-free for most visitors. The galleries are long, so expect a lot of walking and standing.",
  },
  "david": {
    about: "The Accademia houses Michelangelo's David, carved from a single block of marble in the early 16th century. You see it at the end of a hall flanked by his unfinished Prisoners, which show how he worked the stone. The rest of the museum is small, with early Florentine paintings and musical instruments.",
    bestTime: "Early morning or late afternoon slots are quietest. The visit is short, so it pairs easily with the nearby San Marco convent or the Duomo.",
    tickets: "Paid, around 15 to 25 euros including booking fees. Timed tickets are essential in busy seasons, so reserve ahead online and check the official site before you go.",
    access: "The museum is compact and mostly step-free. Strollers are workable, and David is displayed under a dome, so the main viewing area is easy to reach.",
  },
  "duomo": {
    about: "The red-tiled dome of the cathedral, built by Brunelleschi, dominates the skyline. The climb leads through the narrow passage between the inner and outer shells, past close views of the painted Last Judgment frescoes, to a lookout across Florence. The cathedral complex also includes Giotto's bell tower, the baptistery and a museum.",
    bestTime: "Book the first slot of the day, when the stairwell is cooler and less crowded. Avoid the middle of hot summer days.",
    tickets: "Paid, around 30 to 40 euros for a pass covering the dome and the other cathedral sites. Slots are timed and sell out, so book ahead and check the official site before you go.",
    access: "The dome has 463 steps, narrow and steep, with no lift. It is not suitable for strollers, wheelchairs or anyone with claustrophobia or limited mobility.",
  },
  "chianti": {
    about: "Chianti is the rolling wine country between Florence and Siena, dotted with cypress-lined roads, stone villages and family estates. A day trip typically visits a few wineries for tastings of Chianti Classico and ends with a long Tuscan lunch. It is as much about the scenery and the pace as the wine.",
    bestTime: "Spring and early autumn are the most pleasant, with harvest season in September and October. Weekdays are quieter at the estates.",
    tickets: "Paid, around 80 to 150 euros for a guided day, often including tastings and lunch. Book ahead, and check the operator's official site before you go.",
    access: "Most estates have gravel paths and a few steps into cellars. The day involves long minibus rides on winding roads.",
  },
  "piazzale": {
    about: "Piazzale Michelangelo is a terraced lookout on a hill south of the Arno, with a copy of David at its centre. The view takes in the red roofs, the Duomo and the Ponte Vecchio, and glows at sunset. Locals and visitors gather on the steps with drinks and music.",
    bestTime: "Arrive about an hour before sunset to claim a spot. Early morning is almost empty if you prefer a quiet look.",
    tickets: "Free. A drink at the café or a trip by bus or taxi costs extra, and you can walk up from the river via the rose garden.",
    access: "The final approach is a steady uphill walk with stairs, though buses and taxis reach the square. The terrace itself is paved and level.",
  },
  "mercato-centrale": {
    about: "The market hall in San Lorenzo has traditional butchers, cheese counters, produce stalls and fishmongers on the ground floor. Upstairs, a modern food hall serves pasta, pizza, burgers, gelato and Tuscan specialties at communal tables. Try lampredotto, the Florentine tripe sandwich, if you are feeling bold.",
    bestTime: "Go at lunchtime for the best atmosphere, or early for the traditional market stalls. The upstairs hall gets busy in the evening.",
    tickets: "Free to enter, with food priced per stall. Plan on around 10 to 20 euros for a meal, and check the official site before you go for current hours.",
    access: "The hall has lifts and is step-free inside. It can be crowded, and tables are shared.",
  },
  "boboli": {
    about: "Palazzo Pitti is a vast Renaissance palace that once housed the Medici, with grand apartments and the Palatine Gallery of paintings. Behind it, the Boboli Gardens climb a hillside of terraced lawns, fountains, grottoes and statues. The garden offers shaded paths and views back across Florence.",
    bestTime: "Go in the morning for cooler walking in the gardens, and save the palace for the hotter part of the day. Spring and early autumn are especially pleasant.",
    tickets: "Paid, around 15 to 25 euros depending on which sites you include. Book ahead in peak season and check the official site before you go.",
    access: "The gardens are on a hill with gravel paths and many slopes and steps. The palace has lifts to some floors.",
  },
  "oltrarno-artisans": {
    about: "The Oltrarno, on the south side of the river, is the traditional home of Florentine craftspeople. Small workshops make leather goods, marbled paper, bookbinding, furniture restoration and jewellery. Many studios let you watch the work, and some welcome visitors by appointment.",
    bestTime: "Go on weekday mornings or afternoons, since many workshops close on Sundays. Pause for lunch in Santo Spirito.",
    tickets: "Free to browse. Buying a piece or taking a short workshop costs extra, and prices vary by craft.",
    access: "Streets are flat but cobbled and often narrow, with many step-up shop entrances. Be mindful in small studios with delicate items.",
  },
  "cooking-fl": {
    about: "A Tuscan cooking class teaches fresh pasta by hand, plus a dessert such as tiramisù, usually guided by a local chef. Many start with a market visit for ingredients and finish with a shared meal and wine. It is hands-on and a good fit for groups.",
    bestTime: "Morning classes include market visits, and evening classes end with dinner. Book early in spring and autumn.",
    tickets: "Paid, around 70 to 120 euros per person, usually including food and wine. Reserve ahead and check the provider's official site before you go.",
    access: "Classes are mostly standing at a counter in a kitchen. Ask about dietary needs and step-free access when booking.",
  },
  "pisa-siena": {
    about: "A day trip takes you through the Tuscan countryside to Siena, with its shell-shaped Piazza del Campo and striped cathedral, and to San Gimignano, a hill town of medieval towers. Lanes are lined with wine shops, gelaterias and views across the vineyards. It is a good way to see two very different hill towns in one day.",
    bestTime: "Start early to arrive before the crowds, particularly in summer. Spring and autumn are the most comfortable seasons.",
    tickets: "Paid, around 60 to 100 euros for a guided day trip. Entry to the cathedral or towers is extra, so book ahead and check the official sites before you go.",
    access: "Both towns are hilly with steep cobbled streets and stairs. A day of walking in uneven terrain is tiring for small children.",
  },
  "wine-bar": {
    about: "Santo Spirito is the lively square in the Oltrarno where small enotecas serve Tuscan reds by the glass with crostini, cheeses and cured meats. The scene is relaxed, with people spilling out onto the piazza. It is a good way to spend an evening without a formal dinner.",
    bestTime: "Come in the early evening for aperitivo, when it is easiest to find a table. Summer evenings are the liveliest.",
    tickets: "No entry charge. A glass of wine is around 5 to 10 euros, and a tasting plate is a few euros more.",
    access: "The square is flat and cobbled. Some small bars have steps at the entrance and tight interiors.",
  },
};
