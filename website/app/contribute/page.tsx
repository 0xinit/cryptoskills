import Link from "next/link";
import { getAllSkills } from "@/lib/registry";
import { getSkillContent } from "@/lib/skills";
import { renderMarkdown, stripFrontmatter } from "@/lib/markdown";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Your Own Skill — CryptoSkills",
  description:
    "Step-by-step guide for creating enriched agent skills for the CryptoSkills directory. Learn the pattern, structure, and quality standards.",
  openGraph: {
    title: "Create Your Own Skill | CryptoSkills",
    description:
      "Learn how to create production-ready agent skills for the CryptoSkills directory.",
    type: "article",
  },
};

export default async function ContributePage() {
  const skills = getAllSkills();
  const rawContent = getSkillContent("crypto-skill-creator");
  const html = rawContent
    ? await renderMarkdown(stripFrontmatter(rawContent))
    : "";

  return (
    <div className="grid-bg min-h-screen">
      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 lg:px-12">
        {/* Breadcrumb */}
        <Link
          href="/"
          className="group mb-8 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <svg
            className="h-3 w-3 transition-transform group-hover:-translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          skills/
        </Link>

        {/* Header */}
        <header className="mb-10">
          <h1
            className="text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Create Your Own{" "}
            <span className="text-[var(--accent)]">Skill</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
            Every skill in the directory follows the same enriched pattern.
            Install this skill in your agent, or read the guide below to build
            one from scratch.
          </p>

          {/* Quick actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
              <span
                className="text-[var(--text-muted)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                $
              </span>
              <code
                className="text-xs text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                npx cryptoskills install{" "}
                <span className="text-[var(--accent)]">
                  crypto-skill-creator
                </span>
              </code>
            </div>
            <a
              href="https://github.com/0xinit/cryptoskills/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className="filter-pill inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-xs"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Contributing Guide
            </a>
            <a
              href="https://github.com/0xinit/cryptoskills/blob/main/template/SKILL.md"
              target="_blank"
              rel="noopener noreferrer"
              className="filter-pill inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-xs"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Skill Template
            </a>
          </div>

          {/* Stats */}
          <div className="glow-line mt-6 flex gap-6 border-t border-[var(--border)] pt-5">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full text-emerald-400 bg-emerald-400" />
              <span
                className="text-xs text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {skills.length} skills in directory
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full text-blue-400 bg-blue-400" />
              <span
                className="text-xs text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                10 files per skill
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full text-violet-400 bg-violet-400" />
              <span
                className="text-xs text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Apache-2.0
              </span>
            </div>
          </div>
        </header>

        {/* Rendered crypto-skill-creator SKILL.md */}
        <article
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Footer nav */}
        <div className="mt-16 border-t border-[var(--border)] pt-8">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            All Skills
          </Link>
        </div>
      </main>
    </div>
  );
}
