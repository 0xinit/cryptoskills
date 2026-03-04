import * as fs from "fs";
import * as path from "path";

export interface RegistrySkill {
  name: string;
  description: string;
  chain: string;
  category: string;
  author: string;
  version: string;
  tags: string[];
  path: string;
  hasExamples: boolean;
  hasDocs: boolean;
  hasResources: boolean;
  hasTemplates: boolean;
}

interface Registry {
  version: string;
  generatedAt: string;
  skillCount: number;
  skills: RegistrySkill[];
}

let cachedRegistry: Registry | null = null;

export function getRegistry(): Registry {
  if (cachedRegistry) return cachedRegistry;

  const parentPath = path.resolve(process.cwd(), "../_registry.json");
  const localPath = path.resolve(process.cwd(), "_registry.json");
  const registryPath = fs.existsSync(parentPath) ? parentPath : localPath;
  if (!fs.existsSync(registryPath)) {
    throw new Error(
      "_registry.json not found. Run `npx tsx scripts/build-registry.ts` first."
    );
  }

  cachedRegistry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  return cachedRegistry!;
}

export function getAllSkills(): RegistrySkill[] {
  return getRegistry().skills;
}

export function getSkillBySlug(slug: string): RegistrySkill | undefined {
  return getAllSkills().find((s) => s.name === slug);
}

export function getAllCategories(): string[] {
  const categories = new Set(getAllSkills().map((s) => s.category));
  return Array.from(categories).sort();
}

export function getAllChains(): string[] {
  const chains = new Set(getAllSkills().map((s) => s.chain));
  return Array.from(chains).sort();
}
