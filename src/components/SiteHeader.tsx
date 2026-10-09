import Link from "next/link";
import { Logo } from "./Logo";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/trips", label: "My trips" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Giro home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-ink">
              {item.label}
            </Link>
          ))}
          <Link href="/plan" className="btn-dark ml-1 px-4 py-2">
            Plan a trip
          </Link>
        </nav>
      </div>
    </header>
  );
}
