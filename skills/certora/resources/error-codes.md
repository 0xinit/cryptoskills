# Certora Error Codes and Common Issues

Reference for Certora Prover errors, warnings, and how to resolve them.

## Verification Results

### Rule Statuses

| Status | Meaning | Action |
|--------|---------|--------|
| **VERIFIED** | Property holds for all inputs and states | None — rule is proven |
| **VIOLATED** | Counter-example found | Inspect counter-example, fix contract or spec |
| **TIMEOUT** | SMT solver could not decide within time limit | Increase timeout, simplify rule, add bounds |
| **SANITY_FAIL** | Rule is vacuously true | Relax `require` constraints, check reachability |
| **UNKNOWN** | Prover could not determine result | Simplify rule, check for unsupported features |
| **ERROR** | Compilation or configuration error | Fix the reported error |

## Configuration and Setup Errors

### `CERTORAKEY not set`

```
Error: CERTORAKEY environment variable is not set
```

**Fix:** Export your API key before running.

```bash
export CERTORAKEY="your-key-here"
```

Get a key at https://www.certora.com/signup.

### `solc not found`

```
Error: solc binary not found on PATH
```

**Fix:**

```bash
pip install solc-select
solc-select install 0.8.28
solc-select use 0.8.28
```

### `Java not found`

```
Error: Java Runtime Environment not found
```

**Fix:** Install Java 11+.

```bash
# macOS
brew install openjdk@11

# Ubuntu
sudo apt install openjdk-11-jre
```

### Wrong Solidity version

```
Error: Source file requires different compiler version
```

**Fix:** Install the exact version your contracts need.

```bash
solc-select install 0.8.28
solc-select use 0.8.28
```

Or specify in config:

```json
{
    "solc": "/path/to/specific/solc"
}
```

## Compilation Errors

### `Cannot find import`

```
Error: Source "@openzeppelin/contracts/token/ERC20/ERC20.sol" not found
```

**Fix:** Add package path mapping to config.

```json
{
    "packages": [
        "@openzeppelin=node_modules/@openzeppelin"
    ]
}
```

### `Contract not found`

```
Error: Contract "Token" not found in provided files
```

**Fix:** Ensure the `files` array includes the correct source file and the contract name matches exactly (case-sensitive).

```json
{
    "files": ["src/Token.sol"],
    "verify": "Token:specs/Token.spec"
}
```

### `Function not found in methods block`

```
Error: Function balanceOf(address) is not declared in the methods block
```

**Fix:** Add the function to the `methods` block in your spec.

```cvl
methods {
    function balanceOf(address) external returns (uint256) envfree;
}
```

## Linking Errors

### `Link target not found`

```
Error: Cannot resolve link target "Vault:asset=Token"
```

**Fix:** Ensure both contracts are in the `files` array and the storage variable name is correct.

```json
{
    "files": ["src/Vault.sol", "src/Token.sol"],
    "link": ["Vault:asset=Token"]
}
```

Check the exact storage variable name — it might be `_asset` (with underscore) in OpenZeppelin contracts:

```json
{
    "link": ["Vault:_asset=Token"]
}
```

### `Ambiguous dispatch`

```
Warning: Multiple possible targets for external call
```

**Fix:** Use `DISPATCHER`, `NONDET`, or explicit linking in the methods block.

```cvl
methods {
    function _.transfer(address, uint256) external => DISPATCHER(true);
}
```

## Timeout Issues

### Rule timeout

```
TIMEOUT: Rule "myRule" exceeded SMT timeout (600s)
```

**Fixes (try in order):**

1. **Increase timeout:**
   ```json
   { "smt_timeout": "1200" }
   ```

2. **Reduce complexity** — split into smaller rules.

3. **Add bounds** — constrain large values:
   ```cvl
   require amount < 2^128;
   ```

4. **Use `optimistic_loop`:**
   ```json
   { "optimistic_loop": true, "loop_iter": "3" }
   ```

5. **Use hashing scheme for complex storage:**
   ```json
   { "prover_args": ["-smt_hashingScheme plainInjectivity"] }
   ```

### Loop unrolling timeout

```
Warning: Loop at line N was not fully unrolled
```

**Fix:** Increase `loop_iter` or enable `optimistic_loop`.

```json
{
    "loop_iter": "5",
    "optimistic_loop": true
}
```

`optimistic_loop` assumes the loop terminates at the specified bound. Without it, the Prover considers the possibility that the loop runs more iterations, which can cause spurious counter-examples.

## Vacuity and Sanity Issues

### Vacuous rule (SANITY_FAIL)

```
SANITY_FAIL: Rule "myRule" is vacuously true
```

The rule passes because no valid execution reaches the `assert`. Common causes:

1. **Over-constrained `require` statements:**
   ```cvl
   // These two requires together exclude all executions
   require balanceOf(user) > totalSupply();  // impossible
   require totalSupply() > 0;
   ```

2. **Calling a function that always reverts** in the tested path.

3. **Conflicting type constraints** — e.g., requiring a uint256 to be negative.

**Fix:** Remove or relax `require` statements. Use `satisfy` to check reachability:

```cvl
rule sanityCheck() {
    env e;
    // ... same setup as the vacuous rule ...
    satisfy true;  // should pass if any execution is possible
}
```

### Trivially true assertion

```
Warning: Assertion is trivially true
```

The `assert` statement can never be false regardless of execution. This might indicate the property is not testing what you think.

**Fix:** Verify the assertion actually constrains behavior. A common mistake:

```cvl
// Trivially true — uint256 is always >= 0
assert balanceOf(user) >= 0;

// Meaningful version
assert to_mathint(balanceOf(user)) >= to_mathint(previousBalance);
```

## Counter-Example Issues

### Unrealistic initial state

The counter-example shows a starting state that could never exist (e.g., a user balance exceeding total supply).

**Fix:** Add the invariant as a precondition:

```cvl
rule myRule() {
    requireInvariant totalSupplyEqualsSumOfBalances();
    // ... rest of rule ...
}
```

### `msg.sender == address(0)`

The Prover assigned the zero address as `msg.sender`.

**Fix:** Exclude if your contract reverts for zero sender:

```cvl
require e.msg.sender != 0;
```

### Sender equals receiver

Counter-example shows `from == to` in a transfer.

**Fix:** Either handle the self-transfer case in your rule or constrain:

```cvl
require from != to;
```

### Extreme values

Counter-example uses `max_uint256` or other boundary values.

**Fix:** Only constrain if the contract itself would reject these values. If the contract accepts them, the counter-example reveals a real edge case.

## Warning Messages

### `Function has no summary`

```
Warning: External function call to unknown target has no summary
```

**Fix:** Add a summary in the methods block:

```cvl
methods {
    function _.unknownFunction(uint256) external => NONDET;
}
```

### `Havoc on storage`

```
Warning: Storage of contract X may be havoced by external call
```

The Prover assumes an external call can modify any storage. This is sound but may cause false positives.

**Fix:** Use `NONDET` or `DISPATCHER` to provide more precise summaries:

```cvl
methods {
    function _.externalCall() external => NONDET;
}
```

### `Deprecated syntax`

```
Warning: Deprecated: use 'preserved' instead of 'requireInvariant' in invariant body
```

**Fix:** Update to current syntax. CVL evolves — check the official docs for migration guides.

## Performance Tuning

| Symptom | Config Change |
|---------|---------------|
| Timeout on complex math | `"smt_timeout": "1800"` |
| Timeout on storage-heavy contracts | `"prover_args": ["-smt_hashingScheme plainInjectivity"]` |
| Timeout on loop-heavy code | `"loop_iter": "5"`, `"optimistic_loop": true` |
| Timeout on large contracts | Split into per-function rules with `--rule` |
| Spurious counter-examples from unrelated storage | Add `NONDET` summaries for external calls |
| Memory exhaustion | Reduce `loop_iter`, simplify ghost variables |

Last verified: February 2026
