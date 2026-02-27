# Mythril CLI Configuration Reference

Complete reference of Mythril command-line flags and options.

## Commands

### myth analyze

The primary command. Analyzes a Solidity source file or bytecode for vulnerabilities.

```bash
myth analyze [OPTIONS] <SOLIDITY_FILE>
```

### myth version

Print the installed Mythril version.

```bash
myth version
```

### myth disassemble

Disassemble a contract to EVM opcodes.

```bash
myth disassemble --bin-runtime -c "0x6080..."
myth disassemble -a 0x1234... --rpc-url https://eth-mainnet.rpc.url
```

### myth read-storage

Read storage slots from a deployed contract.

```bash
myth read-storage --rpc-url https://eth-mainnet.rpc.url -a 0x1234... 0 10
```

## Input Options

| Flag | Description | Example |
|------|-------------|---------|
| `<SOLIDITY_FILE>` | Path to Solidity source file | `myth analyze src/Vault.sol` |
| `--solv <VERSION>` | Solc version to use for compilation | `--solv 0.8.28` |
| `--solc-args <ARGS>` | Additional arguments passed to solc | `--solc-args "--base-path . --include-path lib"` |
| `-c <CODE>` | Raw bytecode to analyze (hex string) | `-c "0x6080604052..."` |
| `-f <FILE>` | File containing raw bytecode | `-f bytecode.bin` |
| `--bin-runtime` | Treat input as runtime bytecode (not creation code) | `--bin-runtime -c "0x..."` |
| `--address <ADDR>` | Analyze a deployed contract at this address | `--address 0xdAC1...` |
| `--rpc-url <URL>` | RPC endpoint for on-chain analysis | `--rpc-url https://eth-mainnet.g.alchemy.com/v2/KEY` |
| `--rpc <PRESET>` | Named RPC preset (e.g., `infura-mainnet`) | `--rpc infura-mainnet` |

## Analysis Control

| Flag | Default | Description |
|------|---------|-------------|
| `-t <N>` | 2 | Number of transactions to simulate. Higher = deeper but exponentially slower. |
| `--execution-timeout <SECS>` | None | Max total seconds for analysis. Without this, analysis may run indefinitely. |
| `--solver-timeout <MS>` | 10000 | Max milliseconds per Z3 solver query. |
| `--max-depth <N>` | 128 | Max depth of the symbolic execution tree. |
| `--loop-bound <N>` | 3 | Max number of loop iterations to unroll. |
| `--call-depth-limit <N>` | 3 | Max depth for inter-contract calls. |
| `--strategy <NAME>` | `bfs` | Search strategy for state space exploration. |
| `--enable-physics` | Off | Enable gas-based path prioritization. |
| `--create-timeout <SECS>` | None | Timeout for contract creation transaction analysis. |
| `--parallel-solving` | Off | Use parallel Z3 solving (experimental). |

### Search Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| `bfs` | Breadth-first search (default) | Balanced coverage |
| `dfs` | Depth-first search | Finding deep paths fast |
| `naive-random` | Random path selection | Diverse coverage |
| `weighted-random` | Weighted random favoring unexplored paths | Complex contracts |

```bash
myth analyze Contract.sol --strategy weighted-random -t 2 --execution-timeout 300
```

## Module Selection

| Flag | Description | Example |
|------|-------------|---------|
| `-m <MODULES>` | Run only specified modules (comma-separated) | `-m reentrancy,ether_thief` |
| `--exclude-modules <MODULES>` | Exclude specific modules | `--exclude-modules integer,exceptions` |

### Available Modules

| Module Name | SWC | Vulnerability |
|-------------|-----|---------------|
| `ether_thief` | 105 | Unprotected Ether withdrawal |
| `suicide` | 106 | Unprotected selfdestruct |
| `state_change_external_calls` | 107 | Reentrancy |
| `delegatecall` | 112 | Delegatecall to untrusted callee |
| `integer` | 101 | Integer overflow/underflow |
| `unchecked_retval` | 104 | Unchecked call return value |
| `tx_origin` | 115 | tx.origin authorization |
| `exceptions` | 110 | Reachable assert violation |
| `external_calls` | 107 | Dangerous external call patterns |
| `arbitrary_write` | 124 | Arbitrary storage write |
| `arbitrary_read` | N/A | Arbitrary storage read |
| `multiple_sends` | 113 | Multiple sends in single tx |
| `dependence_on_predictable_vars` | 116, 120 | Block variable dependence |

## Output Options

| Flag | Description | Example |
|------|-------------|---------|
| `-o <FORMAT>` | Output format | `-o json`, `-o jsonv2`, `-o markdown`, `-o text` |
| `-v <LEVEL>` | Verbosity (0-5) | `-v 4` |
| `--solver-log <PATH>` | Log Z3 queries to file | `--solver-log z3-queries.log` |

### Output Formats

| Format | Flag | Use Case |
|--------|------|----------|
| Text | `-o text` | Human-readable terminal output (default) |
| JSON | `-o json` | Programmatic processing, CI pipelines |
| JSON v2 | `-o jsonv2` | Enhanced JSON with source mappings |
| Markdown | `-o markdown` | Documentation, reports |

### Verbosity Levels

| Level | Output |
|-------|--------|
| 0 | Findings only (default) |
| 1 | + analysis progress |
| 2 | + module execution details |
| 3 | + symbolic execution state |
| 4 | + Z3 solver queries |
| 5 | + full trace (very verbose) |

## Practical Flag Combinations

### Quick Dev Scan

```bash
myth analyze Contract.sol \
  --solv 0.8.28 \
  -t 1 \
  --execution-timeout 120 \
  --solver-timeout 10000 \
  --max-depth 50
```

### CI Pipeline

```bash
myth analyze Contract.sol \
  --solv 0.8.28 \
  -t 2 \
  --execution-timeout 300 \
  --solver-timeout 30000 \
  --max-depth 64 \
  -o jsonv2
```

### Pre-Audit Deep Scan

```bash
myth analyze Contract.sol \
  --solv 0.8.28 \
  -t 3 \
  --execution-timeout 3600 \
  --solver-timeout 60000 \
  --max-depth 128 \
  --strategy weighted-random \
  -o json
```

### Reentrancy-Only Focused Scan

```bash
myth analyze Contract.sol \
  --solv 0.8.28 \
  -m state_change_external_calls \
  -t 3 \
  --execution-timeout 600 \
  --solver-timeout 30000
```

### On-Chain Contract Analysis

```bash
myth analyze \
  --address 0xdAC17F958D2ee523a2206206994597C13D831ec7 \
  --rpc-url https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_KEY \
  -t 2 \
  --execution-timeout 600 \
  --solver-timeout 30000 \
  -o json
```

### Foundry Project with Import Resolution

```bash
myth analyze src/Contract.sol \
  --solv 0.8.28 \
  --solc-args "--base-path . --include-path lib --allow-paths ." \
  -t 2 \
  --execution-timeout 300
```

### Hardhat Project with Import Resolution

```bash
myth analyze contracts/Contract.sol \
  --solv 0.8.28 \
  --solc-args "--base-path . --include-path node_modules" \
  -t 2 \
  --execution-timeout 300
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MYTHRIL_DIR` | Directory for Mythril data (solc binaries, etc.) |
| `INFURA_ID` | Infura project ID for `--rpc infura-mainnet` preset |

## Docker-Specific Flags

When running via Docker, mount volumes and set resource limits:

```bash
docker run \
  --memory=4g \
  --cpus=2 \
  --user "$(id -u):$(id -g)" \
  -v "$(pwd)":/src \
  mythril/myth analyze /src/Contract.sol \
  --solv 0.8.28 \
  -t 2 \
  --execution-timeout 300
```

| Docker Flag | Purpose |
|-------------|---------|
| `--memory=4g` | Prevent OOM from killing host |
| `--cpus=2` | Limit CPU usage |
| `--user "$(id -u):$(id -g)"` | Fix file permission issues |
| `-v "$(pwd)":/src` | Mount project directory |

Last verified: February 2026
