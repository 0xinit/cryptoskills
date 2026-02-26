# Security Tooling Troubleshooting

Common issues with security tools, fuzzers, and audit workflows.

## Slither False Positives

### Problem: Slither flags valid code as reentrancy

**Cause:** Slither is conservative. It flags any state change after an external call, even if a `nonReentrant` modifier is present.

**Triage:**

1. Check if `nonReentrant` is applied -- if so, mark as false positive
2. Check if the external call target is trusted and immutable (e.g., WETH `deposit`)
3. Check if CEI is followed despite the flag

**Suppress known false positives:**

```python
# slither.config.json
{
  "filter_paths": ["node_modules", "lib", "test"],
  "exclude_informational": true,
  "exclude_low": false,
  "detectors_to_exclude": "naming-convention,solc-version"
}
```

For individual suppressions, use inline comments:

```solidity
// slither-disable-next-line reentrancy-benign
(bool ok, ) = weth.call{value: amount}("");
```

### Problem: Slither cannot resolve imports

**Fix:** Ensure `remappings.txt` or `foundry.toml` remappings are correct. Slither reads Foundry config.

```bash
# Verify remappings resolve
forge remappings

# Run Slither with explicit Foundry config
slither . --foundry-out-directory out
```

## Fuzzer Not Finding Known Bugs

### Problem: Fuzz tests pass but known vulnerability exists

**Root causes:**

1. **Insufficient runs** -- increase `--fuzz-runs` to 50,000+
2. **Input not reaching vulnerable path** -- constraints are too tight

```solidity
// Bad: bounds exclude vulnerable range
function testFuzz_withdraw(uint256 amount) public {
    amount = bound(amount, 1, 100); // attacker needs > 100
}

// Better: full range with realistic constraints
function testFuzz_withdraw(uint256 amount) public {
    amount = bound(amount, 1, type(uint128).max);
}
```

3. **Missing attacker contract** -- fuzzer sends simple calls, not reentrant callbacks. Write explicit attacker contracts for reentrancy testing instead of relying on the fuzzer.

4. **Corpus too small** -- for invariant tests, increase `runs` and `depth`:

```toml
# foundry.toml
[invariant]
runs = 512
depth = 128
```

## Invariant Test Failures

### Problem: Invariant test reverts in handler setup, not in the actual invariant

**Cause:** Handler functions revert on invalid inputs before reaching the invariant check.

**Fix:** Use `bound()` and `try/catch` in handlers to avoid spurious reverts:

```solidity
function handler_deposit(uint256 amount) external {
    amount = bound(amount, 1, token.balanceOf(address(this)));
    try vault.deposit(amount) {} catch {
        // Expected revert on invalid state -- skip, do not count as failure
    }
}
```

### Problem: Invariant passes despite broken protocol

**Cause:** Handler does not cover the attack path. If no handler calls `withdraw()` during a callback, reentrancy is never tested.

**Fix:** Ensure handlers cover all external entry points. Add an attacker handler that simulates reentrant calls.

## Verification Tool Timeouts

### Problem: Mythril or Certora times out on large contracts

**Fixes:**

1. **Reduce scope** -- analyze individual functions, not the whole contract:

```bash
myth analyze src/Vault.sol --execution-timeout 600 -t 3
```

2. **Simplify contract** -- extract the function under test into a minimal harness
3. **Increase resources** -- Mythril and Certora are CPU-intensive. Run on CI machines with 16+ GB RAM.
4. **Bound state space** -- for Certora, add `require` preconditions in specs to prune unreachable states.

## Complex Reentrancy Not Detected by Tools

### Problem: Cross-contract reentrancy through token callbacks (ERC-777, ERC-1155)

**Why tools miss it:** Static analyzers trace within a single contract. Cross-contract reentrancy requires tracing call chains across multiple deployed contracts.

**Approach:**

1. Write explicit Foundry tests with attacker contracts that re-enter via `tokensReceived()` (ERC-777) or `onERC1155Received()` (ERC-1155)
2. Use Echidna with multi-contract configs
3. Manual review of all token standards that have receiver callbacks

## Upgradeability Security Issues

### Problem: Storage collision after upgrade

**Detection:**

```bash
# Compare storage layouts between V1 and V2
forge inspect ContractV1 storage-layout > v1_layout.json
forge inspect ContractV2 storage-layout > v2_layout.json
diff v1_layout.json v2_layout.json
```

**Fix:** Only append new variables. Never insert between existing ones. Always use `__gap` pattern.

### Problem: Implementation not initialized

After deploying a UUPS implementation, anyone can call `initialize()` on the implementation contract itself (not the proxy) and potentially exploit it.

**Fix:** Always include `_disableInitializers()` in the implementation constructor:

```solidity
/// @custom:oz-upgrades-unsafe-allow constructor
constructor() {
    _disableInitializers();
}
```

## Common Audit Finding Resolution

| Finding | Typical Fix |
|---------|------------|
| Missing zero-address check | Add `require(addr != address(0))` or custom error |
| Centralization risk | Migrate admin to multisig, add timelock |
| No event emission | Add events to all state-changing functions |
| Floating pragma | Pin to exact version: `pragma solidity 0.8.20;` |
| Missing NatSpec | Add `@notice`, `@param`, `@return` to public/external functions |
| Unused return value | Capture and handle or explicitly discard with `(, )` |
| Gas optimization | Use `calldata` over `memory`, pack storage, cache storage reads |
