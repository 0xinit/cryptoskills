"use client";

import { useState, useCallback } from "react";
import type { RegistrySkill } from "@/lib/registry";
import { SkillCard } from "./skill-card";
import { Search } from "./search";

interface SkillGridProps {
  skills: RegistrySkill[];
  categories: string[];
  chains: string[];
}

export function SkillGrid({ skills, categories, chains }: SkillGridProps) {
  const [filtered, setFiltered] = useState<RegistrySkill[]>(skills);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeChain, setActiveChain] = useState<string | null>(null);

  const applyFilters = useCallback(
    (
      searchResults: RegistrySkill[],
      category: string | null,
      chain: string | null
    ) => {
      let result = searchResults;
      if (category) {
        result = result.filter((s) => s.category === category);
      }
      if (chain) {
        result = result.filter((s) => s.chain === chain);
      }
      return result;
    },
    []
  );

  const [searchResults, setSearchResults] =
    useState<RegistrySkill[]>(skills);

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

      {/* Category filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => handleCategory(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !activeCategory
              ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
          }`}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() =>
              handleCategory(activeCategory === cat ? null : cat)
            }
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Chain filters */}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={() => handleChain(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !activeChain
              ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
          }`}
        >
          All Chains
        </button>
        {chains.map((chain) => (
          <button
            key={chain}
            onClick={() =>
              handleChain(activeChain === chain ? null : chain)
            }
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeChain === chain
                ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {chain}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="mt-4 text-sm text-zinc-500">
        {filtered.length} skill{filtered.length !== 1 ? "s" : ""}
        {activeCategory ? ` in ${activeCategory}` : ""}
        {activeChain ? ` on ${activeChain}` : ""}
      </p>

      {/* Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((skill) => (
          <SkillCard key={skill.name} skill={skill} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-12 text-center text-zinc-500">
          No skills match your search.
        </p>
      )}
    </div>
  );
}
