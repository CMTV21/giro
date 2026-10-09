import type { Metadata } from "next";
import { ForgotForm } from "@/components/AccountFlows";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-2 mb-8 text-ink-soft">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <ForgotForm />
    </div>
  );
}
