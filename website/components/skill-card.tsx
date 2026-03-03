import Link from "next/link";
import type { RegistrySkill } from "@/lib/registry";

const CATEGORY_COLORS: Record<string, string> = {
  DeFi: "bg-emerald-900/50 text-emerald-300 border-emerald-800",
  Infrastructure: "bg-blue-900/50 text-blue-300 border-blue-800",
  "Dev Tools": "bg-amber-900/50 text-amber-300 border-amber-800",
  Trading: "bg-rose-900/50 text-rose-300 border-rose-800",
  Oracles: "bg-purple-900/50 text-purple-300 border-purple-800",
  "Cross-Chain": "bg-cyan-900/50 text-cyan-300 border-cyan-800",
  "NFT & Tokens": "bg-pink-900/50 text-pink-300 border-pink-800",
  Security: "bg-red-900/50 text-red-300 border-red-800",
  "L2 & Alt-L1": "bg-orange-900/50 text-orange-300 border-orange-800",
  Frontend: "bg-violet-900/50 text-violet-300 border-violet-800",
  "AI Agents": "bg-teal-900/50 text-teal-300 border-teal-800",
  DevOps: "bg-slate-800/50 text-slate-300 border-slate-700",
};

const DEFAULT_COLOR = "bg-zinc-800/50 text-zinc-300 border-zinc-700";

export function SkillCard({ skill }: { skill: RegistrySkill }) {
  const categoryColor = CATEGORY_COLORS[skill.category] || DEFAULT_COLOR;

  return (
    <Link
      href={`/skills/${skill.name}`}
      className="group flex flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-800/80"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-mono text-lg font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors">
          {skill.name}
        </h3>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${categoryColor}`}>
          {skill.category}
        </span>
      </div>

      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-zinc-400">
        {skill.description}
      </p>

      <div className="mt-auto flex flex-wrap gap-1.5">
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
          {skill.chain}
        </span>
        {skill.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-500"
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}
