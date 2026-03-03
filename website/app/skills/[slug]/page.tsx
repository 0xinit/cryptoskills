import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllSkills, getSkillBySlug } from "@/lib/registry";
import { getSkillContent, getSkillExamples } from "@/lib/skills";
import { renderMarkdown, stripFrontmatter } from "@/lib/markdown";
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
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All Skills
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
          {skill.name}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-indigo-800 bg-indigo-900/40 px-3 py-1 text-xs font-medium text-indigo-300">
            {skill.category}
          </span>
          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400">
            {skill.chain}
          </span>
          {skill.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Metadata badges */}
      <div className="mb-8 flex flex-wrap gap-4 text-sm text-zinc-500">
        {skill.hasExamples && (
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Examples ({examples.length})
          </span>
        )}
        {skill.hasDocs && (
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Docs
          </span>
        )}
        {skill.hasResources && (
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Resources
          </span>
        )}
        {skill.hasTemplates && (
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            Templates
          </span>
        )}
      </div>

      {/* Rendered SKILL.md */}
      <article
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
