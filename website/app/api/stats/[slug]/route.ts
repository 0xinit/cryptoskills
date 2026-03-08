import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { getSkillBySlug } from "@/lib/registry";

type Params = Promise<{ slug: string }>;

export async function POST(
  request: Request,
  { params }: { params: Params }
): Promise<NextResponse> {
  const { slug } = await params;

  if (!getSkillBySlug(slug)) {
    return NextResponse.json({ error: "Unknown skill" }, { status: 404 });
  }

  let body: { type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type !== "view" && body.type !== "download") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const key = body.type === "view" ? `views:${slug}` : `downloads:${slug}`;
  const count = await redis.incr(key);

  return NextResponse.json({ count });
}
