import type { Metadata } from "next";
import { ResetForm } from "@/components/AccountFlows";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-2 mb-8 text-ink-soft">Pick something you haven&apos;t used before.</p>
      <ResetForm token={(await params).token} />
    </div>
  );
}
