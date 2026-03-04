import { getAllSkills, getAllCategories, getAllChains } from "@/lib/registry";
import { SkillGrid } from "@/components/skill-grid";

export default function Home() {
  const skills = getAllSkills();
  const categories = getAllCategories();
  const chains = getAllChains();

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
          CryptoSkills
        </h1>
        <p className="mt-3 text-lg text-zinc-400">
          Agent skills for all of crypto.{" "}
          <span className="text-zinc-500">
            {skills.length} protocols — production-ready code for AI coding
            agents.
          </span>
        </p>
        <div className="mt-4 flex gap-3">
          <a
            href="https://github.com/0xinit/cryptoskills"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
          <a
            href="/api/registry.json"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
          >
            API
          </a>
        </div>
      </div>

      <SkillGrid skills={skills} categories={categories} chains={chains} />
    </main>
  );
}
