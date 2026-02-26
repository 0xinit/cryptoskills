# foundry.toml Configuration Reference

All configuration lives in `foundry.toml` at the project root. Settings can be overridden with environment variables prefixed `FOUNDRY_` or `DAPP_` (e.g., `FOUNDRY_OPTIMIZER=true`).

## [profile.default]

Core compilation and project settings.

```toml
[profile.default]
src = "src"                    # Source directory
out = "out"                    # Compilation output directory
libs = ["lib"]                 # Dependency directories
test = "test"                  # Test directory
script = "script"              # Script directory

# Compiler
solc = "0.8.28"                # Solc version (or auto_detect_solc = true)
auto_detect_solc = false       # Auto-detect from pragma (slower builds)
via_ir = false                 # IR pipeline — fixes "stack too deep"
evm_version = "cancun"         # Target EVM version

# Optimizer
optimizer = true
optimizer_runs = 200           # 200 = balanced. Higher = cheaper calls, larger bytecode

# Remappings
remappings = [
    "@openzeppelin/=lib/openzeppelin-contracts/",
    "solmate/=lib/solmate/src/",
]

# Safety
ffi = false                    # Allow FFI (shell commands from Solidity) — security risk
fs_permissions = [{ access = "read", path = "./" }]

# Gas
gas_limit = 30_000_000         # Block gas limit for tests
gas_price = 0                  # Gas price in tests (0 = free)
block_gas_limit = 30_000_000

# Misc
cache_path = "cache"
verbosity = 0                  # Default test verbosity (0-4)
```

## [rpc_endpoints]

Named RPC endpoints referenced in tests, scripts, and CLI commands with `--rpc-url <name>`.

```toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
sepolia = "${SEPOLIA_RPC_URL}"
arbitrum = "${ARBITRUM_RPC_URL}"
optimism = "${OPTIMISM_RPC_URL}"
base = "${BASE_RPC_URL}"
polygon = "${POLYGON_RPC_URL}"
localhost = "http://127.0.0.1:8545"
```

Use in scripts: `vm.createSelectFork("mainnet")`.
Use from CLI: `forge test --rpc-url mainnet`.

## [etherscan]

API keys for contract verification. Keyed by the same name as `[rpc_endpoints]`.

```toml
[etherscan]
mainnet = { key = "${ETHERSCAN_API_KEY}" }
sepolia = { key = "${ETHERSCAN_API_KEY}" }
arbitrum = { key = "${ARBISCAN_API_KEY}" }
optimism = { key = "${OPTIMISM_ETHERSCAN_API_KEY}" }
base = { key = "${BASESCAN_API_KEY}" }
polygon = { key = "${POLYGONSCAN_API_KEY}" }
```

Custom explorer URL:

```toml
[etherscan]
custom_chain = { key = "${API_KEY}", url = "https://api.custom-explorer.io/api" }
```

## [fuzz]

Fuzz testing configuration.

```toml
[fuzz]
runs = 256                     # Fuzz iterations per test (CI: use 10000+)
max_test_rejects = 65536       # Max rejected inputs before failure
seed = "0x1"                   # Fixed seed for reproducibility (optional)
dictionary_weight = 40         # Weight for dictionary-based inputs (0-100)
include_storage = true         # Include contract storage values in dictionary
include_push_bytes = true      # Include PUSH bytecode values in dictionary
```

## [invariant]

Invariant (stateful fuzz) testing configuration.

```toml
[invariant]
runs = 256                     # Number of random call sequences
depth = 15                     # Calls per sequence
fail_on_revert = false         # true = handler reverts are failures
call_override = false          # true = override msg.sender per call
dictionary_weight = 80         # Weight for dictionary-based inputs
include_storage = true
include_push_bytes = true
shrink_run_limit = 5000        # Attempts to shrink failing sequence
```

## [fmt]

Code formatting with `forge fmt`.

```toml
[fmt]
line_length = 120              # Max line length
tab_width = 4                  # Spaces per indent
bracket_spacing = false        # Space inside { } for single-line
int_types = "long"             # "long" = uint256, "short" = uint
multiline_func_header = "params_first"  # or "all_params"
quote_style = "double"         # "double" or "single"
number_underscore = "thousands" # 1_000_000 formatting
single_line_statement_blocks = "preserve"
sort_imports = false
```

Run: `forge fmt` to format, `forge fmt --check` to verify.

## [doc]

Documentation generation with `forge doc`.

```toml
[doc]
out = "docs"                   # Output directory
title = "My Protocol"
repository = "https://github.com/org/repo"
```

## Profile Overrides

Create named profiles for different environments:

```toml
[profile.default]
optimizer_runs = 200

# CI profile — more fuzz runs, stricter settings
[profile.ci]
fuzz = { runs = 10000 }
invariant = { runs = 1000, depth = 50 }
verbosity = 2

# Production profile — max optimization
[profile.production]
optimizer_runs = 1000000
via_ir = true
```

Activate with `FOUNDRY_PROFILE`:

```bash
FOUNDRY_PROFILE=ci forge test
FOUNDRY_PROFILE=production forge build
```

## Environment Variable Overrides

Any config key can be overridden with `FOUNDRY_` prefix:

```bash
FOUNDRY_OPTIMIZER=true forge build
FOUNDRY_FUZZ_RUNS=10000 forge test
FOUNDRY_SOLC_VERSION=0.8.28 forge build
```

## References

- [Foundry Book — Configuration](https://book.getfoundry.sh/reference/config/)
- [Full Config Options](https://book.getfoundry.sh/reference/config/overview)
