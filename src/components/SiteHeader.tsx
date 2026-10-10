import Link from "next/link";
import { AccountNav } from "./AccountNav";
import { Logo } from "./Logo";

// Phones show the essentials; the rest appear from the small breakpoint up.
const NAV = [
  { href: "/discover", label: "Discover", phone: true },
  { href: "/guides", label: "Guides", phone: false },
  { href: "/explore", label: "Explore", phone: false },
  { href: "/trips", label: "My trips", phone: true },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" aria-label="Giro home" className="shrink-0">
          <Logo />
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`rounded-full px-2.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-ink sm:px-3 ${item.phone ? "" : "hidden sm:block"}`}>
              {item.label}
            </Link>
          ))}
          <Link href="/plan" className="btn-dark ml-1 px-3.5 py-2 sm:px-4">
            <span className="sm:hidden">Plan</span>
            <span className="hidden sm:inline">Plan a trip</span>
          </Link>
          <AccountNav />
        </nav>
      </div>
    </header>
  );
}
