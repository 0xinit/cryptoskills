import Link from "next/link";
import type { RegistrySkill } from "@/lib/registry";

const CATEGORY_COLORS: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  DeFi: { dot: "bg-emerald-400", bg: "bg-emerald-400/8", text: "text-emerald-400", border: "border-emerald-400/20" },
  Infrastructure: { dot: "bg-blue-400", bg: "bg-blue-400/8", text: "text-blue-400", border: "border-blue-400/20" },
  "Dev Tools": { dot: "bg-amber-400", bg: "bg-amber-400/8", text: "text-amber-400", border: "border-amber-400/20" },
  Trading: { dot: "bg-rose-400", bg: "bg-rose-400/8", text: "text-rose-400", border: "border-rose-400/20" },
  Oracles: { dot: "bg-violet-400", bg: "bg-violet-400/8", text: "text-violet-400", border: "border-violet-400/20" },
  "Cross-Chain": { dot: "bg-cyan-400", bg: "bg-cyan-400/8", text: "text-cyan-400", border: "border-cyan-400/20" },
  "NFT & Tokens": { dot: "bg-pink-400", bg: "bg-pink-400/8", text: "text-pink-400", border: "border-pink-400/20" },
  Security: { dot: "bg-red-400", bg: "bg-red-400/8", text: "text-red-400", border: "border-red-400/20" },
  "L2 & Alt-L1": { dot: "bg-orange-400", bg: "bg-orange-400/8", text: "text-orange-400", border: "border-orange-400/20" },
  Frontend: { dot: "bg-fuchsia-400", bg: "bg-fuchsia-400/8", text: "text-fuchsia-400", border: "border-fuchsia-400/20" },
  "AI Agents": { dot: "bg-teal-400", bg: "bg-teal-400/8", text: "text-teal-400", border: "border-teal-400/20" },
  DevOps: { dot: "bg-slate-400", bg: "bg-slate-400/8", text: "text-slate-400", border: "border-slate-400/20" },
  "Data & Analytics": { dot: "bg-indigo-400", bg: "bg-indigo-400/8", text: "text-indigo-400", border: "border-indigo-400/20" },
};

const CHAIN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ethereum: { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/20" },
  solana: { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/20" },
  arbitrum: { bg: "bg-sky-500/10", text: "text-sky-300", border: "border-sky-500/20" },
  optimism: { bg: "bg-red-500/10", text: "text-red-300", border: "border-red-500/20" },
  base: { bg: "bg-blue-600/10", text: "text-blue-300", border: "border-blue-600/20" },
  polygon: { bg: "bg-violet-500/10", text: "text-violet-300", border: "border-violet-500/20" },
  multichain: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/20" },
  monad: { bg: "bg-fuchsia-500/10", text: "text-fuchsia-300", border: "border-fuchsia-500/20" },
  megaeth: { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/20" },
  starknet: { bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/20" },
  zksync: { bg: "bg-indigo-500/10", text: "text-indigo-300", border: "border-indigo-500/20" },
};

export function SkillCard({
  skill,
  index,
}: {
  skill: RegistrySkill;
  index: number;
}) {
  const catColor = CATEGORY_COLORS[skill.category] || { dot: "bg-zinc-400", bg: "bg-zinc-400/8", text: "text-zinc-400", border: "border-zinc-400/20" };
  const chainColor = CHAIN_COLORS[skill.chain] || { bg: "bg-zinc-500/10", text: "text-zinc-300", border: "border-zinc-500/20" };

  return (
    <Link
      href={`/skills/${skill.name}`}
      className="skill-card card-animate group block rounded-lg p-5"
      style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${catColor.dot}`} />
        <h3
          className="truncate text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {skill.name}
        </h3>
      </div>

      <p className="mb-4 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
        {skill.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${chainColor.bg} ${chainColor.text} ${chainColor.border}`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {skill.chain}
          </span>
          <span
            className={`rounded border px-2 py-0.5 text-[10px] ${catColor.bg} ${catColor.text} ${catColor.border}`}
          >
            {skill.category}
          </span>
        </div>
        <svg
          className="h-3.5 w-3.5 text-[var(--text-muted)] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-[var(--accent)] group-hover:opacity-100"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}
