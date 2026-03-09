"use client";

import { useState, useCallback, useEffect } from "react";
import type { RegistrySkill, SkillStats } from "@/lib/registry";
import { SkillCard } from "./skill-card";
import { Search } from "./search";

interface SkillGridProps {
  skills: RegistrySkill[];
  categories: string[];
  chains: string[];
}

export function SkillGrid({ skills, categories, chains }: SkillGridProps) {
  const [stats, setStats] = useState<Record<string, SkillStats>>({});
  const [filtered, setFiltered] = useState<RegistrySkill[]>(skills);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeChain, setActiveChain] = useState<string | null>(null);
  const [searchResults, setSearchResults] =
    useState<RegistrySkill[]>(skills);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data: Record<string, SkillStats>) => setStats(data))
      .catch(() => {});
  }, []);

  const applyFilters = useCallback(
    (
      results: RegistrySkill[],
      category: string | null,
      chain: string | null
    ) => {
      let out = results;
      if (category) out = out.filter((s) => s.category === category);
      if (chain) out = out.filter((s) => s.chain === chain);
      return out;
    },
    []
  );

  const handleSearch = useCallback(
    (results: RegistrySkill[]) => {
      setSearchResults(results);
      setFiltered(applyFilters(results, activeCategory, activeChain));
    },
    [activeCategory, activeChain, applyFilters]
  );

  const handleCategory = useCallback(
    (cat: string | null) => {
      setActiveCategory(cat);
      setFiltered(applyFilters(searchResults, cat, activeChain));
    },
    [searchResults, activeChain, applyFilters]
  );

  const handleChain = useCallback(
    (chain: string | null) => {
      setActiveChain(chain);
      setFiltered(applyFilters(searchResults, activeCategory, chain));
    },
    [searchResults, activeCategory, applyFilters]
  );

  return (
    <div>
      <Search skills={skills} onResults={handleSearch} />

      {/* Filters */}
      <div className="mt-5 space-y-3">
        {/* Categories */}
        <div className="flex flex-wrap gap-1.5">
          <span
            className="mr-1 self-center text-[10px] uppercase tracking-widest text-[var(--text-muted)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            cat
          </span>
          <button
            onClick={() => handleCategory(null)}
            className={`filter-pill rounded-md px-2.5 py-1 text-[11px] ${
              !activeCategory ? "filter-pill-active" : ""
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                handleCategory(activeCategory === cat ? null : cat)
              }
              className={`filter-pill rounded-md px-2.5 py-1 text-[11px] ${
                activeCategory === cat ? "filter-pill-active" : ""
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Chains */}
        <div className="flex flex-wrap gap-1.5">
          <span
            className="mr-1 self-center text-[10px] uppercase tracking-widest text-[var(--text-muted)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            chain
          </span>
          <button
            onClick={() => handleChain(null)}
            className={`filter-pill rounded-md px-2.5 py-1 text-[11px] ${
              !activeChain ? "filter-pill-active" : ""
            }`}
          >
            All
          </button>
          {chains.map((chain) => (
            <button
              key={chain}
              onClick={() =>
                handleChain(activeChain === chain ? null : chain)
              }
              className={`filter-pill rounded-md px-2.5 py-1 text-[11px] ${
                activeChain === chain ? "filter-pill-active" : ""
              }`}
            >
              {chain}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="mt-5 flex items-center gap-3 border-b border-[var(--border)] pb-4">
        <span
          className="text-xs text-[var(--text-muted)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          {activeCategory ? ` / ${activeCategory}` : ""}
          {activeChain ? ` / ${activeChain}` : ""}
        </span>
      </div>

      {/* Grid */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((skill, i) => (
          <SkillCard key={skill.name} skill={skill} index={i} stats={stats[skill.name]} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-24 text-center">
          <div
            className="text-4xl text-[var(--text-muted)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            _
          </div>
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            No skills match your search.
          </p>
        </div>
      )}
    </div>
  );
}
