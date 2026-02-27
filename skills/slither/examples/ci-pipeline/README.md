# Slither CI/CD Pipeline

GitHub Actions workflow that runs Slither on every PR affecting Solidity files. Includes SARIF integration for GitHub Code Scanning, configurable severity thresholds, and caching.

## Workflow File

### .github/workflows/slither.yml

```yaml
name: Slither Analysis

on:
  pull_request:
    paths:
      - "src/**"
      - "contracts/**"
      - "foundry.toml"
      - "remappings.txt"
      - ".slither.conf.json"
  push:
    branches: [main]

jobs:
  analyze:
    name: Static Analysis
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Run Slither
        uses: crytic/slither-action@v0.4.1
        id: slither
        with:
          fail-on: medium
          sarif: results.sarif
          slither-args: >-
            --filter-paths "lib/forge-std|lib/openzeppelin-contracts|node_modules"
            --exclude naming-convention,solc-version,pragma,dead-code
            --exclude-optimization

      - name: Upload SARIF to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif

      - name: Upload JSON report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: slither-report
          path: results.sarif
          retention-days: 30
```

## How It Works

1. **Trigger**: Runs on PRs that modify Solidity source or build config. Also runs on pushes to `main` for baseline tracking.
2. **Submodules**: `submodules: recursive` ensures Foundry dependencies (`lib/`) are available.
3. **slither-action**: Installs Python, solc, and Slither. Compiles the project automatically (detects Foundry/Hardhat).
4. **fail-on: medium**: The job fails if any medium or high severity finding exists. Low and informational findings are reported but do not block merge.
5. **SARIF upload**: Findings appear in the repository's Security tab under Code Scanning. Developers see inline annotations on PR diffs.
6. **Artifact upload**: Raw report preserved for 30 days for audit trail.

## Foundry-Specific Variant

For projects that need explicit Foundry installation (when slither-action's auto-detection fails):

```yaml
name: Slither (Foundry)

on:
  pull_request:
    paths: ["src/**", "foundry.toml"]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write

    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1

      - name: Compile
        run: forge build

      - name: Install Slither
        run: pip install slither-analyzer

      - name: Run Slither
        run: |
          slither . \
            --filter-paths "lib/forge-std|lib/openzeppelin-contracts" \
            --exclude naming-convention,solc-version,pragma \
            --exclude-optimization \
            --sarif results.sarif \
            --json slither-report.json \
            --fail-on medium

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif

      - name: Upload JSON report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: slither-report
          path: slither-report.json
```

## Hardhat-Specific Variant

```yaml
name: Slither (Hardhat)

on:
  pull_request:
    paths: ["contracts/**", "hardhat.config.*"]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run Slither
        uses: crytic/slither-action@v0.4.1
        with:
          node-version: 20
          fail-on: medium
          sarif: results.sarif
          slither-args: >-
            --filter-paths "node_modules"
            --exclude naming-convention,solc-version,pragma

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif
```

## Custom Detectors in CI

Install custom detector packages via `slither-plugins`:

```yaml
      - name: Run Slither with custom detectors
        uses: crytic/slither-action@v0.4.1
        with:
          fail-on: medium
          sarif: results.sarif
          slither-plugins: requirements-slither.txt
```

```text
# requirements-slither.txt
my-slither-detectors>=0.1.0
```

## Project Configuration

Pair the workflow with `.slither.conf.json` at the project root:

```json
{
  "filter_paths": "lib/forge-std|lib/openzeppelin-contracts|node_modules",
  "detectors_to_exclude": "naming-convention,solc-version,pragma,dead-code",
  "exclude_optimization": true,
  "exclude_informational": false,
  "exclude_low": false
}
```

When `.slither.conf.json` exists, the workflow can simplify to:

```yaml
      - name: Run Slither
        uses: crytic/slither-action@v0.4.1
        with:
          fail-on: medium
          sarif: results.sarif
```

The action reads the config file automatically.

## Severity Threshold Reference

| `fail-on` value | Blocks PR on |
|------------------|-------------|
| `none` | Never fails (report only) |
| `low` | Low + Medium + High |
| `medium` | Medium + High |
| `high` | High only |
| `all` | Any finding (default) |

Choose `medium` for most projects. Use `high` during early development when the codebase has many informational findings. Switch to `low` or `all` before mainnet deployment.

## Triage Workflow with slither.db.json

For established projects with known false positives:

1. Run `slither . --triage-mode` locally
2. Review each finding, marking false positives as hidden
3. Commit `slither.db.json` to the repository
4. CI runs will automatically skip hidden findings

```yaml
      - name: Run Slither (with triage database)
        run: |
          slither . \
            --filter-paths "lib/forge-std|lib/openzeppelin-contracts" \
            --sarif results.sarif \
            --fail-on medium
```

Slither reads `slither.db.json` automatically when present.

Last verified: February 2026
