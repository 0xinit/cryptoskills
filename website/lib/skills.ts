import * as fs from "fs";
import * as path from "path";

const SKILLS_DIR = path.resolve(process.cwd(), "../skills");

export function getSkillContent(slug: string): string | null {
  const skillPath = path.join(SKILLS_DIR, slug, "SKILL.md");
  if (!fs.existsSync(skillPath)) return null;
  return fs.readFileSync(skillPath, "utf-8");
}

export function getSkillExamples(slug: string): string[] {
  const examplesDir = path.join(SKILLS_DIR, slug, "examples");
  if (!fs.existsSync(examplesDir)) return [];

  return fs
    .readdirSync(examplesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}
