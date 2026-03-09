import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { getAllSkills } from "@/lib/registry";
import type { SkillStats } from "@/lib/registry";

export async function GET(): Promise<NextResponse> {
  const redis = getRedis();
  if (!redis) return NextResponse.json({});

  const skills = getAllSkills();
  const slugs = skills.map((s) => s.name);

  if (slugs.length === 0) {
    return NextResponse.json({});
  }

  const viewKeys = slugs.map((s) => `views:${s}`);
  const downloadKeys = slugs.map((s) => `downloads:${s}`);

  const pipeline = redis.pipeline();
  pipeline.mget<(number | null)[]>(...viewKeys);
  pipeline.mget<(number | null)[]>(...downloadKeys);
  const [views, downloads] = await pipeline.exec<[(number | null)[], (number | null)[]]>();

  const result: Record<string, SkillStats> = {};
  for (let i = 0; i < slugs.length; i++) {
    const v = views[i] ?? 0;
    const d = downloads[i] ?? 0;
    if (v > 0 || d > 0) {
      result[slugs[i]] = { views: v, downloads: d };
    }
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    },
  });
}
