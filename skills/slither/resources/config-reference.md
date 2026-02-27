# Slither Configuration Reference

Complete `.slither.conf.json` schema. Place at the project root. CLI arguments override config values.

Last verified: February 2026 against Slither v0.10.x

## Full Schema

```json
{
  "detectors_to_run": "",
  "detectors_to_exclude": "",
  "exclude_informational": false,
  "exclude_optimization": false,
  "exclude_low": false,
  "exclude_medium": false,
  "exclude_high": false,
  "filter_paths": "",
  "json": "",
  "sarif": "",
  "zip": "",
  "zip_type": "lzma",
  "markdown_root": "",
  "disable_color": false,
  "solc": "",
  "solc_remaps": "",
  "solc_args": "",
  "solc_disable_warnings": false,
  "compile_force_framework": "",
  "triage_mode": false,
  "generate_patches": false,
  "show_ignored_findings": false
}
```

## Field Reference

### Detector Control

| Field | Type | CLI Equivalent | Description |
|-------|------|----------------|-------------|
| `detectors_to_run` | string | `--detect` | Comma-separated detector IDs. When set, ONLY these detectors run. |
| `detectors_to_exclude` | string | `--exclude` | Comma-separated detector IDs to skip. Runs all others. |
| `exclude_informational` | bool | `--exclude-informational` | Skip all informational severity findings. |
| `exclude_optimization` | bool | `--exclude-optimization` | Skip all optimization severity findings. |
| `exclude_low` | bool | `--exclude-low` | Skip all low severity findings. |
| `exclude_medium` | bool | `--exclude-medium` | Skip all medium severity findings. |
| `exclude_high` | bool | `--exclude-high` | Skip all high severity findings. |

`detectors_to_run` and `detectors_to_exclude` are mutually exclusive. If both are set, `detectors_to_run` takes precedence.

### Path Filtering

| Field | Type | CLI Equivalent | Description |
|-------|------|----------------|-------------|
| `filter_paths` | string | `--filter-paths` | Regex pattern. Findings in matching file paths are excluded from output. Use `\|` to combine patterns. |

Common patterns:

```json
{
  "filter_paths": "node_modules|lib/forge-std|lib/openzeppelin-contracts|test/|script/"
}
```

The regex is matched against the relative file path. `lib/forge-std` matches any file under that directory.

### Output

| Field | Type | CLI Equivalent | Description |
|-------|------|----------------|-------------|
| `json` | string | `--json` | Write JSON report to this path. Use `-` for stdout. |
| `sarif` | string | `--sarif` | Write SARIF report to this path. Used for GitHub Code Scanning. |
| `zip` | string | `--zip` | Write compressed results to this path. |
| `zip_type` | string | `--zip-type` | Compression algorithm: `lzma` (default), `tar.gz`, `zip`. |
| `markdown_root` | string | `--markdown-root` | Base URL for source links in markdown output. |
| `disable_color` | bool | `--disable-color` | Remove ANSI color codes from terminal output. |

### Solidity Compiler

| Field | Type | CLI Equivalent | Description |
|-------|------|----------------|-------------|
| `solc` | string | `--solc` | Path to solc binary, or version string (e.g., `"0.8.28"`). |
| `solc_remaps` | string | `--solc-remaps` | Import remappings, semicolon-separated. |
| `solc_args` | string | `--solc-args` | Extra arguments passed to solc. |
| `solc_disable_warnings` | bool | `--solc-disable-warnings` | Suppress solc compilation warnings from output. |

#### Remapping Format

```json
{
  "solc_remaps": "@openzeppelin/=lib/openzeppelin-contracts/;forge-std/=lib/forge-std/src/;solmate/=lib/solmate/src/"
}
```

For Foundry projects, Slither reads `remappings.txt` automatically. Use `solc_remaps` only when automatic detection fails.

### Framework

| Field | Type | CLI Equivalent | Description |
|-------|------|----------------|-------------|
| `compile_force_framework` | string | `--compile-force-framework` | Override auto-detection. Values: `foundry`, `hardhat`, `truffle`, `brownie`, `dapp`, `etherlime`, `waffle`, `npx`, `embark`, `standard`. |

Auto-detection order:
1. `foundry.toml` present → Foundry
2. `hardhat.config.js` or `hardhat.config.ts` present → Hardhat
3. `truffle-config.js` present → Truffle
4. `brownie-config.yaml` present → Brownie
5. Falls back to raw solc

### Triage

| Field | Type | CLI Equivalent | Description |
|-------|------|----------------|-------------|
| `triage_mode` | bool | `--triage-mode` | Interactive mode: prompts per-finding to hide/show. Saves to `slither.db.json`. |
| `generate_patches` | bool | `--generate-patches` | Generate automatic fix patches for supported detectors. |
| `show_ignored_findings` | bool | `--show-ignored-findings` | Show findings hidden via `slither.db.json`. |

## Precedence Rules

1. CLI arguments override config file values
2. `detectors_to_run` overrides `detectors_to_exclude`
3. Severity exclusions (`exclude_low`, etc.) combine with detector-level exclusions
4. `filter_paths` applies after detection — findings are generated but filtered from output
5. `slither.db.json` triage decisions apply last — hidden findings are suppressed regardless of other settings

## Example Configurations

### Foundry Project — Development

Permissive: show everything except noise, for early development.

```json
{
  "filter_paths": "lib/forge-std|lib/openzeppelin-contracts",
  "detectors_to_exclude": "naming-convention,pragma",
  "exclude_optimization": true,
  "solc_disable_warnings": true
}
```

### Foundry Project — Pre-Audit

Strict: show all findings including informational, exclude only dependencies.

```json
{
  "filter_paths": "lib/forge-std|lib/openzeppelin-contracts",
  "exclude_optimization": false,
  "exclude_informational": false,
  "json": "slither-report.json",
  "sarif": "slither-report.sarif"
}
```

### Hardhat Project — CI

Focus on actionable findings, JSON output for processing.

```json
{
  "filter_paths": "node_modules",
  "detectors_to_exclude": "naming-convention,solc-version,pragma,dead-code,assembly",
  "exclude_informational": true,
  "exclude_optimization": true,
  "json": "slither-report.json",
  "solc_disable_warnings": true
}
```

### Monorepo — Scoped Analysis

Target specific contracts in a large codebase.

```json
{
  "filter_paths": "node_modules|lib/|contracts/mocks/|contracts/test/",
  "exclude_optimization": true,
  "detectors_to_exclude": "naming-convention,solc-version,pragma",
  "json": "slither-report.json"
}
```

### Upgradeable Contracts

Include all detectors relevant to proxy patterns.

```json
{
  "detectors_to_run": "unprotected-upgrade,shadowing-state,delegatecall-loop,controlled-delegatecall,reentrancy-eth,reentrancy-no-eth,unchecked-transfer,arbitrary-send-eth,arbitrary-send-erc20,suicidal",
  "filter_paths": "lib/forge-std|node_modules",
  "json": "slither-upgrade-check.json"
}
```

## slither.db.json

The triage database stores per-finding hide/show decisions. Structure:

```json
{
  "0x<finding-hash>": {
    "hide": true,
    "description": "Reentrancy in Vault.deposit()...",
    "timestamp": "2026-02-27T10:00:00Z"
  }
}
```

- Generated by `--triage-mode` interactive prompts
- Read automatically on subsequent runs
- Commit to version control for team-wide triage persistence
- Delete the file to reset all triage decisions
- Use `--show-ignored-findings` to display hidden results temporarily
