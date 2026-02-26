# Foundry Troubleshooting

Common issues, root causes, and fixes.

## Compilation Errors

### "Stack too deep"

The EVM has a 16-slot stack limit. Too many local variables in a single function triggers this.

**Fix:**

```toml
# foundry.toml
[profile.default]
via_ir = true
```

If that still fails, refactor the function to use fewer local variables or break it into internal helper functions.

### "Compiler version mismatch"

The Solidity pragma doesn't match the configured compiler version.

**Fix:**

```toml
[profile.default]
solc = "0.8.28"
# Or let Foundry pick the version from pragma:
auto_detect_solc = true
```

When using `auto_detect_solc`, every unique pragma in the project triggers a separate compilation pass, which slows builds. Prefer pinning a single version.

### "File not found" for imports

Remappings are missing or incorrect.

**Fix:**

```toml
[profile.default]
remappings = [
    "@openzeppelin/=lib/openzeppelin-contracts/",
    "solmate/=lib/solmate/src/",
]
```

Verify the path exists:

```bash
ls lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol
```

If the dependency isn't installed:

```bash
forge install OpenZeppelin/openzeppelin-contracts
```

### "Contract exceeds 24576 bytes"

The Spurious Dragon EIP-170 size limit. The contract is too large to deploy.

**Fixes (in order of preference):**
1. Increase optimizer runs: `optimizer_runs = 1000000` (optimizes for call cost, reduces bytecode)
2. Extract logic into libraries
3. Split into multiple contracts (diamond/proxy pattern)
4. Enable IR pipeline: `via_ir = true`

Check sizes:

```bash
forge build --sizes
```

## Test Failures

### "EvmError: Revert" with no message

The call reverted but no revert reason was provided. Common with low-level calls, proxy contracts, or out-of-gas.

**Debug:**

```bash
# Run with full trace to see the exact revert location
forge test --match-test testMyFunction -vvvv
```

Check if it's a gas issue:

```bash
forge test --match-test testMyFunction --gas-limit 100000000 -vvvv
```

### "EvmError: OutOfGas"

Test exceeds the block gas limit.

**Fix:**

```bash
forge test --gas-limit 100000000
```

Or in `foundry.toml`:

```toml
[profile.default]
gas_limit = 100_000_000
```

### Fuzz test counterexample reproduction

When a fuzz test fails, Foundry prints the failing input and seed.

**Reproduce:**

```bash
# Replay with the exact seed
FOUNDRY_FUZZ_SEED=0xdeadbeef forge test --match-test testFuzz_deposit -vvvv
```

**Pin as regression test:**

```solidity
function test_depositRegression() public {
    // Counterexample from fuzz run on 2025-01-15
    uint256 failingInput = 115792089237316195423570985008687907853269984665640564039457584007913129639935;
    testFuzz_deposit(failingInput);
}
```

### Tests pass locally but fail in CI

Common causes:
1. **Different Solc version** — pin with `solc = "0.8.28"` in `foundry.toml`
2. **Fork tests using latest block** — pin block numbers with `vm.createSelectFork("mainnet", 19_000_000)`
3. **Fuzz seed differences** — set a fixed seed in `foundry.toml` `[fuzz]` section
4. **Foundry version** — pin with `foundryup -v nightly-<date>` in CI

## Fork Test Issues

### RPC rate limiting

Fork tests make many RPC calls. Free-tier providers throttle aggressively.

**Fixes:**
1. Use a dedicated RPC provider (Alchemy, Infura, QuickNode)
2. Pin block numbers to enable Foundry's fork cache (`~/.foundry/cache/rpc/`)
3. Reduce fork test count
4. Separate fork tests from unit tests in CI:
   ```bash
   forge test --no-match-test Fork   # fast: unit tests only
   forge test --match-test Fork      # slow: fork tests with dedicated RPC
   ```

### Fork test hangs or times out

The RPC is slow or unresponsive.

**Fix:**

```bash
# Increase timeout
forge test --match-test testFork --fork-retry-backoff 3 -vvv
```

Or switch to a faster RPC provider.

### Fork state is stale / non-deterministic

Without a pinned block number, fork state changes between runs.

**Fix:**

```solidity
function setUp() public {
    vm.createSelectFork("mainnet", 19_000_000);
}
```

## Script / Deployment Issues

### "Script broadcast failed"

The transaction reverted during broadcast.

**Debug:**
1. Run without `--broadcast` first (dry run):
   ```bash
   forge script script/Deploy.s.sol --rpc-url sepolia -vvvv
   ```
2. Check if the deployer has enough ETH
3. Check nonce: `cast nonce $DEPLOYER --rpc-url $RPC`
4. Check for pending transactions that may conflict

### "Nonce too low"

A pending transaction is blocking, or the nonce tracker is out of sync.

**Fix:**

```bash
# Check current nonce
cast nonce $DEPLOYER --rpc-url $RPC

# Override nonce
cast send ... --nonce 42

# Wait for pending transactions to confirm, then retry
```

### "Failed to get EIP-1559 fees"

The chain doesn't support EIP-1559 (some L2s, custom chains).

**Fix:**

```bash
forge script script/Deploy.s.sol --rpc-url $RPC --broadcast --legacy
```

### Verification fails on block explorer

**Common causes:**
1. **Wrong constructor args** — pass them explicitly:
   ```bash
   forge verify-contract 0xAddress src/Vault.sol:Vault \
     --chain sepolia \
     --etherscan-api-key $KEY \
     --constructor-args $(cast abi-encode "constructor(address,uint256)" 0xOwner 1000)
   ```
2. **Optimizer settings mismatch** — the explorer must see the exact same compiler settings
3. **Different Solc version** — pin in `foundry.toml`
4. **Libraries not linked** — pass `--libraries` flag
5. **Rate limit on Etherscan API** — wait and retry

### Resume a partially-failed deployment

```bash
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --resume
```

This reads the broadcast artifacts and skips already-confirmed transactions.

## Permission Errors

### "FFI is not enabled"

A dependency or test is trying to execute shell commands via FFI.

**Fix (only if you trust the code):**

```toml
[profile.default]
ffi = true
```

FFI is disabled by default for security. Enabling it allows Solidity code to execute arbitrary shell commands. Only enable if you understand the risks.

### "File read/write not allowed"

Scripts need explicit filesystem permissions.

**Fix:**

```toml
[profile.default]
fs_permissions = [
    { access = "read", path = "./" },
    { access = "write", path = "./out" },
]
```

## Performance Issues

### Slow compilation

**Fixes:**
1. Disable `auto_detect_solc` — pin a single version
2. Use `forge build --no-cache` to rule out cache corruption, then re-enable cache
3. Reduce dependency count
4. Disable `via_ir` unless needed (IR pipeline is slower to compile)

### Slow tests

**Fixes:**
1. Separate fork tests from unit tests
2. Reduce fuzz runs for local dev, increase in CI
3. Use `--match-test` to run only relevant tests during development
4. Profile with `forge test --gas-report` to find expensive operations

## References

- [Foundry Book — FAQ](https://book.getfoundry.sh/faq)
- [Foundry GitHub Issues](https://github.com/foundry-rs/foundry/issues)
- [Foundry Telegram](https://t.me/foundry_rs)
