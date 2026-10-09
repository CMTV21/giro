import type { Metadata } from "next";
import { AccountView } from "@/components/AccountView";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="eyebrow">Account</p>
      <h1 className="mt-3 mb-8 font-display text-4xl font-semibold tracking-tight sm:text-5xl">You, as a traveller</h1>
      <AccountView />
    </div>
  );
}
