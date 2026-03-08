"use client";

import { useState, useEffect, useCallback } from "react";

const COMMANDS = [
  { text: "npx cryptoskills install --all", highlight: "install --all" },
  { text: "npx cryptoskills install uniswap", highlight: "install uniswap" },
  { text: "npx cryptoskills install aave foundry", highlight: "install aave foundry" },
  { text: "npx cryptoskills list --chain solana", highlight: "list --chain solana" },
  { text: 'npx cryptoskills find "dex"', highlight: 'find "dex"' },
];

const INTERVAL_MS = 3000;

export function CommandBar() {
  const [index, setIndex] = useState(0);
  const [animState, setAnimState] = useState<"visible" | "exiting">("visible");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimState("exiting");
      setTimeout(() => {
        setIndex((i) => (i + 1) % COMMANDS.length);
        setAnimState("visible");
      }, 300);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = useCallback(() => {
    const cmd = COMMANDS[index];
    navigator.clipboard.writeText(cmd.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [index]);

  const cmd = COMMANDS[index];
  const prefix = "npx cryptoskills ";
  const rest = cmd.text.slice(prefix.length);

  return (
    <div className="mb-8 flex justify-start">
      <button
        type="button"
        onClick={handleCopy}
        className="command-bar group relative flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-3 transition-all hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)]"
      >
        <span className="text-[var(--text-muted)]" style={{ fontFamily: "var(--font-mono)" }}>
          $
        </span>
        <span
          className={`command-text ${animState === "exiting" ? "command-exit" : "command-enter"}`}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span className="text-[var(--text-muted)]">{prefix}</span>
          <span className="text-[var(--accent)]">{rest}</span>
        </span>
        <span
          className={`ml-2 text-xs transition-opacity ${copied ? "text-[var(--accent)] opacity-100" : "text-[var(--text-muted)] opacity-0 group-hover:opacity-100"}`}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {copied ? "copied!" : "copy"}
        </span>
      </button>
    </div>
  );
}
