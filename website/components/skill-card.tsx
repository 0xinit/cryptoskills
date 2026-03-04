import Link from "next/link";
import type { RegistrySkill } from "@/lib/registry";

const CATEGORY_DOTS: Record<string, string> = {
  DeFi: "bg-emerald-400",
  Infrastructure: "bg-blue-400",
  "Dev Tools": "bg-amber-400",
  Trading: "bg-rose-400",
  Oracles: "bg-violet-400",
  "Cross-Chain": "bg-cyan-400",
  "NFT & Tokens": "bg-pink-400",
  Security: "bg-red-400",
  "L2 & Alt-L1": "bg-orange-400",
  Frontend: "bg-fuchsia-400",
  "AI Agents": "bg-teal-400",
  DevOps: "bg-slate-400",
};

export function SkillCard({
  skill,
  index,
}: {
  skill: RegistrySkill;
  index: number;
}) {
  const dotColor = CATEGORY_DOTS[skill.category] || "bg-zinc-400";

  return (
    <Link
      href={`/skills/${skill.name}`}
      className="skill-card card-animate group block rounded-lg p-5"
      style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
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
            className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {skill.chain}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
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
