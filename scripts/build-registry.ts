#!/usr/bin/env npx tsx

/**
 * build-registry.ts
 *
 * Scans skills/ directory, parses SKILL.md frontmatter, and generates _registry.json.
 * Also updates .claude-plugin/marketplace.json plugins array to stay in sync.
 *
 * Usage: npx tsx scripts/build-registry.ts
 */

import * as fs from "fs";
import * as path from "path";

interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  metadata?: {
    author?: string;
    version?: string;
    chain?: string;
    category?: string;
  };
  tags?: string[];
}

interface RegistryEntry {
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

interface MarketplacePlugin {
  name: string;
  source: string;
  description: string;
  category: string;
}

const SKILLS_DIR = path.resolve(__dirname, "../skills");
const REGISTRY_PATH = path.resolve(__dirname, "../_registry.json");
const MARKETPLACE_PATH = path.resolve(
  __dirname,
  "../.claude-plugin/marketplace.json"
);

function parseFrontmatter(content: string): SkillMetadata | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result: Record<string, unknown> = {};

  let currentKey = "";
  let inMetadata = false;
  let inTags = false;
  const tags: string[] = [];
  const metadata: Record<string, string> = {};

  for (const line of yaml.split("\n")) {
    if (line === "metadata:") {
      inMetadata = true;
      inTags = false;
      continue;
    }
    if (line === "tags:") {
      inTags = true;
      inMetadata = false;
      continue;
    }

    if (inTags && line.match(/^\s+-\s+/)) {
      tags.push(line.replace(/^\s+-\s+/, "").trim());
      continue;
    }

    if (inMetadata && line.match(/^\s+\w+:/)) {
      const [key, ...valueParts] = line.trim().split(":");
      metadata[key.trim()] = valueParts
        .join(":")
        .trim()
        .replace(/^["']|["']$/g, "");
      continue;
    }

    if (line.match(/^\w+:/)) {
      inMetadata = false;
      inTags = false;
      const [key, ...valueParts] = line.split(":");
      currentKey = key.trim();
      result[currentKey] = valueParts
        .join(":")
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }

  if (tags.length > 0) result.tags = tags;
  if (Object.keys(metadata).length > 0) result.metadata = metadata;

  return result as unknown as SkillMetadata;
}

function scanSkills(): RegistryEntry[] {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.log("No skills/ directory found. Creating empty registry.");
    return [];
  }

  const entries: RegistryEntry[] = [];
  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;

    const skillPath = path.join(SKILLS_DIR, dir.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      console.warn(`Warning: ${dir.name}/ has no SKILL.md — skipping`);
      continue;
    }

    const content = fs.readFileSync(skillPath, "utf-8");
    const meta = parseFrontmatter(content);

    if (!meta) {
      console.warn(
        `Warning: ${dir.name}/SKILL.md has no valid frontmatter — skipping`
      );
      continue;
    }

    if (!meta.name || !meta.description) {
      console.warn(
        `Warning: ${dir.name}/SKILL.md missing name or description — skipping`
      );
      continue;
    }

    const skillDir = path.join(SKILLS_DIR, dir.name);

    entries.push({
      name: meta.name,
      description: meta.description,
      chain: meta.metadata?.chain || "unknown",
      category: meta.metadata?.category || "Uncategorized",
      author: meta.metadata?.author || "cryptoskills",
      version: meta.metadata?.version || "1.0",
      tags: meta.tags || [],
      path: `./skills/${dir.name}`,
      hasExamples: fs.existsSync(path.join(skillDir, "examples")),
      hasDocs: fs.existsSync(path.join(skillDir, "docs")),
      hasResources: fs.existsSync(path.join(skillDir, "resources")),
      hasTemplates: fs.existsSync(path.join(skillDir, "templates")),
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

function buildRegistry(entries: RegistryEntry[]): void {
  const registry = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    skillCount: entries.length,
    skills: entries,
  };

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
  console.log(`Registry: ${entries.length} skills → ${REGISTRY_PATH}`);
}

function updateMarketplace(entries: RegistryEntry[]): void {
  if (!fs.existsSync(MARKETPLACE_PATH)) {
    console.warn("No marketplace.json found — skipping marketplace update");
    return;
  }

  const marketplace = JSON.parse(fs.readFileSync(MARKETPLACE_PATH, "utf-8"));

  const plugins: MarketplacePlugin[] = entries.map((entry) => ({
    name: entry.name,
    source: entry.path,
    description: entry.description,
    category: entry.category,
  }));

  marketplace.plugins = plugins;

  fs.writeFileSync(
    MARKETPLACE_PATH,
    JSON.stringify(marketplace, null, 2) + "\n"
  );
  console.log(
    `Marketplace: ${plugins.length} plugins → ${MARKETPLACE_PATH}`
  );
}

// Main
const entries = scanSkills();
buildRegistry(entries);
updateMarketplace(entries);

console.log("\nDone.");
