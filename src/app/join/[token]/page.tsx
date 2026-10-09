import type { Metadata } from "next";
import { JoinTrip } from "@/components/JoinTrip";

export const metadata: Metadata = { title: "Join a trip", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <JoinTrip token={(await params).token} />;
}
