import type { Metadata } from "next";
import { VerifyEmail } from "@/components/AccountFlows";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false }, referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <VerifyEmail token={(await params).token} />
    </div>
  );
}
