# CI/CD Pipeline for Semgrep

Set up GitHub Actions and pre-commit hooks to run Semgrep on every pull request targeting Solidity contracts.

## GitHub Actions Workflow

Create `.github/workflows/semgrep.yml`:

```yaml
name: Semgrep Security Scan

on:
  pull_request:
    paths:
      - "contracts/**"
      - "src/**"
      - ".semgrep/**"
  push:
    branches: [main, develop]

permissions:
  contents: read
  security-events: write  # Required for SARIF upload

jobs:
  semgrep:
    name: Solidity Security Scan
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install Semgrep
        run: pip install semgrep

      - name: Clone community rules
        run: |
          git clone --depth 1 \
            https://github.com/Decurity/semgrep-smart-contracts.git \
            /tmp/community-rules

      - name: Run Semgrep (custom + community rules)
        run: |
          semgrep \
            --config .semgrep/ \
            --config /tmp/community-rules/solidity/security/ \
            --sarif \
            --output semgrep-results.sarif \
            --severity WARNING \
            --timeout 30 \
            --max-memory 2048 \
            --exclude "test/*" \
            --exclude "lib/*" \
            --exclude "node_modules/*" \
            contracts/ src/

      - name: Upload SARIF to GitHub Security
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep-results.sarif
          category: semgrep

      - name: Fail on ERROR severity findings
        run: |
          semgrep \
            --config .semgrep/ \
            --config /tmp/community-rules/solidity/security/ \
            --severity ERROR \
            --error \
            --quiet \
            --exclude "test/*" \
            --exclude "lib/*" \
            contracts/ src/
```

### What This Does

1. **Triggers** on PRs that touch Solidity files or Semgrep rules
2. **Runs** both custom project rules (`.semgrep/`) and community rules
3. **Uploads SARIF** so findings appear in GitHub's Security tab
4. **Fails the build** only on ERROR severity — WARNINGs appear in SARIF but don't block merge

## Pre-commit Hook

### Setup

```bash
pip install pre-commit
```

Create `.pre-commit-config.yaml` in project root:

```yaml
repos:
  - repo: https://github.com/semgrep/semgrep
    rev: v1.108.0  # Pin to specific version for reproducibility
    hooks:
      - id: semgrep
        name: Semgrep Solidity Security
        args:
          - --config
          - .semgrep/
          - --error
          - --severity
          - ERROR
          - --exclude
          - "test/*"
          - --exclude
          - "lib/*"
        files: \.sol$
        # Increase timeout for large projects
        stages: [pre-commit]
```

Install the hook:

```bash
pre-commit install

# Verify it works
pre-commit run semgrep --all-files
```

### Skipping the Hook (Emergency)

```bash
# Skip pre-commit hooks for a single commit (use sparingly)
git commit --no-verify -m "hotfix: emergency patch"
```

## Makefile Integration

Add Semgrep targets to your project Makefile:

```makefile
# Makefile

SEMGREP_CONFIG := .semgrep/
COMMUNITY_RULES := /tmp/semgrep-smart-contracts/solidity/security/
CONTRACTS_DIR := contracts/
EXCLUDE_DIRS := --exclude "test/*" --exclude "lib/*" --exclude "node_modules/*"

.PHONY: semgrep semgrep-ci semgrep-test semgrep-fix

## Run Semgrep scan (development — shows all findings)
semgrep:
	semgrep --config $(SEMGREP_CONFIG) $(EXCLUDE_DIRS) $(CONTRACTS_DIR)

## Run Semgrep scan (CI — fails on errors, SARIF output)
semgrep-ci:
	@if [ ! -d "/tmp/semgrep-smart-contracts" ]; then \
		git clone --depth 1 https://github.com/Decurity/semgrep-smart-contracts.git /tmp/semgrep-smart-contracts; \
	fi
	semgrep \
		--config $(SEMGREP_CONFIG) \
		--config $(COMMUNITY_RULES) \
		--sarif --output results.sarif \
		--severity WARNING \
		$(EXCLUDE_DIRS) $(CONTRACTS_DIR)
	semgrep \
		--config $(SEMGREP_CONFIG) \
		--config $(COMMUNITY_RULES) \
		--error --severity ERROR \
		$(EXCLUDE_DIRS) $(CONTRACTS_DIR)

## Test Semgrep rules
semgrep-test:
	semgrep --test $(SEMGREP_CONFIG)

## Apply autofixes
semgrep-fix:
	semgrep --config $(SEMGREP_CONFIG) --autofix $(EXCLUDE_DIRS) $(CONTRACTS_DIR)
```

Usage:

```bash
make semgrep          # Local scan
make semgrep-ci       # CI-style scan with error gating
make semgrep-test     # Test rule correctness
make semgrep-fix      # Auto-apply fixes
```

## Differential Scanning (PR-only Changes)

Scan only files changed in the current PR:

```yaml
# .github/workflows/semgrep-diff.yml
name: Semgrep Diff Scan

on:
  pull_request:
    paths:
      - "contracts/**"
      - "src/**"

jobs:
  semgrep-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Semgrep
        run: pip install semgrep

      - name: Get changed Solidity files
        id: changed
        run: |
          FILES=$(git diff --name-only origin/${{ github.base_ref }}...HEAD -- '*.sol' | tr '\n' ' ')
          echo "files=$FILES" >> "$GITHUB_OUTPUT"

      - name: Run Semgrep on changed files
        if: steps.changed.outputs.files != ''
        run: |
          semgrep \
            --config .semgrep/ \
            --error \
            --severity ERROR \
            ${{ steps.changed.outputs.files }}
```

## PR Comment Integration

Post Semgrep findings as PR comments using `jq` + GitHub API:

```yaml
      - name: Run Semgrep (JSON)
        id: scan
        run: |
          semgrep \
            --config .semgrep/ \
            --json \
            --severity WARNING \
            contracts/ > semgrep-output.json || true

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('semgrep-output.json', 'utf8'));
            if (results.results.length === 0) return;

            let body = '## Semgrep Security Findings\n\n';
            body += `Found **${results.results.length}** issue(s):\n\n`;

            for (const r of results.results) {
              const severity = r.extra.severity.toUpperCase();
              const icon = severity === 'ERROR' ? '🔴' : '🟡';
              body += `${icon} **${r.check_id}** (${severity})\n`;
              body += `  \`${r.path}:${r.start.line}\`\n`;
              body += `  ${r.extra.message}\n\n`;
            }

            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: body
            });
```

## Caching for Faster CI

```yaml
      - name: Cache Semgrep
        uses: actions/cache@v4
        with:
          path: ~/.cache/semgrep
          key: semgrep-${{ hashFiles('.semgrep/**') }}

      - name: Cache community rules
        uses: actions/cache@v4
        with:
          path: /tmp/community-rules
          key: semgrep-community-${{ github.run_id }}
          restore-keys: semgrep-community-
```

## Complete Project Structure

```
your-project/
├── .github/
│   └── workflows/
│       └── semgrep.yml            # CI workflow
├── .semgrep/
│   ├── vault-rules.yaml           # Custom rules
│   ├── vault-rules.sol            # Rule tests
│   └── project-specific.yaml      # More custom rules
├── .pre-commit-config.yaml        # Pre-commit hook
├── Makefile                       # Build targets
├── contracts/
│   └── Vault.sol
└── test/
    └── Vault.t.sol
```

## Key Takeaways

1. Use SARIF output + `github/codeql-action/upload-sarif` for GitHub Security tab integration
2. Gate merges on ERROR severity only — WARNINGs inform but don't block
3. Pin Semgrep version in pre-commit config for reproducible builds
4. Differential scanning (changed files only) keeps CI fast on large codebases
5. Cache community rules to avoid cloning on every run
6. Run `semgrep --test` in CI to validate your custom rules don't break

Last verified: February 2026
