import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllSkills, getSkillBySlug } from "@/lib/registry";
import { getSkillContent, getSkillExamples } from "@/lib/skills";
import { renderMarkdown, stripFrontmatter } from "@/lib/markdown";
import { InstallButtons } from "@/components/install-buttons";
import { ViewTracker } from "@/components/view-tracker";
import type { Metadata } from "next";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllSkills().map((skill) => ({ slug: skill.name }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);
  if (!skill) return {};

  return {
    title: `${skill.name} — ${skill.category}`,
    description: skill.description,
    openGraph: {
      title: `${skill.name} | CryptoSkills`,
      description: skill.description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${skill.name} | CryptoSkills`,
      description: skill.description,
    },
  };
}

const GITHUB_BASE =
  "https://github.com/0xinit/cryptoskills/tree/main/skills";

const STAT_ITEMS = [
  {
    key: "hasExamples" as const,
    label: "Examples",
    color: "text-emerald-400",
    dir: "examples",
  },
  {
    key: "hasDocs" as const,
    label: "Docs",
    color: "text-blue-400",
    dir: "docs",
  },
  {
    key: "hasResources" as const,
    label: "Resources",
    color: "text-amber-400",
    dir: "resources",
  },
  {
    key: "hasTemplates" as const,
    label: "Templates",
    color: "text-violet-400",
    dir: "templates",
  },
];

export default async function SkillPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);
  if (!skill) notFound();

  const rawContent = getSkillContent(slug);
  if (!rawContent) notFound();

  const markdownBody = stripFrontmatter(rawContent);
  const html = await renderMarkdown(markdownBody);
  const examples = getSkillExamples(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `${skill.name} — ${skill.category}`,
    description: skill.description,
    author: { "@type": "Person", name: skill.author },
    keywords: skill.tags.join(", "),
  };

  return (
    <div className="grid-bg min-h-screen">
      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 lg:px-12">
        <ViewTracker slug={slug} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

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
            {skill.name}
          </h1>

          {/* Meta row */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className="rounded border border-[var(--accent-border)] bg-[var(--accent-glow)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {skill.category}
            </span>
            <span
              className="rounded border border-[var(--border)] px-2.5 py-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {skill.chain}
            </span>
            <span className="text-[var(--text-muted)]">|</span>
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] text-[var(--text-muted)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Content indicators */}
          <div className="glow-line mt-6 flex gap-6 border-t border-[var(--border)] pt-5">
            {STAT_ITEMS.map(
              (item) =>
                skill[item.key] && (
                  <a
                    key={item.key}
                    href={`${GITHUB_BASE}/${slug}/${item.dir}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 transition-colors hover:opacity-80"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${item.color}`}
                    />
                    <span
                      className="text-xs text-[var(--text-secondary)] underline decoration-[var(--border)] underline-offset-2 transition-colors hover:decoration-[var(--text-secondary)]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {item.label}
                      {item.key === "hasExamples" && examples.length > 0
                        ? ` (${examples.length})`
                        : ""}
                    </span>
                  </a>
                )
            )}
          </div>
        </header>

        {/* Install options */}
        <InstallButtons slug={slug} skillContent={rawContent} />

        {/* Rendered SKILL.md */}
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
