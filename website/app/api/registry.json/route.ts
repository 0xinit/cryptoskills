import { NextResponse } from "next/server";
import { getRegistry } from "@/lib/registry";

export function GET() {
  const registry = getRegistry();
  return NextResponse.json(registry);
}
