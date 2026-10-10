/** Calendar app links for a live feed. Google takes the webcal address; Outlook takes https. */
export function calendarLinks(feedUrl: string, title: string) {
  const webcal = feedUrl.replace(/^https?:/, "webcal:");
  return {
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    apple: webcal,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent(title)}`,
  };
}
