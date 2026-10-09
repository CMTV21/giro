import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-display text-4xl font-semibold">Off the map</h1>
      <p className="mt-2 text-muted">That page doesn&apos;t exist, but plenty of great places do.</p>
      <Link href="/plan" className="btn-primary mt-6">Plan a trip</Link>
    </div>
  );
}
