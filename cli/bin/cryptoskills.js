#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const API = "https://cryptoskills.dev";
const VERSION = "0.1.0";

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

async function cmdInstall(args) {
  const baseDir = resolveBaseDir(args.flags.global);
  const scope = args.flags.global ? "global" : "project";

  let targetAgents = args.agents;
  if (targetAgents.length === 0) {
    targetAgents = detectAgents(baseDir);
    if (targetAgents.length === 0) {
      // Default to claude-code if no agents detected
      targetAgents = ["claude-code"];
      console.log(c.dim(`  No agent directories detected, defaulting to Claude Code`));
    }
  }

  // Validate agent names
  for (const a of targetAgents) {
    if (!AGENTS[a]) {
      console.error(c.red(`Unknown agent: ${a}`));
      console.log(`Available: ${Object.keys(AGENTS).join(", ")}`);
      process.exit(1);
    }
  }

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

  // Group by category
  const groups = {};
  for (const s of skills) {
    (groups[s.category] ||= []).push(s);
  }

  console.log(`${c.bold(skills.length)} skills available\n`);

  for (const [category, items] of Object.entries(groups).sort()) {
    console.log(`  ${c.cyan(category)}`);
    const names = items.map((s) => s.name).sort();
    // Wrap at ~80 chars
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

function printHelp() {
  console.log(`
${c.bold("cryptoskills")} ${c.dim(`v${VERSION}`)} — crypto agent skills from ${c.cyan("cryptoskills.dev")}

${c.bold("Commands:")}
  install <skill> [...]   Install one or more skills
  install --all           Install all skills
  list                    List available skills

${c.bold("Options:")}
  -a, --agent <name>      Target agent (claude-code, cursor, codex, opencode)
  -g, --global            Install to home directory instead of project
  --category <name>       Filter by category (list command)
  --chain <name>          Filter by chain (list command)
  -h, --help              Show this help

${c.bold("Examples:")}
  ${c.dim("$")} npx cryptoskills install aave
  ${c.dim("$")} npx cryptoskills install aave uniswap compound
  ${c.dim("$")} npx cryptoskills install --all -a claude-code
  ${c.dim("$")} npx cryptoskills list --category DeFi
  ${c.dim("$")} npx cryptoskills list --chain solana
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
