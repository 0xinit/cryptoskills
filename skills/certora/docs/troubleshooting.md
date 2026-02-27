# Certora Troubleshooting Guide

Common issues and solutions when using the Certora Prover.

## API Key and Authentication

### `CERTORAKEY not set`

**Symptoms:**
- `Error: CERTORAKEY environment variable is not set`
- `Authentication failed`

**Solutions:**

1. **Set the environment variable:**
   ```bash
   export CERTORAKEY="your-api-key"
   ```

2. **Verify it is set:**
   ```bash
   echo $CERTORAKEY
   ```

3. **Add to shell profile for persistence:**
   ```bash
   echo 'export CERTORAKEY="your-key"' >> ~/.zshrc
   source ~/.zshrc
   ```

4. **In CI**, use a repository secret:
   ```yaml
   env:
     CERTORAKEY: ${{ secrets.CERTORAKEY }}
   ```

### API key expired or invalid

**Symptoms:**
- `Error: Invalid API key`
- `Error: API key expired`

**Solutions:**
- Regenerate your key at https://www.certora.com/signup
- Academic keys may have expiration dates — check your account
- Ensure no leading/trailing whitespace in the key

## Compilation Failures

### Cannot find Solidity imports

**Symptoms:**
- `Source "@openzeppelin/..." not found`
- `File not found` errors during compilation

**Solutions:**

1. **Add package mappings to config:**
   ```json
   {
       "packages": [
           "@openzeppelin=node_modules/@openzeppelin"
       ]
   }
   ```

2. **Install dependencies first:**
   ```bash
   npm ci
   # or for Foundry projects
   forge install
   ```

3. **For Foundry remappings**, add each remapping:
   ```json
   {
       "packages": [
           "forge-std=lib/forge-std/src",
           "@openzeppelin=lib/openzeppelin-contracts"
       ]
   }
   ```

### Solidity version mismatch

**Symptoms:**
- `Source file requires different compiler version`
- `ParserError: Expected pragma, import directive or contract/interface/library/struct/enum/constant/function/error definition`

**Solutions:**

1. **Install the correct solc version:**
   ```bash
   pip install solc-select
   solc-select install 0.8.28
   solc-select use 0.8.28
   ```

2. **Specify solc path in config:**
   ```json
   {
       "solc": "/path/to/specific/solc"
   }
   ```

3. **For multiple Solidity versions** in the same project, use `solc_map`:
   ```json
   {
       "solc_map": {
           "Token": "solc-0.8.20",
           "OldContract": "solc-0.7.6"
       }
   }
   ```

## Timeout Issues

### Rule exceeds SMT timeout

**Symptoms:**
- `TIMEOUT` status on a rule
- Verification runs for 10+ minutes without result

**Solutions (in order of preference):**

1. **Increase the timeout:**
   ```json
   { "smt_timeout": "1200" }
   ```

2. **Simplify the rule.** Break complex rules into smaller, focused rules:
   ```cvl
   // Instead of one rule checking 5 properties:
   rule checkEverything() { ... }

   // Write 5 separate rules:
   rule checkPropertyA() { ... }
   rule checkPropertyB() { ... }
   ```

3. **Add bounds to unconstrained values:**
   ```cvl
   // Reduce search space
   require amount < 2^128;
   require balanceOf(user) < totalSupply();
   ```

4. **Enable optimistic loop unrolling:**
   ```json
   {
       "optimistic_loop": true,
       "loop_iter": "3"
   }
   ```

5. **Run only the failing rule** to reduce memory pressure:
   ```bash
   certoraRun config.conf --rule failingRuleName
   ```

6. **Use hashing scheme for complex storage layouts:**
   ```json
   {
       "prover_args": ["-smt_hashingScheme plainInjectivity"]
   }
   ```

### Loop unrolling issues

**Symptoms:**
- `Warning: Loop at line N was not fully unrolled`
- Spurious counter-examples involving loop iterations

**Solutions:**

1. **Increase loop iterations:**
   ```json
   { "loop_iter": "5" }
   ```

2. **Enable optimistic loop** (assumes loops terminate at bound):
   ```json
   { "optimistic_loop": true }
   ```

3. **Keep loop iterations realistic.** Most token operations need 1-3 iterations. Complex DeFi operations may need 5-7. Above 10 causes exponential slowdown.

## Vacuous Rules (False Positives)

### Rule passes vacuously

**Symptoms:**
- Rule shows `VERIFIED` but `rule_sanity` reports `SANITY_FAIL`
- `satisfy true` fails for the same setup
- The rule passes suspiciously fast

**Root causes:**

1. **Over-constrained `require` statements:**
   ```cvl
   // PROBLEM: these two requires are contradictory
   require balanceOf(user) > totalSupply();
   require totalSupply() > 0;
   ```

2. **Function always reverts** in the tested path (e.g., calling without sufficient allowance).

3. **envfree function called with env** or vice versa.

**Solutions:**

1. **Enable sanity checking:**
   ```json
   { "rule_sanity": "basic" }
   ```
   For thorough checking:
   ```json
   { "rule_sanity": "advanced" }
   ```

2. **Add a reachability check:**
   ```cvl
   rule myRuleIsReachable() {
       env e;
       // same setup as the vacuous rule
       satisfy true;
   }
   ```

3. **Review each `require` statement.** Remove one at a time and re-run to find the over-constraint.

## Linking Errors

### Contract linking fails

**Symptoms:**
- `Cannot resolve link target`
- `Unknown contract reference`

**Solutions:**

1. **Check the storage variable name.** OpenZeppelin contracts often use underscore-prefixed names:
   ```json
   {
       "link": ["Vault:_asset=Token"]
   }
   ```
   Not:
   ```json
   {
       "link": ["Vault:asset=Token"]
   }
   ```

2. **Include both contracts in `files`:**
   ```json
   {
       "files": ["src/Vault.sol", "src/Token.sol"],
       "link": ["Vault:_asset=Token"]
   }
   ```

3. **For immutable references**, linking does not work. The Prover reads the immutable value from the constructor. Use a harness contract instead.

### External calls cause havoc

**Symptoms:**
- `Warning: Storage of contract X may be havoced by external call`
- Rules fail with counter-examples showing arbitrary storage modifications

**Solutions:**

1. **Add summaries for external calls:**
   ```cvl
   methods {
       function _.transfer(address, uint256) external => NONDET;
       function _.balanceOf(address) external => NONDET;
   }
   ```

2. **Use DISPATCHER for known targets:**
   ```cvl
   methods {
       function _.transfer(address, uint256) external => DISPATCHER(true);
   }
   ```

3. **Link concrete implementations** instead of using wildcards.

## Counter-Example Interpretation

### Counter-example shows impossible state

**Symptoms:**
- A user balance exceeds total supply in the initial state
- Contract state is internally inconsistent

**Solutions:**

Add invariants as preconditions:
```cvl
rule myRule() {
    requireInvariant totalSupplyEqualsSumOfBalances();
    requireInvariant nonNegativeBalances();

    // ... rest of rule ...
}
```

### Counter-example involves address(0)

**Symptoms:**
- `msg.sender = 0x0000...0000` in the counter-example
- Zero address owns tokens or has special state

**Solutions:**

If your contract prevents zero-address interactions:
```cvl
require e.msg.sender != 0;
```

Only add this constraint if your contract enforces it — otherwise, the counter-example reveals a real issue.

### Counter-example involves self-calls

**Symptoms:**
- The contract calls itself in the counter-example
- `msg.sender == currentContract`

**Solutions:**

```cvl
require e.msg.sender != currentContract;
```

## Memory and Performance

### Out of memory

**Symptoms:**
- Process killed with OOM signal
- `java.lang.OutOfMemoryError`

**Solutions:**

1. **Reduce scope** — run one rule at a time:
   ```bash
   certoraRun config.conf --rule singleRule
   ```

2. **Reduce loop iterations:**
   ```json
   { "loop_iter": "2" }
   ```

3. **Simplify ghost variables.** Complex ghost mappings with multiple keys consume significant memory.

4. **Use `NONDET` instead of `DISPATCHER`** for external calls you do not need to reason about precisely.

### Slow verification

**Symptoms:**
- Verification takes 30+ minutes per rule
- Dashboard shows "Running..." for extended periods

**Solutions:**

1. **Check for unnecessary complexity** in ghost variables and hooks.
2. **Use `--method` to restrict parametric rules:**
   ```bash
   certoraRun config.conf --rule parametricRule --method "transfer(address,uint256)"
   ```
3. **Split large specs into multiple files** with separate configs.

## Common CVL Syntax Mistakes

### Missing `envfree`

```
Error: Function balanceOf requires an env argument
```

Either add `envfree` to the methods block or pass an `env`:
```cvl
// Option A: declare envfree
function balanceOf(address) external returns (uint256) envfree;

// Option B: pass env
env e;
uint256 bal = balanceOf(e, user);
```

### Wrong `require` vs `assert`

Using `assert` where you meant `require` makes the rule check a precondition as a property. Using `require` where you meant `assert` silently constrains the prover without checking anything.

```cvl
// WRONG: this constrains the prover, does not check anything
require balanceOf(user) == expectedBalance;

// CORRECT: this asserts the property
assert balanceOf(user) == expectedBalance;
```

### Using `@withrevert` but forgetting `lastReverted`

```cvl
// WRONG: calls with revert capture but never checks
transfer@withrevert(e, to, amount);
assert amount > 0;

// CORRECT: check lastReverted
transfer@withrevert(e, to, amount);
assert lastReverted, "should have reverted";
```

Last verified: February 2026
