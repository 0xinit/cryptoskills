"use client";

import { useState, useCallback } from "react";

interface InstallButtonsProps {
  slug: string;
  skillContent: string;
}

const SITE = "https://cryptoskills.dev";

type TabId = "install" | "cursor" | "manual" | "download";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: "install",
    label: "Install",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "cursor",
    label: "Cursor",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    id: "manual",
    label: "Manual",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "download",
    label: "Download",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
];

type Agent = "all" | "claude-code" | "cursor" | "codex" | "opencode";

const AGENTS: { id: Agent; label: string }[] = [
  { id: "all", label: "All agents" },
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "codex", label: "Codex" },
  { id: "opencode", label: "OpenCode" },
];

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return Promise.resolve();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-1.5 text-[11px] font-medium transition-all hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CommandBlock({ command }: { command: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 overflow-x-auto rounded border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
        <code
          className="whitespace-nowrap text-[13px] text-[var(--text-secondary)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span className="text-[var(--accent)]">$</span> {command}
        </code>
      </div>
      <CopyButton text={command} />
    </div>
  );
}

function InstallTab({ slug }: { slug: string }) {
  const [agent, setAgent] = useState<Agent>("all");

  const agentFlag = agent === "all" ? "" : ` -a ${agent}`;
  const individualCmd = `npx cryptoskills install ${slug}${agentFlag}`;
  const allCmd = `npx cryptoskills install --all${agentFlag}`;

  return (
    <div className="space-y-4">
      {/* Agent selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="mr-1 text-[11px] text-[var(--text-muted)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Target:
        </span>
        {AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAgent(a.id)}
            className={`rounded px-2 py-1 text-[10px] font-medium transition-all ${
              agent === a.id
                ? "border border-[var(--accent-border)] bg-[var(--accent-glow)] text-[var(--accent)]"
                : "border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* This skill */}
      <div>
        <p
          className="mb-2 text-[11px] text-[var(--text-muted)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Install this skill:
        </p>
        <CommandBlock command={individualCmd} />
      </div>

      {/* All skills */}
      <div>
        <p
          className="mb-2 text-[11px] text-[var(--text-muted)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Install all 95 skills:
        </p>
        <CommandBlock command={allCmd} />
      </div>
    </div>
  );
}

function CursorTab({ slug }: { slug: string }) {
  return (
    <div className="space-y-4">
      {/* Install via CLI */}
      <div>
        <p
          className="mb-2 text-[11px] text-[var(--text-muted)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Install this skill for Cursor:
        </p>
        <CommandBlock command={`npx cryptoskills install ${slug} -a cursor`} />
      </div>

      {/* Install all */}
      <div>
        <p
          className="mb-2 text-[11px] text-[var(--text-muted)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Install all skills for Cursor:
        </p>
        <CommandBlock command="npx cryptoskills install --all -a cursor" />
      </div>
    </div>
  );
}

function ManualTab({ slug }: { slug: string }) {
  const downloadUrl = `${SITE}/skills/${slug}/raw`;
  const paths = [
    { agent: "Claude Code", path: `.claude/skills/${slug}/SKILL.md` },
    { agent: "Cursor", path: `.cursor/skills/${slug}/SKILL.md` },
    { agent: "Codex", path: `.codex/skills/${slug}/SKILL.md` },
    { agent: "OpenCode", path: `.opencode/skill/${slug}/SKILL.md` },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p
          className="mb-2 text-[11px] text-[var(--text-muted)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Download and save to your agent&apos;s skill directory:
        </p>
        <CommandBlock command={`curl -o SKILL.md ${downloadUrl}`} />
      </div>
      <div className="overflow-hidden rounded border border-[var(--border)] bg-[var(--bg)]">
        {paths.map((p, i) => (
          <div
            key={p.agent}
            className={`flex items-center justify-between px-4 py-2.5 ${
              i > 0 ? "border-t border-[var(--border)]" : ""
            }`}
          >
            <span
              className="text-[12px] text-[var(--text-muted)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {p.agent}
            </span>
            <div className="flex items-center gap-2">
              <code
                className="text-[12px] text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {p.path}
              </code>
              <CopyButton text={p.path} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InstallButtons({ slug }: InstallButtonsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("install");
  const rawUrl = `${SITE}/skills/${slug}/raw`;

  return (
    <div className="mb-10 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] px-3 py-2.5 sm:px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${
              activeTab === tab.id
                ? "filter-pill-active border border-[var(--accent-border)] bg-[var(--accent-glow)] text-[var(--accent)]"
                : "border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 py-4 sm:px-5">
        {activeTab === "install" && <InstallTab slug={slug} />}
        {activeTab === "cursor" && <CursorTab slug={slug} />}
        {activeTab === "manual" && <ManualTab slug={slug} />}
        {activeTab === "download" && (
          <div className="flex items-center gap-3">
            <a
              href={rawUrl}
              download={`${slug}-SKILL.md`}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--accent-border)] bg-[var(--accent-glow)] px-4 py-2.5 text-[12px] font-medium text-[var(--accent)] transition-all hover:bg-[var(--accent)] hover:text-white"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download SKILL.md
            </a>
            <span
              className="text-[11px] text-[var(--text-muted)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Served from cryptoskills.dev
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
