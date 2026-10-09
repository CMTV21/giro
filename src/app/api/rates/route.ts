import { NextResponse } from "next/server";
import { getRates } from "@/lib/rates.server";

export const revalidate = 43200;

export async function GET() {
  return NextResponse.json(await getRates());
}
