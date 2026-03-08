#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const API = "https://cryptoskills.dev";
const VERSION = "0.2.0";

// ANSI colors
const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const AGENTS = {
  "claude-code": { dir: ".claude/skills", label: "Claude Code" },
  cursor: { dir: ".cursor/skills", label: "Cursor" },
  codex: { dir: ".codex/skills", label: "Codex" },
  opencode: { dir: ".opencode/skill", label: "OpenCode" },
};

function parseArgs(argv) {
  const args = { command: null, skills: [], agents: [], flags: {} };
  let i = 2;

  if (argv[i] && !argv[i].startsWith("-")) args.command = argv[i++];

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "-a" || arg === "--agent") {
      if (argv[i + 1]) args.agents.push(argv[++i]);
    } else if (arg === "-g" || arg === "--global") {
      args.flags.global = true;
    } else if (arg === "--all") {
      args.flags.all = true;
    } else if (arg === "--category") {
      if (argv[i + 1]) args.flags.category = argv[++i];
    } else if (arg === "--chain") {
      if (argv[i + 1]) args.flags.chain = argv[++i];
    } else if (arg === "-h" || arg === "--help") {
      args.flags.help = true;
    } else if (!arg.startsWith("-")) {
      args.skills.push(arg);
    }
    i++;
  }

  return args;
}

async function fetchRegistry() {
  const res = await fetch(`${API}/api/registry.json`);
  if (!res.ok) throw new Error(`Failed to fetch registry: ${res.status}`);
  return res.json();
}

async function fetchSkill(slug) {
  const res = await fetch(`${API}/skills/${slug}/raw`);
  if (!res.ok) throw new Error(`Skill "${slug}" not found (${res.status})`);
  return res.text();
}

function detectAgents(baseDir) {
  const found = [];
  for (const [id, info] of Object.entries(AGENTS)) {
    const agentDir = path.join(baseDir, info.dir.split("/")[0]);
    if (fs.existsSync(agentDir)) found.push(id);
  }
  return found;
}

function resolveBaseDir(isGlobal) {
  if (isGlobal) return require("os").homedir();
  return process.cwd();
}

function resolveAgents(args, baseDir) {
  let targetAgents = args.agents;
  if (targetAgents.length === 0) {
    targetAgents = detectAgents(baseDir);
    if (targetAgents.length === 0) {
      targetAgents = ["claude-code"];
      console.log(c.dim(`  No agent directories detected, defaulting to Claude Code`));
    }
  }

  for (const a of targetAgents) {
    if (!AGENTS[a]) {
      console.error(c.red(`Unknown agent: ${a}`));
      console.log(`Available: ${Object.keys(AGENTS).join(", ")}`);
      process.exit(1);
    }
  }

  return targetAgents;
}

async function installSkill(slug, agents, baseDir) {
  const content = await fetchSkill(slug);
  let installed = 0;

  for (const agentId of agents) {
    const info = AGENTS[agentId];
    if (!info) {
      console.log(`  ${c.yellow("!")} Unknown agent: ${agentId}`);
      continue;
    }

    const skillDir = path.join(baseDir, info.dir, slug);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), content);
    console.log(`  ${c.green("✓")} ${info.label} ${c.dim(`→ ${info.dir}/${slug}/SKILL.md`)}`);
    installed++;
  }

  return installed;
}

// --- Helpers for init ---

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptSelect(label, options) {
  console.log(`\n  ${c.bold(label)}`);
  options.forEach((opt, i) => {
    console.log(`    ${c.cyan(String(i + 1).padStart(2))}  ${opt}`);
  });
  const answer = await prompt(`\n  Enter numbers (comma-separated) or ${c.cyan("all")}: `);
  if (answer.toLowerCase() === "all") return options;
  const indices = answer.split(",").map((s) => parseInt(s.trim(), 10) - 1);
  return indices.filter((i) => i >= 0 && i < options.length).map((i) => options[i]);
}

// --- Helpers for find ---

function scoreMatch(query, skill) {
  const q = query.toLowerCase();
  const name = skill.name.toLowerCase();
  const desc = (skill.description || "").toLowerCase();
  const tags = (skill.tags || []).map((t) => t.toLowerCase());

  let score = 0;
  if (name === q) score += 100;
  else if (name.includes(q)) score += 60;
  if (desc.includes(q)) score += 30;
  for (const tag of tags) {
    if (tag === q) { score += 40; break; }
    if (tag.includes(q)) { score += 20; break; }
  }
  return score;
}

// --- Helpers for update ---

function getInstalledSlugs(baseDir, agents) {
  const slugs = new Set();
  for (const agentId of agents) {
    const info = AGENTS[agentId];
    if (!info) continue;
    const skillsDir = path.join(baseDir, info.dir);
    if (!fs.existsSync(skillsDir)) continue;
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md"))) {
        slugs.add(entry.name);
      }
    }
  }
  return slugs;
}

// --- Commands ---

async function cmdInstall(args) {
  const baseDir = resolveBaseDir(args.flags.global);
  const scope = args.flags.global ? "global" : "project";
  const targetAgents = resolveAgents(args, baseDir);

  let slugs = args.skills;

  if (args.flags.all) {
    console.log(c.dim("Fetching skill registry..."));
    const registry = await fetchRegistry();
    slugs = registry.skills.map((s) => s.name);
    console.log(`Installing all ${c.bold(slugs.length)} skills (${scope})...\n`);
  } else if (slugs.length === 0) {
    console.error(c.red("No skills specified."));
    console.log(`Usage: ${c.cyan("cryptoskills install <skill>")} or ${c.cyan("cryptoskills install --all")}`);
    process.exit(1);
  } else {
    console.log(`Installing ${c.bold(slugs.length)} skill${slugs.length > 1 ? "s" : ""} (${scope})...\n`);
  }

  let totalInstalled = 0;
  let failures = 0;

  for (const slug of slugs) {
    console.log(`  ${c.cyan(slug)}`);
    try {
      totalInstalled += await installSkill(slug, targetAgents, baseDir);
    } catch (err) {
      console.log(`  ${c.red("✗")} ${err.message}`);
      failures++;
    }
  }

  console.log(
    `\n${c.green("Done.")} ${totalInstalled} file${totalInstalled !== 1 ? "s" : ""} written` +
      (failures > 0 ? `, ${c.red(`${failures} failed`)}` : "") +
      "."
  );
}

async function cmdList(args) {
  const registry = await fetchRegistry();
  let skills = registry.skills;

  if (args.flags.category) {
    const cat = args.flags.category.toLowerCase();
    skills = skills.filter((s) => s.category.toLowerCase() === cat);
  }
  if (args.flags.chain) {
    const chain = args.flags.chain.toLowerCase();
    skills = skills.filter((s) => s.chain.toLowerCase() === chain);
  }

  if (skills.length === 0) {
    console.log(c.yellow("No skills match your filters."));
    return;
  }

  const groups = {};
  for (const s of skills) {
    (groups[s.category] ||= []).push(s);
  }

  console.log(`${c.bold(skills.length)} skills available\n`);

  for (const [category, items] of Object.entries(groups).sort()) {
    console.log(`  ${c.cyan(category)}`);
    const names = items.map((s) => s.name).sort();
    let line = "    ";
    for (let i = 0; i < names.length; i++) {
      const sep = i < names.length - 1 ? ", " : "";
      if (line.length + names[i].length + sep.length > 80) {
        console.log(line);
        line = "    ";
      }
      line += names[i] + sep;
    }
    if (line.trim()) console.log(line);
    console.log();
  }
}

async function cmdFind(args) {
  const query = args.skills.join(" ");
  if (!query) {
    console.error(c.red("No search query provided."));
    console.log(`Usage: ${c.cyan('cryptoskills find "lending"')}`);
    process.exit(1);
  }

  console.log(c.dim("Searching registry...\n"));
  const registry = await fetchRegistry();
  let skills = registry.skills;

  if (args.flags.category) {
    const cat = args.flags.category.toLowerCase();
    skills = skills.filter((s) => s.category.toLowerCase() === cat);
  }
  if (args.flags.chain) {
    const chain = args.flags.chain.toLowerCase();
    skills = skills.filter((s) => s.chain.toLowerCase() === chain);
  }

  const scored = skills
    .map((s) => ({ ...s, score: scoreMatch(query, s) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  if (scored.length === 0) {
    console.log(c.yellow(`No skills matching "${query}".`));
    return;
  }

  console.log(`  ${c.bold(scored.length)} result${scored.length !== 1 ? "s" : ""} for "${query}"\n`);

  for (const s of scored) {
    const chain = c.dim(`[${s.chain}]`);
    const desc = (s.description || "").slice(0, 60);
    console.log(`  ${c.cyan(s.name.padEnd(24))} ${chain.padEnd(30)} ${c.dim(desc)}`);
  }

  console.log(`\n  ${c.dim("Install:")} ${c.cyan(`npx cryptoskills install ${scored[0].name}`)}`);
}

async function cmdUpdate(args) {
  const baseDir = resolveBaseDir(args.flags.global);
  const scope = args.flags.global ? "global" : "project";
  const targetAgents = resolveAgents(args, baseDir);

  let slugs;

  if (args.skills.length > 0) {
    slugs = args.skills;
  } else {
    const installed = getInstalledSlugs(baseDir, targetAgents);
    if (installed.size === 0) {
      console.log(c.yellow("No installed skills found to update."));
      console.log(`Install skills first: ${c.cyan("npx cryptoskills install --all")}`);
      return;
    }
    slugs = [...installed];
  }

  console.log(`Updating ${c.bold(slugs.length)} skill${slugs.length > 1 ? "s" : ""} (${scope})...\n`);

  let updated = 0;
  let failures = 0;

  for (const slug of slugs) {
    console.log(`  ${c.cyan(slug)}`);
    try {
      await installSkill(slug, targetAgents, baseDir);
      updated++;
    } catch (err) {
      console.log(`  ${c.red("✗")} ${err.message}`);
      failures++;
    }
  }

  console.log(
    `\n${c.green("Done.")} ${updated} skill${updated !== 1 ? "s" : ""} updated` +
      (failures > 0 ? `, ${c.red(`${failures} failed`)}` : "") +
      "."
  );
}

async function cmdInit(args) {
  const baseDir = process.cwd();

  console.log(c.dim("Fetching skill registry...\n"));
  const registry = await fetchRegistry();
  const skills = registry.skills;

  const categories = [...new Set(skills.map((s) => s.category))].sort();
  const chains = [...new Set(skills.map((s) => s.chain))].sort();

  const selectedCategories = await promptSelect("Which categories?", categories);
  if (selectedCategories.length === 0) {
    console.log(c.yellow("\nNo categories selected. Aborting."));
    return;
  }

  const selectedChains = await promptSelect("Which chains?", chains);
  if (selectedChains.length === 0) {
    console.log(c.yellow("\nNo chains selected. Aborting."));
    return;
  }

  const catSet = new Set(selectedCategories.map((c) => c.toLowerCase()));
  const chainSet = new Set(selectedChains.map((c) => c.toLowerCase()));

  const matching = skills.filter(
    (s) => catSet.has(s.category.toLowerCase()) && chainSet.has(s.chain.toLowerCase())
  );

  if (matching.length === 0) {
    console.log(c.yellow("\nNo skills match your selections."));
    return;
  }

  let targetAgents = args.agents;
  if (targetAgents.length === 0) {
    targetAgents = detectAgents(baseDir);
    if (targetAgents.length === 0) {
      targetAgents = ["claude-code"];
      console.log(c.dim(`\n  No agents detected, defaulting to Claude Code`));
    } else if (targetAgents.length > 1) {
      const selected = await promptSelect(
        "Multiple agents detected. Which to install for?",
        targetAgents
      );
      targetAgents = selected.length > 0 ? selected : targetAgents;
    }
  }

  const confirm = await prompt(
    `\n  Install ${c.bold(matching.length)} skills for ${targetAgents.map((a) => AGENTS[a].label).join(", ")}? [y/N] `
  );

  if (confirm.toLowerCase() !== "y") {
    console.log(c.dim("Aborted."));
    return;
  }

  console.log();
  let totalInstalled = 0;
  let failures = 0;

  for (const skill of matching) {
    console.log(`  ${c.cyan(skill.name)}`);
    try {
      totalInstalled += await installSkill(skill.name, targetAgents, baseDir);
    } catch (err) {
      console.log(`  ${c.red("✗")} ${err.message}`);
      failures++;
    }
  }

  console.log(
    `\n${c.green("Done.")} ${totalInstalled} file${totalInstalled !== 1 ? "s" : ""} written` +
      (failures > 0 ? `, ${c.red(`${failures} failed`)}` : "") +
      "."
  );
}

function printHelp() {
  console.log(`
${c.bold("cryptoskills")} ${c.dim(`v${VERSION}`)} — crypto agent skills from ${c.cyan("cryptoskills.dev")}

${c.bold("Commands:")}
  install <skill> [...]   Install one or more skills
  install --all           Install all skills
  find <query>            Search skills by name, description, or tags
  update [skill...]       Re-download installed skills to get latest content
  init                    Interactive project setup — pick categories & chains
  list                    List available skills

${c.bold("Options:")}
  -a, --agent <name>      Target agent (claude-code, cursor, codex, opencode)
  -g, --global            Install to home directory instead of project
  --category <name>       Filter by category (list, find)
  --chain <name>          Filter by chain (list, find)
  -h, --help              Show this help

${c.bold("Examples:")}
  ${c.dim("$")} npx cryptoskills install aave
  ${c.dim("$")} npx cryptoskills install --all -a claude-code
  ${c.dim("$")} npx cryptoskills find "lending"
  ${c.dim("$")} npx cryptoskills find dex --chain solana
  ${c.dim("$")} npx cryptoskills update
  ${c.dim("$")} npx cryptoskills init
  ${c.dim("$")} npx cryptoskills list --category DeFi
`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.flags.help || !args.command) {
    printHelp();
    return;
  }

  console.log(`${c.bold("cryptoskills")} ${c.dim(`v${VERSION}`)}\n`);

  switch (args.command) {
    case "install":
    case "add":
    case "i":
      await cmdInstall(args);
      break;
    case "list":
    case "ls":
      await cmdList(args);
      break;
    case "find":
    case "search":
    case "s":
      await cmdFind(args);
      break;
    case "update":
    case "u":
      await cmdUpdate(args);
      break;
    case "init":
      await cmdInit(args);
      break;
    default:
      console.error(c.red(`Unknown command: ${args.command}`));
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(c.red(`Error: ${err.message}`));
  process.exit(1);
});
