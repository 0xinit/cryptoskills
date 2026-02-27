# Halmos Error Codes and Common Failures

Reference for Halmos error messages, their causes, and fixes.

> Last verified: February 2026

## Solver Errors

### Solver Timeout

```
WARNING: check_myProperty(uint256): solver timeout (assertion)
```

**Cause**: The SMT solver (z3) could not determine satisfiability within the time limit.

**Fixes**:
1. Increase timeout: `--solver-timeout-assertion 120000` (milliseconds)
2. Simplify the property — break complex assertions into smaller checks
3. Reduce `--loop` bound to decrease path count
4. Add more `vm.assume` constraints to narrow the search space
5. Avoid complex arithmetic (exponentiation, modular arithmetic) that is hard for SMT solvers

### Solver Unknown

```
WARNING: check_myProperty(uint256): solver returned unknown
```

**Cause**: The solver could not determine whether the property holds or not. Different from timeout — the solver explicitly gave up.

**Fixes**:
1. Simplify the constraint — non-linear arithmetic is especially difficult for z3
2. Break the property into smaller sub-properties
3. Use `--solver-timeout-assertion 0` to let the solver run indefinitely (not recommended for CI)

## Path Explosion

### Too Many Paths

```
WARNING: check_myProperty: path count exceeds limit (10000)
```

**Cause**: The contract has too many conditional branches, causing exponential path growth.

**Fixes**:
1. Reduce `--loop` bound
2. Reduce `--depth` to limit call depth
3. Add `vm.assume` to constrain inputs and eliminate irrelevant paths
4. Test smaller units — verify individual functions rather than multi-step sequences
5. Use `--early-exit` to stop on first counter-example

### Path Explosion Indicators

Watch for these warning signs in output:
- Path count growing exponentially with `--loop` increase
- Single test taking minutes while others take seconds
- Memory usage climbing rapidly

```
# Healthy: linear path growth
--loop 2: paths 8,  time 2s
--loop 3: paths 12, time 3s
--loop 5: paths 20, time 5s

# Unhealthy: exponential path growth
--loop 2: paths 8,   time 2s
--loop 3: paths 32,  time 8s
--loop 5: paths 512, time 120s
```

## Unsupported Operations

### Unsupported Opcode

```
WARNING: unsupported opcode: CREATE2
```

**Cause**: Halmos does not support all EVM opcodes, especially those involving symbolic data in certain positions.

**Known unsupported or limited opcodes**:

| Opcode | Status |
|--------|--------|
| `CREATE2` with symbolic salt | Unsupported |
| `SELFDESTRUCT` | Deprecated in EVM, limited in Halmos |
| `DELEGATECALL` with symbolic target | Limited — target must be concrete |
| `STATICCALL` | Supported |
| `CREATE` | Supported with concrete init code |
| Precompiles (ecrecover, sha256, etc.) | Limited — may return symbolic values |

**Fixes**:
1. Mock the unsupported operation — replace `CREATE2` with a pre-deployed address
2. Use `vm.etch` to place code at a known address instead of dynamic deployment
3. Abstract away precompile calls behind an interface and provide concrete mock implementations

### Unsupported Cheatcode

```
WARNING: unsupported cheatcode: vm.createSelectFork
```

**Cause**: Halmos does not support all Foundry cheatcodes. See the cheatcode-reference for the full list.

**Fixes**:
1. Replace with supported alternatives (see cheatcode-reference.md)
2. Set up state manually with `vm.store` and `vm.deal` instead of forking
3. Use `vm.etch` to place contract bytecode at specific addresses

## Compilation and Setup Errors

### Contract Not Found

```
ERROR: contract not found: MyContractTest
```

**Cause**: Halmos cannot find the test contract in the compiled artifacts.

**Fixes**:
1. Run `forge build` before `halmos`
2. Check that the contract name matches exactly (case-sensitive)
3. Verify the test file is in the configured test directory
4. Check `foundry.toml` for correct `src`, `out`, and `test` paths

### No Tests Found

```
WARNING: no tests found
```

**Cause**: No functions with the `check_` prefix were found.

**Fixes**:
1. Prefix symbolic test functions with `check_` (not `test_`)
2. Make sure functions are `public` or `external`
3. Check that the contract inherits from `Test`
4. If using `--contract`, verify the contract name is correct
5. If using `--function`, verify the function name is correct

### Build Artifacts Stale

```
ERROR: ABI mismatch or missing bytecode
```

**Cause**: Compiled artifacts are out of date.

**Fix**: Run `forge build --force` to recompile, then run `halmos` again.

## Runtime Errors

### Assertion Failure (Expected)

```
[FAIL] check_myProperty(uint256)
Counterexample:
    p_x_uint256 = 0x...
```

**Cause**: Halmos found an input that violates the assertion. This is working as intended.

**Action**: Decode the counter-example, reproduce as a concrete test, fix the bug.

### Setup Revert

```
ERROR: setUp() reverted
```

**Cause**: The `setUp` function reverts during symbolic execution.

**Fixes**:
1. Check for unsupported cheatcodes in `setUp`
2. Ensure all contract deployments use concrete (not symbolic) constructor arguments
3. Verify that `setUp` does not depend on external state (forking, env vars)
4. Check for arithmetic overflow in initial token distribution

### Out of Memory

```
Killed (signal 9) or MemoryError
```

**Cause**: Halmos or z3 consumed too much memory, usually due to path explosion.

**Fixes**:
1. Reduce `--loop` and `--depth`
2. Split complex tests into smaller ones
3. Add `--early-exit` to stop on first failure
4. Increase system swap space (temporary measure)
5. Run on a machine with more RAM for complex contracts

## Halmos-Specific Warnings

### Symbolic Storage Access

```
WARNING: symbolic storage access at unknown slot
```

**Cause**: The contract reads from a storage slot that Halmos cannot resolve to a known variable.

**Fixes**:
1. Use `--storage-layout generic` for better storage modeling
2. Initialize all relevant storage in `setUp` with concrete values
3. Use `vm.store` to explicitly set storage values before testing

### Unbounded Symbolic Size

```
WARNING: unbounded symbolic size for dynamic array
```

**Cause**: A dynamic array parameter has no explicit length bound.

**Fix**: The `--loop` flag bounds the length. Increase it if needed, or use `vm.assume` on array length.

### Branching Timeout

```
WARNING: branching timeout reached
```

**Cause**: Halmos spent too long deciding which path to explore at a branch point.

**Fix**: Increase `--solver-timeout-branching` or simplify the branching condition.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | One or more tests failed (counter-example found) |
| 2 | Error during execution (compilation, setup, unsupported operation) |

```bash
halmos; echo "Exit code: $?"
```

Use exit codes in CI to fail pipelines on property violations:

```yaml
- name: Symbolic Tests
  run: halmos --solver-timeout-assertion 60000 --loop 5
  # Exit code 1 fails the CI step
```
