# Halmos CLI Configuration Reference

Complete reference for all Halmos CLI flags and configuration options.

> Last verified: February 2026. Halmos is pre-1.0 — flags may change between releases.

## Usage

```bash
halmos [OPTIONS]
```

Halmos reads Foundry project configuration from `foundry.toml` and searches for `check_` prefixed functions in test contracts.

## Test Selection

| Flag | Default | Description |
|------|---------|-------------|
| `--contract <name>` | All test contracts | Run tests only in the specified contract |
| `--function <name>` | All `check_` functions | Run only the specified test function |
| `--match-contract <regex>` | `.*` | Regex to filter test contracts |
| `--match-test <regex>` | `^check_` | Regex to filter test functions |

```bash
# Run all tests in VaultSymTest
halmos --contract VaultSymTest

# Run specific function
halmos --function check_transfer_preserves_supply

# Run all tests matching a pattern
halmos --match-test "check_transfer"

# Run tests in contracts matching a pattern
halmos --match-contract ".*Sym.*"
```

## Execution Bounds

| Flag | Default | Description |
|------|---------|-------------|
| `--loop <N>` | 2 | Maximum number of loop iterations to unroll |
| `--depth <N>` | Unbounded | Maximum call depth for symbolic execution |
| `--width <N>` | Unbounded | Maximum number of execution paths to explore |
| `--array-lengths <spec>` | Auto | Comma-separated list of array lengths to test |

```bash
# Unroll loops up to 5 iterations
halmos --loop 5

# Limit call depth
halmos --depth 50

# Limit total paths explored
halmos --width 10000

# Test specific array lengths
halmos --array-lengths "0,1,5,10"
```

### Choosing Loop Bounds

| Contract Type | Recommended `--loop` |
|--------------|---------------------|
| No loops | 2 (default) |
| Fixed-size iteration (e.g., 3 signers) | Size + 1 |
| Dynamic arrays with length checks | 5-10 |
| Complex nested loops | 3-5 (watch for path explosion) |
| CI pipeline | 5 (balance speed vs confidence) |

## Solver Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `--solver-timeout-assertion <ms>` | 60000 | Timeout for assertion checking (milliseconds) |
| `--solver-timeout-branching <ms>` | 1000 | Timeout for branch condition solving (milliseconds) |
| `--solver-threads <N>` | 1 | Number of parallel solver threads |
| `--cache-solver` | Off | Cache solver results across paths |

```bash
# Generous timeout for complex math
halmos --solver-timeout-assertion 120000

# Faster branching decisions
halmos --solver-timeout-branching 5000

# Parallel solving (experimental)
halmos --solver-threads 4
```

### Solver Timeout Guidelines

| Scenario | Recommended Timeout |
|----------|-------------------|
| Simple token math | 30000 (30s) |
| DeFi vault with ratio math | 60000 (60s) |
| Complex fixed-point arithmetic | 120000 (120s) |
| AMM curves, sqrt computations | 180000+ (3min+) |
| CI pipeline | 60000 (fail fast) |

## Storage Options

| Flag | Default | Description |
|------|---------|-------------|
| `--storage-layout <mode>` | `solidity` | How to model contract storage |

Storage layout modes:

| Mode | Description | Use When |
|------|-------------|----------|
| `solidity` | Standard Solidity layout (slot computation) | Default — works for most contracts |
| `generic` | Treat all storage as a flat symbolic map | Proxies, non-standard storage, diamondPattern |

```bash
# For proxy contracts or non-standard storage
halmos --storage-layout generic
```

## Output and Debugging

| Flag | Default | Description |
|------|---------|-------------|
| `-v` | Off | Verbose output — show execution paths |
| `-vv` | Off | Extra verbose — show solver queries |
| `--statistics` | Off | Print solver statistics (queries, time per path) |
| `--early-exit` | Off | Stop on first counter-example per test |
| `--dump-smt2` | Off | Dump SMT2 queries to files (for debugging solver issues) |
| `--json-output <path>` | None | Write results as JSON to file |

```bash
# Verbose output for debugging
halmos -v

# Statistics for performance tuning
halmos --statistics

# Stop on first failure (faster CI)
halmos --early-exit

# Machine-readable output
halmos --json-output results.json
```

## Error Handling

| Flag | Default | Description |
|------|---------|-------------|
| `--error-unknown` | Off | Treat solver "unknown" as test failure |

```bash
# Strict mode: unknown = fail (recommended for CI)
halmos --error-unknown
```

## Timeout

| Flag | Default | Description |
|------|---------|-------------|
| `--timeout <seconds>` | 3600 | Global timeout for the entire Halmos run |

```bash
# 10 minute global timeout for CI
halmos --timeout 600
```

## Project Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `--root <path>` | `.` | Project root directory |
| `--foundry-profile <name>` | `default` | Foundry profile to use |

```bash
# Use a specific Foundry profile
halmos --foundry-profile ci

# Run from a different directory
halmos --root /path/to/project
```

## halmos.toml Configuration File

Create `halmos.toml` in the project root for persistent configuration:

```toml
[global]
# Execution bounds
loop = 5
depth = 50

# Solver
solver-timeout-assertion = 60000
solver-timeout-branching = 5000

# Output
statistics = true
early-exit = true

# Storage
storage-layout = "solidity"

# Error handling
error-unknown = false

# Timeout
timeout = 3600
```

`halmos.toml` values are overridden by CLI flags:

```bash
# halmos.toml says loop = 5, but CLI overrides to 10
halmos --loop 10
```

## Recommended CI Configuration

```bash
# Fast CI (< 5 minutes)
halmos \
  --loop 3 \
  --solver-timeout-assertion 30000 \
  --early-exit \
  --timeout 300 \
  --error-unknown

# Thorough CI (< 30 minutes)
halmos \
  --loop 5 \
  --solver-timeout-assertion 120000 \
  --statistics \
  --timeout 1800

# Nightly deep verification (< 2 hours)
halmos \
  --loop 10 \
  --solver-timeout-assertion 300000 \
  --timeout 7200 \
  --json-output halmos-nightly.json
```

## Recommended Development Configuration

```bash
# Quick iteration during development
halmos \
  --function check_myNewProperty \
  --loop 2 \
  --solver-timeout-assertion 30000 \
  -v

# After property passes, increase bounds
halmos \
  --function check_myNewProperty \
  --loop 5 \
  --solver-timeout-assertion 60000 \
  --statistics
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HALMOS_OPTIONS` | Default CLI options (appended to every run) |

```bash
export HALMOS_OPTIONS="--loop 3 --solver-timeout-assertion 60000"
halmos  # uses HALMOS_OPTIONS defaults
halmos --loop 5  # CLI overrides HALMOS_OPTIONS
```

## Foundry Integration

Halmos uses Foundry's compilation output. Ensure your `foundry.toml` is configured:

```toml
[profile.default]
src = "src"
out = "out"
test = "test"
libs = ["lib"]

# Remappings must include halmos-cheatcodes if used
remappings = [
    "forge-std/=lib/forge-std/src/",
    "halmos-cheatcodes/=lib/halmos-cheatcodes/src/",
    "@openzeppelin/=lib/openzeppelin-contracts/",
]

# Optimizer settings affect bytecode — keep consistent between forge and halmos
optimizer = true
optimizer_runs = 200
```

Build before running Halmos:

```bash
forge build && halmos
```
