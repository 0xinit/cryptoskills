"use client";

import { useState, useMemo, useEffect } from "react";
import Fuse from "fuse.js";
import type { RegistrySkill } from "@/lib/registry";

interface SearchProps {
  skills: RegistrySkill[];
  onResults: (results: RegistrySkill[]) => void;
}

export function Search({ skills, onResults }: SearchProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("skill-search")?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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
        id="skill-search"
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search protocols, chains, categories..."
        className="search-input w-full rounded-lg px-4 py-3 pl-10 pr-20 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]"
        style={{ fontFamily: "var(--font-mono)" }}
      />
      <svg
        className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
          focused ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <kbd
        className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] sm:inline-block"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        ⌘K
      </kbd>
    </div>
  );
}
