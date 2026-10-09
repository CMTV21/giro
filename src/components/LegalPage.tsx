import Link from "next/link";

export const LAST_UPDATED = "October 9, 2026";

/** Where privacy and legal questions go. Set CONTACT_EMAIL in the environment before launch. */
export function contactEmail(): string | undefined {
  return process.env.CONTACT_EMAIL?.trim() || undefined;
}

export function Contact() {
  const email = contactEmail();
  return email ? <a href={`mailto:${email}`}>{email}</a> : <span>our privacy contact (a dedicated address will be published here before public launch)</span>;
}

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-muted">Last updated {LAST_UPDATED}</p>
      <p className="mt-6 text-lg text-ink-soft">{intro}</p>
      <div className="legal mt-4">{children}</div>
      <nav className="mt-12 flex flex-wrap gap-4 border-t border-line pt-6 text-sm">
        <Link href="/privacy" className="text-ink-soft hover:text-ink">Privacy Policy</Link>
        <Link href="/terms" className="text-ink-soft hover:text-ink">Terms of Use</Link>
        <Link href="/affiliate-disclosure" className="text-ink-soft hover:text-ink">Affiliate Disclosure</Link>
      </nav>
    </div>
  );
}
