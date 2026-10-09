import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted">
            Trips, curated. Giro turns a few details into a day-by-day plan, then hands you off to the best places to book it.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Plan</p>
          <Link className="block text-muted hover:text-ink" href="/plan">Trip planner</Link>
          <Link className="block text-muted hover:text-ink" href="/explore">Explore destinations</Link>
          <Link className="block text-muted hover:text-ink" href="/trips">My trips</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Book with</p>
          <p className="text-muted">Google Flights · Expedia · Skyscanner · Kayak · Airbnb · Booking.com · Vrbo · GetYourGuide · Viator</p>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted sm:px-6">
          Prices are estimates. Booking happens on partner sites, and Giro may earn a commission at no extra cost to you. © {new Date().getFullYear()} Giro.
        </p>
      </div>
    </footer>
  );
}
