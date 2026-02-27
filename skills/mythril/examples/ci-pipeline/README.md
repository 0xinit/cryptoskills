# CI Pipeline with Mythril

GitHub Actions workflow for automated Mythril analysis with Docker, timeout safeguards, and artifact upload for reports.

## Basic GitHub Actions Workflow

```yaml
# .github/workflows/mythril.yml
name: Mythril Security Scan

on:
  pull_request:
    paths:
      - 'src/**/*.sol'
      - 'contracts/**/*.sol'
  push:
    branches: [main]
    paths:
      - 'src/**/*.sol'
      - 'contracts/**/*.sol'

jobs:
  mythril:
    name: Mythril Analysis
    runs-on: ubuntu-latest
    # Job-level timeout prevents runaway analysis from consuming runner time
    timeout-minutes: 20

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Create report directory
        run: mkdir -p reports

      - name: Run Mythril
        run: |
          docker run --rm \
            --memory=4g \
            --cpus=2 \
            -v "${{ github.workspace }}":/src \
            mythril/myth analyze \
            /src/src/Contract.sol \
            --solv 0.8.28 \
            -t 2 \
            --execution-timeout 300 \
            --solver-timeout 30 \
            -o jsonv2 \
            | tee reports/mythril-report.json

      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mythril-report
          path: reports/
          retention-days: 30
```

## Multi-Contract Scan

Scan all Solidity files in a directory and aggregate results:

```yaml
# .github/workflows/mythril-multi.yml
name: Mythril Multi-Contract Scan

on:
  pull_request:
    paths:
      - 'src/**/*.sol'

jobs:
  mythril:
    name: Mythril Analysis
    runs-on: ubuntu-latest
    timeout-minutes: 45

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Create report directory
        run: mkdir -p reports

      - name: Scan all contracts
        run: |
          FAILED=0

          for sol_file in src/*.sol; do
            [ -f "$sol_file" ] || continue
            filename=$(basename "$sol_file" .sol)
            echo "::group::Analyzing $sol_file"

            # Per-file timeout via the --execution-timeout flag
            docker run --rm \
              --memory=4g \
              --cpus=2 \
              -v "${{ github.workspace }}":/src \
              mythril/myth analyze \
              "/src/$sol_file" \
              --solv 0.8.28 \
              -t 2 \
              --execution-timeout 300 \
              --solver-timeout 30 \
              -o json \
              > "reports/${filename}.json" 2>&1 || FAILED=1

            echo "::endgroup::"
          done

          if [ "$FAILED" -eq 1 ]; then
            echo "::warning::Mythril found issues in one or more contracts"
          fi

      - name: Summarize findings
        if: always()
        run: |
          echo "## Mythril Results" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"

          for report in reports/*.json; do
            [ -f "$report" ] || continue
            filename=$(basename "$report" .json)
            count=$(python3 -c "
          import json, sys
          try:
              data = json.load(open('$report'))
              issues = data.get('issues', [])
              print(len(issues))
          except:
              print('error')
          " 2>/dev/null)

            if [ "$count" = "0" ]; then
              echo "- **$filename**: No issues found" >> "$GITHUB_STEP_SUMMARY"
            elif [ "$count" = "error" ]; then
              echo "- **$filename**: Analysis error (check logs)" >> "$GITHUB_STEP_SUMMARY"
            else
              echo "- **$filename**: $count issue(s) found" >> "$GITHUB_STEP_SUMMARY"
            fi
          done

      - name: Upload Reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mythril-reports
          path: reports/
          retention-days: 30
```

## Combined Slither + Mythril Pipeline

Run Slither for fast feedback, then Mythril for deep analysis:

```yaml
# .github/workflows/security.yml
name: Security Analysis

on:
  pull_request:
    paths:
      - 'src/**/*.sol'

jobs:
  slither:
    name: Slither (Fast)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Run Slither
        uses: crytic/slither-action@v0.4.0
        with:
          target: src/
          sarif: results/slither.sarif
          fail-on: high
          slither-args: --exclude naming-convention,solc-version

      - name: Upload Slither SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results/slither.sarif

  mythril:
    name: Mythril (Deep)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    # Run Mythril in parallel with Slither — do not wait
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Create report directory
        run: mkdir -p reports

      - name: Run Mythril
        run: |
          for sol_file in src/*.sol; do
            [ -f "$sol_file" ] || continue
            filename=$(basename "$sol_file" .sol)
            echo "Analyzing: $sol_file"

            docker run --rm \
              --memory=4g \
              --cpus=2 \
              -v "${{ github.workspace }}":/src \
              mythril/myth analyze \
              "/src/$sol_file" \
              --solv 0.8.28 \
              -t 2 \
              --execution-timeout 300 \
              --solver-timeout 30 \
              -o json \
              > "reports/${filename}-mythril.json" 2>&1 || true
          done

      - name: Upload Mythril Reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mythril-reports
          path: reports/
          retention-days: 30
```

## Foundry Project Integration

For projects using Foundry with `lib/` dependencies and remappings:

```yaml
- name: Run Mythril on Foundry project
  run: |
    docker run --rm \
      --memory=4g \
      -v "${{ github.workspace }}":/src \
      mythril/myth analyze \
      /src/src/Contract.sol \
      --solv 0.8.28 \
      --solc-args "--base-path /src --include-path /src/lib --allow-paths /src" \
      -t 2 \
      --execution-timeout 300 \
      --solver-timeout 30 \
      -o json
```

## Timeout Safeguards

Three layers of timeout protection prevent CI from hanging:

1. **Job-level timeout** (`timeout-minutes: 30`) — GitHub Actions kills the entire job
2. **Docker memory limit** (`--memory=4g`) — prevents OOM from killing the runner
3. **Mythril execution timeout** (`--execution-timeout 300`) — Mythril stops gracefully and returns partial results

Always set all three. If any one is missing, a complex contract can consume the runner for hours.

## Caching Docker Image

Pull the Docker image once and cache it across runs:

```yaml
- name: Cache Mythril Docker image
  id: cache-mythril
  uses: actions/cache@v4
  with:
    path: /tmp/mythril-image.tar
    key: mythril-docker-${{ runner.os }}

- name: Load cached image
  if: steps.cache-mythril.outputs.cache-hit == 'true'
  run: docker load -i /tmp/mythril-image.tar

- name: Pull and cache image
  if: steps.cache-mythril.outputs.cache-hit != 'true'
  run: |
    docker pull mythril/myth:latest
    docker save mythril/myth:latest -o /tmp/mythril-image.tar
```

## PR Comment with Results

Post Mythril findings as a PR comment:

```yaml
- name: Post PR comment
  if: github.event_name == 'pull_request' && always()
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const reports = fs.readdirSync('reports').filter(f => f.endsWith('.json'));

      let body = '## Mythril Security Scan Results\n\n';
      let totalIssues = 0;

      for (const report of reports) {
        const data = JSON.parse(fs.readFileSync(`reports/${report}`, 'utf8'));
        const issues = data.issues || [];
        const name = report.replace('.json', '');

        if (issues.length === 0) {
          body += `**${name}**: No issues found\n\n`;
        } else {
          totalIssues += issues.length;
          body += `**${name}**: ${issues.length} issue(s)\n\n`;
          for (const issue of issues) {
            body += `- \`${issue['swc-id']}\` ${issue.title} (${issue.severity}) in \`${issue.function_name}\`\n`;
          }
          body += '\n';
        }
      }

      body += `\n---\n*${totalIssues} total issue(s) found. Download full reports from artifacts.*`;

      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: body,
      });
```

Last verified: February 2026
