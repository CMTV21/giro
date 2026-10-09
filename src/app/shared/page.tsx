import type { Metadata } from "next";
import { SharedImport } from "@/components/SharedImport";

export const metadata: Metadata = { title: "Shared trip" };

export default function SharedPage() {
  return <SharedImport />;
}
