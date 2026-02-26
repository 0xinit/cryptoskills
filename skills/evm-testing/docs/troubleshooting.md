# Troubleshooting

Common testing issues across Foundry and Hardhat with diagnosis and solutions.

## "Stack too deep" in Complex Test Setups

**Symptoms:** Compiler error `CompilerError: Stack too deep` in test files with many local variables.

**Solutions:**

1. Extract variables into struct:
```solidity
struct TestState {
    address user;
    uint256 depositAmount;
    uint256 sharesBefore;
    uint256 sharesAfter;
    uint256 balanceBefore;
}

function test_complexScenario() public {
    TestState memory s;
    s.user = makeAddr("user");
    s.depositAmount = 1 ether;
    // ...
}
```

2. Break test into helper functions to reduce variables in a single scope.

3. Use `via-ir` in `foundry.toml` (slower compilation but handles deeper stacks):
```toml
[profile.default]
via_ir = true
```

## Fuzz Test Takes Too Long

**Symptoms:** `forge test` hangs for minutes on a single fuzz test.

**Solutions:**

1. Reduce runs during development:
```toml
[fuzz]
runs = 64
```

2. Tighten `bound()` ranges -- smaller input space means faster convergence:
```solidity
// Too wide -- most runs test uninteresting large values
amount = bound(amount, 1, type(uint256).max);

// Tighter -- focuses on realistic range
amount = bound(amount, 1e15, 100_000e18);
```

3. Replace `vm.assume()` with `bound()` when possible. Heavy rejection wastes runs.

4. Profile with `forge test --match-test <name> -vvvv` to see which runs are slow.

## Invariant Test Never Finds Bug

**Symptoms:** Invariant test passes with 100% success but you know the bug exists.

**Solutions:**

1. **Handler coverage too narrow.** Verify handler functions cover all entry points. Check `handler.calls` summary to see which functions were called:
```bash
forge test --match-test invariant_ -vvv
# Look for: [handler function call summary]
```

2. **Depth too shallow.** Increase depth to explore deeper state transitions:
```toml
[invariant]
depth = 200
runs = 500
```

3. **Ghost variables not updated.** Ensure ghost variables are updated inside handler functions, after the external call. If a handler early-returns, ghost variables must not be modified.

4. **Inputs too constrained.** Widen `bound()` ranges in handler functions. The fuzzer can only find bugs in the input space you allow.

5. **Missing targetContract.** Without explicit `targetContract`, Foundry may call functions on the wrong contracts. Always set it in `setUp()`.

## Fork Test Fails with RPC Errors

**Symptoms:** `EvmError: RPC error`, `JsonRpcError`, or `Too many requests` during fork tests.

**Solutions:**

1. **Rate limiting.** Use a paid RPC provider (Alchemy, Infura, QuickNode) or reduce concurrent requests. Add retry logic in CI:
```bash
forge test --match-contract ForkTest --retries 3
```

2. **Stale block.** Pin block number in `vm.createSelectFork`:
```solidity
vm.createSelectFork("mainnet", 19_500_000);
```

3. **Enable RPC caching** to avoid redundant requests:
```toml
[rpc_storage_caching]
chains = "all"
endpoints = "all"
```

4. **Cache location.** Cache lives at `~/.foundry/cache/rpc`. Delete it if you suspect corrupted data:
```bash
rm -rf ~/.foundry/cache/rpc
```

## "EvmError: Revert" with No Message

**Symptoms:** Test fails with `EvmError: Revert` but no error message, making it impossible to identify the failing call.

**Solutions:**

1. **Add vm.expectRevert** before the call you expect to fail. Without it, the test reverts and you get no useful output.

2. **Run with verbosity** to see the full trace:
```bash
forge test --match-test test_name -vvvv
```
The trace shows exactly which call reverted.

3. **Check for low-level calls** in the contract under test. `address.call()` that fails returns `false` instead of reverting -- your contract may swallow the error.

4. **Check for re-entrancy guards.** If a function calls back into the same contract, re-entrancy protection reverts with no message.

## Gas Snapshot Differences Between Runs

**Symptoms:** `forge snapshot --check` fails even though code hasn't changed.

**Solutions:**

1. **Fuzz test randomness.** Fuzz tests use random inputs, so gas varies per run. Either exclude fuzz tests from snapshots or pin the seed:
```toml
[fuzz]
seed = "0x1"
```

2. **Fork state.** If block number isn't pinned, chain state changes affect gas. Always pin block numbers.

3. **Compiler non-determinism.** Rare, but `solc` optimizer can produce slightly different bytecode. Pin compiler version:
```toml
[profile.default]
solc_version = "0.8.28"
```

## Hardhat vs Foundry Test Result Differences

**Symptoms:** Same contract logic, but tests pass in one framework and fail in the other.

**Common causes:**

1. **Gas estimation.** Hardhat uses `eth_estimateGas` with generous limits. Foundry tests use the exact gas. A function that barely fits in Foundry may pass in Hardhat.

2. **Timestamp precision.** Hardhat advances time by 1 second per block by default. Foundry does not auto-advance timestamp between calls within a test.

3. **Block context.** Hardhat and Foundry may set different default values for `block.basefee`, `block.prevrandao`, and `block.chainid` in local mode.

4. **Compiler settings.** Ensure both use the same optimizer settings and EVM version in their respective configs.

## "setUp() failed" Debugging

**Symptoms:** `forge test` shows `setUp() failed` but no useful error message.

**Solutions:**

1. **Run with max verbosity:**
```bash
forge test --match-contract FailingTest -vvvv
```
This shows the full trace of `setUp()` including which call reverted.

2. **Check constructor arguments.** If deploying a contract in `setUp()` fails, the error often comes from the constructor. Verify arguments match the constructor signature.

3. **Check fork availability.** If `setUp()` creates a fork, verify the RPC URL is set and accessible:
```bash
cast block-number --rpc-url $ETH_RPC_URL
```

4. **Check ETH balances.** The test contract starts with `type(uint256).max` ETH by default, but if you `vm.deal` to 0, subsequent calls that need ETH will fail.

5. **Isolate the issue.** Comment out all setUp logic, then add lines back one at a time to find the failing call.

## "Transaction reverted without a reason string"

**Symptoms:** Hardhat test fails with `Error: Transaction reverted without a reason string`.

**Solutions:**

1. The contract uses `revert()` without an error message, a custom error, or a low-level call that failed.

2. Run the transaction with `REPORT_GAS=true` to see if it ran out of gas.

3. Check for `require(false)` without a message string in the contract code or its dependencies.

4. In Hardhat, use `.revertedWithoutReason()` instead of `.revertedWith("")`:
```typescript
await expect(tx).to.be.revertedWithoutReason();
```

## References

- [Foundry Book - Debugging](https://book.getfoundry.sh/forge/debugger)
- [Foundry Book - Gas Reports](https://book.getfoundry.sh/forge/gas-reports)
- [Hardhat Network Reference](https://hardhat.org/hardhat-network/docs/reference)
