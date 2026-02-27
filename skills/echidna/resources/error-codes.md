# Echidna Error Codes and Solutions

Common errors encountered when running Echidna, with root causes and fixes.

## Compilation Errors

### `Error: crytic-compile: solc returned non-zero exit code`

**Cause:** The Solidity compiler (`solc`) failed to compile the contract.

**Solutions:**
1. Check that the correct `solc` version is installed and selected:
   ```bash
   solc --version
   solc-select use 0.8.28
   ```
2. Verify the contract compiles with solc directly:
   ```bash
   solc --combined-json abi,bin test/MyTest.sol
   ```
3. For Foundry projects, ensure remappings are passed:
   ```yaml
   cryticArgs: ["--compile-force-framework", "foundry"]
   ```

### `Error: Could not find <import path>`

**Cause:** Import paths are unresolved. Echidna uses `crytic-compile` which may not find your dependency paths automatically.

**Solutions:**
1. For Foundry projects:
   ```yaml
   cryticArgs: ["--compile-force-framework", "foundry"]
   ```
2. For manual remappings:
   ```yaml
   cryticArgs: [
     "--solc-remaps",
     "@openzeppelin/=lib/openzeppelin-contracts/src/;forge-std/=lib/forge-std/src/"
   ]
   ```
3. Verify remappings work: `forge build` should succeed before running Echidna.

### `Error: Source file requires different compiler version`

**Cause:** The `solc` version on PATH does not match the pragma in your contracts.

**Solutions:**
```bash
pip3 install solc-select
solc-select install 0.8.28
solc-select use 0.8.28
```

### `Error: Stack too deep`

**Cause:** Contract has too many local variables for the default compiler pipeline.

**Solutions:**
1. Reduce local variables in the test harness.
2. Use `via-ir` compilation:
   ```yaml
   cryticArgs: ["--solc-args", "--via-ir"]
   ```

## Runtime Errors

### `No tests found`

**Cause:** Echidna found no functions matching the test mode criteria.

**Solutions:**
| Mode | Required Pattern |
|------|-----------------|
| Property | Functions named `echidna_*` returning `bool`, public/external, no arguments |
| Assertion | Functions containing `assert()` statements |
| Optimization | Functions named `echidna_optimize_*` returning `int256` |
| Dapptest | Functions named `test*` (revert = failure) or `testFail*` (no revert = failure) |

Common mistakes:
- Function is `internal` or `private` (must be `public` or `external`)
- Function takes arguments (property functions must take zero arguments)
- Function does not start with `echidna_` in property mode
- Wrong `testMode` in config

### `Contract deployment failed`

**Cause:** The constructor reverted during deployment.

**Solutions:**
1. Check constructor arguments — Echidna deploys with no constructor args by default. If your constructor requires arguments, the test contract must have a no-arg constructor.
2. Verify the constructor does not depend on external state (other contracts, oracles).
3. Check that the deployer address has sufficient balance:
   ```yaml
   balanceAddr: 0xffffffffffffffffffffffff
   ```

### `Property X: passing (but no coverage)`

**Cause:** The property is trivially true. Echidna is not exercising meaningful state.

**Solutions:**
1. Check that the constructor seeds initial state (balances, approvals, positions).
2. Verify that sender addresses have tokens/ETH to interact with the contract.
3. Add helper functions that Echidna can call to build up state:
   ```solidity
   function setup_deposit(uint256 amount) public {
       if (amount == 0 || amount > 1e24) return;
       deposit(amount);
   }
   ```

### `Timeout: test exceeded testTimeout`

**Cause:** A single transaction sequence took longer than `testTimeout` seconds.

**Solutions:**
1. Increase timeout:
   ```yaml
   testTimeout: 600
   ```
2. Reduce `seqLen` to shorten sequences:
   ```yaml
   seqLen: 50
   ```
3. Simplify the test harness — remove expensive loops or external calls.

## Property Design Errors

### Property Always Passes (False Sense of Security)

**Symptom:** Echidna reports `passing` for all properties, but you know bugs exist.

**Root Causes and Fixes:**

| Root Cause | Fix |
|-----------|-----|
| Property checks effect, not cause | Track ghost variables for minting/burning and check those |
| Constructor state makes property trivially true | Seed meaningful state with multiple users and positions |
| Sender addresses lack permissions | Add sender addresses to allowlists in constructor |
| Input range too narrow | Use helper functions with bounded but non-trivial ranges |
| Property only checks one user | Check all sender addresses in the property |

### Property Always Fails

**Symptom:** Property fails immediately with a trivial sequence.

**Root Causes and Fixes:**

| Root Cause | Fix |
|-----------|-----|
| Property has a logic error | Test the property with known-good state manually |
| Constructor state violates the property | Initialize state correctly before property checks |
| Property assumptions do not hold on empty state | Guard with `if (totalSupply == 0) return true;` |
| Integer overflow in property calculation | Use checked math or guard against large values |

### Shrinking Takes Forever

**Symptom:** Echidna found a failure but shrinking does not converge.

**Solutions:**
1. Reduce `shrinkLimit` for faster (but noisier) results:
   ```yaml
   shrinkLimit: 1000
   ```
2. Reduce `seqLen` — shorter maximum sequences mean shorter failing sequences.
3. Check if the property failure is non-deterministic (depends on timing or gas).

## Performance Issues

### Fuzzing is Extremely Slow

**Symptom:** Less than 100 transactions/second.

**Solutions:**

| Cause | Fix |
|-------|-----|
| Complex constructor | Simplify deployment, pre-compute addresses |
| Expensive property checks | Move heavy computation out of `echidna_*` functions |
| Large contract bytecode | Split test harness into focused contracts |
| Single worker | Set `workers` to CPU core count |
| Coverage overhead | Disable for speed: `coverage: false` (not recommended long-term) |

### Low Coverage Despite Many Transactions

**Symptom:** Corpus size stays small, `Unique instructions` count plateaus.

**Solutions:**
1. Add a dictionary with protocol-specific constants.
2. Add more helper functions that expose different state transitions.
3. Reduce `seqLen` — shorter sequences explore more unique starting points.
4. Add more sender addresses for protocols with role-based access.

## Output Format Issues

### JSON Output for CI Integration

```yaml
format: "json"
```

Parse results programmatically:

```bash
echidna test/MyTest.sol --contract MyTest --format json | jq '.[] | select(.status == "failed")'
```

### Suppressing Output

```yaml
quiet: true
format: "none"
```

## Environment Issues

### Docker: Permission Denied on Corpus Directory

```bash
# Ensure the corpus directory is writable
mkdir -p corpus && chmod 777 corpus
docker run --rm -v $(pwd):/src ghcr.io/crytic/echidna/echidna echidna /src/test/MyTest.sol --contract MyTest --corpus-dir /src/corpus
```

### macOS: Echidna Binary Not Trusted

```bash
# Remove quarantine attribute after downloading
xattr -d com.apple.quarantine /usr/local/bin/echidna
```

### CI: Echidna Not Found

Install in CI explicitly:

```bash
curl -L https://github.com/crytic/echidna/releases/latest/download/echidna-x86_64-linux.tar.gz | tar xz
sudo mv echidna /usr/local/bin/
echidna --version
```

Last verified: February 2026
