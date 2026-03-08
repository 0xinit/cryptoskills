import { NextResponse } from "next/server";
import { getAllSkills } from "@/lib/registry";
import { getSkillContent } from "@/lib/skills";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllSkills().map((skill) => ({ slug: skill.name }));
}

export function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  return params.then(({ slug }) => {
    const content = getSkillContent(slug);
    if (!content) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-SKILL.md"`,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  });
}
