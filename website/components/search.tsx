"use client";

import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import type { RegistrySkill } from "@/lib/registry";

interface SearchProps {
  skills: RegistrySkill[];
  onResults: (results: RegistrySkill[]) => void;
}

export function Search({ skills, onResults }: SearchProps) {
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(skills, {
        keys: [
          { name: "name", weight: 3 },
          { name: "description", weight: 1 },
          { name: "tags", weight: 2 },
          { name: "category", weight: 1.5 },
          { name: "chain", weight: 1.5 },
        ],
        threshold: 0.35,
        includeScore: true,
      }),
    [skills]
  );

  const handleChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      onResults(skills);
      return;
    }
    const results = fuse.search(value).map((r) => r.item);
    onResults(results);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search 93 skills — protocols, chains, categories..."
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 pl-10 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  );
}
