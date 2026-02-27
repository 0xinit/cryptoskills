# Echidna Configuration Reference

Complete reference for all `echidna.yaml` configuration options. Values shown are defaults unless noted.

## Test Execution

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `testLimit` | integer | `50000` | Number of transactions to generate per property test |
| `seqLen` | integer | `100` | Maximum length of transaction sequences before checking properties |
| `shrinkLimit` | integer | `5000` | Maximum attempts to minimize a failing transaction sequence |
| `testMode` | string | `"property"` | Testing mode: `"property"`, `"assertion"`, `"optimization"`, `"dapptest"` |
| `testTimeout` | integer | `300` | Timeout per test in seconds. `0` disables timeout |
| `stopOnFail` | boolean | `false` | Stop all testing after first property failure |
| `seed` | integer | random | Random seed for reproducibility. Set to a fixed value for deterministic runs |

## Addresses

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `deployer` | address | `"0x30000"` | Address that deploys the contract (msg.sender in constructor) |
| `sender` | address[] | `["0x10000", "0x20000", "0x30000"]` | Addresses used as msg.sender for generated transactions |
| `contractAddr` | address | `"0x00a329c0648769A73afAc7F9381E08FB43dBEA72"` | Address where the test contract is deployed |

## Balances

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `balanceAddr` | integer | `0xffffffff` | ETH balance (in wei) given to each sender address |
| `balanceContract` | integer | `0` | ETH balance (in wei) given to the deployed contract |

## Corpus and Coverage

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `corpusDir` | string | `null` | Directory to save/load corpus. `null` disables persistence |
| `coverage` | boolean | `true` | Enable coverage-guided mutation |
| `dictionary` | string | `null` | Path to a file with hex-encoded values to seed the fuzzer |

## Compilation

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cryticArgs` | string[] | `[]` | Extra arguments passed to crytic-compile |
| `solcArgs` | string | `""` | Extra arguments passed to solc |
| `solcLibs` | string[] | `[]` | Libraries to link (format: `"LibName:0xAddress"`) |

## Display and Output

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | string | `"text"` | Output format: `"text"`, `"json"`, `"none"` |
| `quiet` | boolean | `false` | Suppress non-essential output |

## Parallelism

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `workers` | integer | `1` | Number of parallel fuzzing workers |

## Contract Filtering

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allContracts` | boolean | `false` | Call functions on all deployed contracts, not just the test contract |
| `filterFunctions` | string[] | `[]` | Only fuzz these function signatures (allowlist) |
| `filterBlacklist` | boolean | `true` | When `true`, `filterFunctions` is a blocklist. When `false`, it is an allowlist |

## Transaction Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxGas` | integer | `12500000` | Maximum gas per transaction |
| `maxTimeDelay` | integer | `604800` | Maximum time delay between transactions (seconds) |
| `maxBlockDelay` | integer | `60480` | Maximum block number increase between transactions |

---

## Full Example Configuration

```yaml
# ===== Test Execution =====
testLimit: 100000
seqLen: 100
shrinkLimit: 5000
testMode: "property"
testTimeout: 300
stopOnFail: false
# seed: 42  # uncomment for reproducible runs

# ===== Addresses =====
deployer: "0x30000"
sender: ["0x10000", "0x20000"]
contractAddr: "0x00a329c0648769A73afAc7F9381E08FB43dBEA72"

# ===== Balances =====
balanceAddr: 0xffffffffffffffffffffffff
balanceContract: 0xffffffffffffffffffffffff

# ===== Corpus and Coverage =====
corpusDir: "corpus"
coverage: true
# dictionary: "dict.txt"

# ===== Compilation (Foundry project) =====
cryticArgs: ["--compile-force-framework", "foundry"]

# ===== Display =====
format: "text"
quiet: false

# ===== Parallelism =====
workers: 4

# ===== Contract Filtering =====
allContracts: false
# filterFunctions: ["mint(address,uint256)", "burn(uint256)"]
# filterBlacklist: true

# ===== Transaction Parameters =====
maxGas: 12500000
maxTimeDelay: 604800
maxBlockDelay: 60480
```

## Common Compilation Arguments

### Foundry Projects

```yaml
cryticArgs: ["--compile-force-framework", "foundry"]
```

### Custom Remappings

```yaml
cryticArgs: [
  "--solc-remaps",
  "@openzeppelin/=lib/openzeppelin-contracts/src/;forge-std/=lib/forge-std/src/"
]
```

### Specific Solc Version

```yaml
cryticArgs: ["--solc-args", "--optimize --optimize-runs 200"]
```

### Hardhat Projects

```yaml
cryticArgs: ["--compile-force-framework", "hardhat"]
```

## Testing Mode Details

### Property Mode (`"property"`)

- Checks functions matching `echidna_*` that return `bool`
- Functions must be public/external, take no arguments
- A property fails when it returns `false`

### Assertion Mode (`"assertion"`)

- Checks for `assert()` failures and Solidity panic codes
- Any function can contain assertions
- A test fails when `assert()` evaluates to `false`
- Also catches arithmetic overflow in unchecked blocks, division by zero, array out-of-bounds

### Optimization Mode (`"optimization"`)

- Checks functions matching `echidna_optimize_*` that return `int256`
- Echidna tries to maximize the returned value
- Useful for finding worst-case gas usage or maximum extractable value

### Dapptest Mode (`"dapptest"`)

- Compatible with `ds-test`/`forge-std` test functions
- Functions starting with `test` that revert are treated as failures
- Functions starting with `testFail` that do NOT revert are treated as failures

## Config Profiles by Use Case

### CI Quick Check

```yaml
testLimit: 10000
seqLen: 20
shrinkLimit: 1000
workers: 2
format: "text"
```

### Development Iteration

```yaml
testLimit: 50000
seqLen: 100
shrinkLimit: 5000
corpusDir: "corpus"
workers: 4
```

### Pre-Audit Deep Campaign

```yaml
testLimit: 5000000
seqLen: 300
shrinkLimit: 10000
corpusDir: "corpus-deep"
workers: 8
testTimeout: 600
coverage: true
```

### Targeted Property Hunt

```yaml
testLimit: 500000
seqLen: 50
shrinkLimit: 10000
filterFunctions: ["liquidate(address)", "borrow(uint256)", "setPrice(uint256)"]
filterBlacklist: false
dictionary: "dict.txt"
workers: 4
```

Last verified: February 2026
