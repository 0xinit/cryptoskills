# Halmos Troubleshooting Guide

Common issues and solutions when using Halmos for symbolic testing.

> Last verified: February 2026

## Solver Timeout on Complex Math

**Symptoms:**
- Test hangs for minutes then reports `solver timeout (assertion)`
- Happens with fixed-point math, exponentiation, or division-heavy contracts

**Solutions:**

1. **Increase the timeout.** Start with 2x the default:
   ```bash
   halmos --solver-timeout-assertion 120000
   ```

2. **Simplify the math in your test.** Instead of testing the full calculation, break it into sub-properties:
   ```solidity
   // Instead of verifying the entire AMM swap formula at once:
   // function check_swap_exact_output(uint256 amountIn) public { ... }

   // Break into sub-properties:
   function check_swap_increases_reserve(uint256 amountIn) public {
       vm.assume(amountIn > 0);
       vm.assume(amountIn <= 1e24);
       // Test only that reserves move in the right direction
   }

   function check_swap_constant_product_holds(uint256 amountIn) public {
       vm.assume(amountIn > 0);
       vm.assume(amountIn <= 1e24);
       // Test only the k = x * y invariant
   }
   ```

3. **Constrain inputs more tightly.** The solver's job gets harder with wider ranges:
   ```solidity
   // Broad range — may timeout
   vm.assume(amount > 0);

   // Tighter range — faster solving
   vm.assume(amount > 0);
   vm.assume(amount <= 1e24);
   ```

4. **Avoid non-linear arithmetic when possible.** z3 struggles with `x * y / z` where all are symbolic. If possible, fix one variable:
   ```solidity
   // Three symbolic variables in a product — hard for z3
   function check_hard(uint256 x, uint256 y, uint256 z) public {
       assert(x * y / z <= type(uint256).max);
   }

   // Fix z to a known value — easier for z3
   function check_easier(uint256 x, uint256 y) public {
       uint256 z = 1e18; // WAD denominator
       assert(x * y / z <= type(uint256).max);
   }
   ```

## Path Explosion

**Symptoms:**
- Path count grows exponentially as `--loop` increases
- Memory usage climbs rapidly
- Single test takes minutes while others take seconds

**Solutions:**

1. **Reduce loop bounds:**
   ```bash
   halmos --loop 3  # instead of --loop 10
   ```

2. **Add vm.assume to prune irrelevant paths:**
   ```solidity
   function check_batch(address[] calldata recipients) public {
       // Without this, Halmos explores paths for all possible lengths
       vm.assume(recipients.length <= 5);

       // More constraints = fewer paths
       for (uint256 i = 0; i < recipients.length; i++) {
           vm.assume(recipients[i] != address(0));
       }
   }
   ```

3. **Use --early-exit to stop on first failure:**
   ```bash
   halmos --early-exit
   ```

4. **Split tests by concern.** One large test with many branches is worse than several focused tests:
   ```solidity
   // BAD: tests everything at once — combinatorial explosion
   function check_everything(uint256 a, uint256 b, bool flag1, bool flag2) public { ... }

   // GOOD: separate concerns
   function check_addition(uint256 a, uint256 b) public { ... }
   function check_flag_behavior(bool flag1) public { ... }
   ```

5. **Limit call depth:**
   ```bash
   halmos --depth 20
   ```

## Tests Pass but Should Fail (Vacuous Truth)

**Symptoms:**
- Test reports `[PASS]` with `paths: 0` or very few paths
- You know the property is wrong but Halmos says it holds

**Cause:** Over-constraining with `vm.assume` makes the assumptions contradictory. With no valid inputs, the property holds vacuously.

**Solutions:**

1. **Check the path count.** Zero or very low paths is a red flag:
   ```
   [PASS] check_myProperty(uint256) (paths: 0, time: 0.01s)
   # ^^^ paths: 0 means NO inputs were valid — vacuously true
   ```

2. **Test your assumptions independently:**
   ```solidity
   // Verify that assumptions are satisfiable
   function check_assumptions_satisfiable(uint256 x) public {
       vm.assume(x > 100);
       vm.assume(x < 50);  // Contradicts the above!

       // This will never execute — 0 paths
       assert(false);  // Would fail if reached, but never does
   }
   ```

3. **Remove assumptions one at a time** until paths increase, then re-add only necessary ones.

4. **Use positive assertions instead of only negative ones:**
   ```solidity
   function check_valid_state_exists(uint256 amount) public {
       vm.assume(amount > 0);
       vm.assume(amount <= totalSupply);

       // Verify at least one path exists by checking an always-true property
       assert(amount > 0);  // Should pass with paths > 0
   }
   ```

## setUp() Reverts

**Symptoms:**
- `ERROR: setUp() reverted`
- No tests execute

**Solutions:**

1. **Remove unsupported cheatcodes from setUp:**
   ```solidity
   // BAD: fork mode not supported
   function setUp() public {
       vm.createSelectFork("mainnet");
   }

   // GOOD: deploy contracts directly
   function setUp() public {
       token = new SimpleToken("Test", "TST", 1_000_000e18);
   }
   ```

2. **Use concrete constructor arguments:**
   ```solidity
   // BAD: symbolic in setUp (setUp runs once, not symbolically)
   function setUp() public {
       uint256 supply = svm.createUint256("supply");
       token = new SimpleToken("Test", "TST", supply);
   }

   // GOOD: concrete in setUp, symbolic in check_ functions
   function setUp() public {
       token = new SimpleToken("Test", "TST", 1_000_000e18);
   }
   ```

3. **Check for overflow in initial state setup:**
   ```solidity
   function setUp() public {
       token = new SimpleToken("Test", "TST", 1_000_000e18);
       // Ensure deal amount does not exceed totalSupply
       deal(address(token), alice, 500_000e18);
   }
   ```

## Foundry Version Incompatibility

**Symptoms:**
- `ERROR: ABI mismatch`
- `ERROR: missing bytecode`
- Tests work with `forge test` but fail with `halmos`

**Solutions:**

1. **Rebuild with force:**
   ```bash
   forge clean && forge build
   halmos
   ```

2. **Check Foundry version compatibility.** Halmos may not support the latest Foundry output format:
   ```bash
   forge --version
   halmos --version
   ```

3. **Pin both versions in CI:**
   ```yaml
   - uses: foundry-rs/foundry-toolchain@v1
     with:
       version: nightly-2024-12-01
   - run: pip install halmos==0.2.1
   ```

## halmos-cheatcodes Import Errors

**Symptoms:**
- `Error: file not found: halmos-cheatcodes/SymTest.sol`
- Compilation fails on `import {SymTest} from "halmos-cheatcodes/SymTest.sol"`

**Solutions:**

1. **Install the dependency:**
   ```bash
   forge install a16z/halmos-cheatcodes
   ```

2. **Add remapping to foundry.toml:**
   ```toml
   remappings = [
       "halmos-cheatcodes/=lib/halmos-cheatcodes/src/",
   ]
   ```

3. **Verify the import path matches installed version:**
   ```bash
   ls lib/halmos-cheatcodes/src/
   # Should show SymTest.sol
   ```

## assertEq Passes When It Should Fail

**Symptoms:**
- You use `assertEq(a, b)` and Halmos reports PASS even though the property is wrong
- Switching to `assert(a == b)` produces a counter-example

**Cause:** `assertEq` from forge-std reverts on failure. Halmos treats reverts as valid execution paths (the transaction simply reverts — no invariant is violated). Only `assert()` failures are treated as property violations.

**Solution:**

```solidity
// WRONG: Halmos sees a revert, not a property violation
function check_bad(uint256 x) public {
    assertEq(x + 1, x); // Reverts via assertEq — Halmos says PASS
}

// CORRECT: Halmos checks the raw assertion
function check_good(uint256 x) public {
    assert(x + 1 == x); // Halmos finds counter-example
}
```

If you want reverts to count as failures, use `--error-unknown`. But the recommended practice is always `assert()` for symbolic properties.

## Counter-Example Not Reproducible

**Symptoms:**
- Halmos produces a counter-example
- Using those values in a concrete Foundry test does not reproduce the failure

**Solutions:**

1. **Check setUp differences.** Halmos and Foundry may set up state differently if your setUp depends on cheatcodes with different behavior:
   ```bash
   # Run concrete test with verbose trace
   forge test --match-test test_reproduce -vvvv
   ```

2. **Verify exact value encoding.** Halmos outputs hex — make sure you decode correctly:
   ```bash
   cast --to-dec 0x56bc75e2d63100000
   ```

3. **Account for storage layout differences.** If using `--storage-layout generic`, the concrete execution uses Solidity layout. State may differ.

4. **Check for non-determinism.** If setUp uses `block.timestamp` or other environment values, the symbolic and concrete executions may see different values.

## Performance Optimization Checklist

When Halmos is too slow for your CI pipeline:

1. **Start with the fastest possible run:**
   ```bash
   halmos --loop 2 --solver-timeout-assertion 30000 --early-exit --timeout 300
   ```

2. **Identify the slow tests:**
   ```bash
   halmos --statistics 2>&1 | sort -t: -k3 -n
   ```

3. **Separate fast and slow test contracts:**
   ```bash
   # Fast: run on every push
   halmos --contract FastPropertyTest --timeout 120

   # Slow: run nightly
   halmos --contract DeepPropertyTest --loop 10 --timeout 7200
   ```

4. **Cache solver results** if available in your Halmos version:
   ```bash
   halmos --cache-solver
   ```

5. **Parallelize across contracts** in CI:
   ```yaml
   strategy:
     matrix:
       contract: [TokenSymTest, VaultSymTest, GovernorSymTest]
   steps:
     - run: halmos --contract ${{ matrix.contract }}
   ```
