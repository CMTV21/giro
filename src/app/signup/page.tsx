import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create an account" };

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Plan together, everywhere.</h1>
      <p className="mt-2 mb-8 text-ink-soft">Save trips to every device, invite friends, split costs, and let Giro learn your taste.</p>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-sand" />}>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
