import { getAllSkills, getAllCategories, getAllChains } from "@/lib/registry";
import { SkillGrid } from "@/components/skill-grid";
import { CommandBar } from "@/components/command-bar";

export default function Home() {
  const skills = getAllSkills();
  const categories = getAllCategories();
  const chains = getAllChains();

  const categoryCount = new Set(skills.map((s) => s.category)).size;
  const chainCount = new Set(skills.map((s) => s.chain)).size;

  return (
    <div className="grid-bg min-h-screen">
      <main className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        {/* Header */}
        <header className="pb-10 pt-16 sm:pt-24">
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="text-5xl font-bold tracking-tight sm:text-7xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="text-[var(--text-primary)]">Crypto</span>
                <span className="text-[var(--accent)]">Skills</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--text-secondary)]">
                Open-source agent skills for all of crypto. Production-ready
                protocol knowledge for AI coding agents.
              </p>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <a
                href="https://github.com/0xinit/cryptoskills"
                target="_blank"
                rel="noopener noreferrer"
                className="filter-pill inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs"
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </a>
              <a
                href="/api/registry.json"
                className="filter-pill inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs"
              >
                {"{}"} API
              </a>
            </div>
          </div>

          {/* Stats bar */}
          <div className="glow-line mt-10 flex gap-10 border-t border-[var(--border)] pt-6">
            <div>
              <div
                className="stat-value text-3xl font-bold text-[var(--accent)]"
              >
                {skills.length}
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">
                Skills
              </div>
            </div>
            <div>
              <div className="stat-value text-3xl font-bold text-[var(--text-primary)]">
                {categoryCount}
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">
                Categories
              </div>
            </div>
            <div>
              <div className="stat-value text-3xl font-bold text-[var(--text-primary)]">
                {chainCount}
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">
                Chains
              </div>
            </div>
          </div>
        </header>

        {/* Install command */}
        <CommandBar />

        {/* Grid */}
        <section className="pb-24">
          <SkillGrid
            skills={skills}
            categories={categories}
            chains={chains}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-[var(--text-muted)]">
          <span style={{ fontFamily: "var(--font-mono)" }}>
            cryptoskills.dev
          </span>
          <span className="flex items-center gap-3">
            Built by{" "}
            <a
              href="https://github.com/0xinit"
              className="text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
            >
              Naruto11
            </a>
            <a
              href="https://x.com/naruto11eth"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
