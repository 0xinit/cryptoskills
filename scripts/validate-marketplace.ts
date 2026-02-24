#!/usr/bin/env npx tsx

/**
 * validate-marketplace.ts
 *
 * Validates .claude-plugin/marketplace.json:
 * - Valid JSON structure
 * - Required fields present
 * - Each plugin has a corresponding skills/ directory with SKILL.md
 * - No duplicate plugin names
 * - Descriptions under 1024 chars
 * - Categories match allowed values
 *
 * Usage: npx tsx scripts/validate-marketplace.ts
 */

import * as fs from "fs";
import * as path from "path";

const MARKETPLACE_PATH = path.resolve(
  __dirname,
  "../.claude-plugin/marketplace.json"
);
const SKILLS_DIR = path.resolve(__dirname, "../skills");

const ALLOWED_CATEGORIES = [
  "DeFi",
  "Infrastructure",
  "Dev Tools",
  "Trading",
  "Oracles",
  "Cross-Chain",
  "NFT & Tokens",
  "Security",
  "L2 & Alt-L1",
  "Frontend",
  "AI Agents",
  "DevOps",
  "Data & Analytics",
  "Client Development",
  "Program Development",
];

let errors = 0;
let warnings = 0;

function error(msg: string): void {
  console.error(`ERROR: ${msg}`);
  errors++;
}

function warn(msg: string): void {
  console.warn(`WARN: ${msg}`);
  warnings++;
}

function validate(): void {
  // Check file exists
  if (!fs.existsSync(MARKETPLACE_PATH)) {
    error("marketplace.json not found at .claude-plugin/marketplace.json");
    return;
  }

  // Parse JSON
  let marketplace: Record<string, unknown>;
  try {
    marketplace = JSON.parse(fs.readFileSync(MARKETPLACE_PATH, "utf-8"));
  } catch (e) {
    error(`Invalid JSON: ${(e as Error).message}`);
    return;
  }

  // Required top-level fields
  if (!marketplace.name) error("Missing required field: name");
  if (!marketplace.owner) error("Missing required field: owner");
  if (!marketplace.metadata) error("Missing required field: metadata");
  if (!Array.isArray(marketplace.plugins))
    error("Missing or invalid field: plugins (must be array)");

  const plugins = marketplace.plugins as Array<Record<string, unknown>>;
  if (!plugins) return;

  // Validate each plugin
  const names = new Set<string>();

  for (const plugin of plugins) {
    const name = plugin.name as string;

    if (!name) {
      error("Plugin missing required field: name");
      continue;
    }

    // Duplicate check
    if (names.has(name)) {
      error(`Duplicate plugin name: ${name}`);
    }
    names.add(name);

    // Required fields
    if (!plugin.source) error(`${name}: missing required field: source`);
    if (!plugin.description)
      error(`${name}: missing required field: description`);
    if (!plugin.category) error(`${name}: missing required field: category`);

    // Description length
    const desc = plugin.description as string;
    if (desc && desc.length > 1024) {
      error(
        `${name}: description exceeds 1024 chars (${desc.length})`
      );
    }

    // Category validation
    const category = plugin.category as string;
    if (category && !ALLOWED_CATEGORIES.includes(category)) {
      warn(
        `${name}: category "${category}" not in allowed list. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`
      );
    }

    // Check skill directory exists
    const source = plugin.source as string;
    if (source) {
      const skillDir = path.resolve(__dirname, "..", source);
      if (!fs.existsSync(skillDir)) {
        error(`${name}: source directory not found: ${source}`);
      } else {
        const skillMd = path.join(skillDir, "SKILL.md");
        if (!fs.existsSync(skillMd)) {
          error(`${name}: SKILL.md not found in ${source}`);
        }
      }
    }

    // Alphabetical order check
    const pluginNames = plugins.map((p) => p.name as string).filter(Boolean);
    const sorted = [...pluginNames].sort();
    if (JSON.stringify(pluginNames) !== JSON.stringify(sorted)) {
      warn("Plugins are not in alphabetical order");
    }
  }

  // Check for skills not in marketplace
  if (fs.existsSync(SKILLS_DIR)) {
    const skillDirs = fs
      .readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const dir of skillDirs) {
      const skillMd = path.join(SKILLS_DIR, dir, "SKILL.md");
      if (fs.existsSync(skillMd) && !names.has(dir)) {
        warn(
          `Skill "${dir}" has SKILL.md but is not listed in marketplace.json`
        );
      }
    }
  }
}

// Main
console.log("Validating marketplace.json...\n");
validate();
console.log(`\nResults: ${errors} errors, ${warnings} warnings`);
process.exit(errors > 0 ? 1 : 0);
