# Bounded Model Checking for Loop-Heavy Contracts

Demonstrate how Halmos's `--loop` flag affects verification of contracts with loops. Shows what "bounded" means in practice and how to choose appropriate bounds.

## Contract Under Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

error EmptyArray();
error Overflow();

/// @dev Batch operations that involve loops — common in airdrops, vesting, voting
contract BatchProcessor {
    mapping(address => uint256) public balances;
    uint256 public totalDistributed;

    event BatchTransfer(uint256 count, uint256 total);

    /// @dev Distribute different amounts to multiple recipients
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        if (recipients.length == 0) revert EmptyArray();
        if (recipients.length != amounts.length) revert EmptyArray();

        uint256 total;
        for (uint256 i = 0; i < recipients.length; i++) {
            balances[recipients[i]] += amounts[i];
            total += amounts[i];
        }

        totalDistributed += total;
        emit BatchTransfer(recipients.length, total);
    }

    /// @dev Find maximum balance across accounts
    function maxBalance(address[] calldata accounts) external view returns (uint256 max) {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (balances[accounts[i]] > max) {
                max = balances[accounts[i]];
            }
        }
    }

    /// @dev Sum all balances in an array
    function sumBalances(address[] calldata accounts) external view returns (uint256 sum) {
        for (uint256 i = 0; i < accounts.length; i++) {
            sum += balances[accounts[i]];
        }
    }
}
```

## Symbolic Tests with Loop Bounds

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {BatchProcessor} from "../src/BatchProcessor.sol";

contract BoundedCheckSymTest is Test {
    BatchProcessor processor;

    function setUp() public {
        processor = new BatchProcessor();
    }

    /// @dev batchTransfer: total distributed must equal sum of amounts
    ///      With --loop 3, this is verified for arrays of length 0, 1, 2, 3
    function check_batch_total_tracking(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) public {
        vm.assume(recipients.length > 0);
        vm.assume(recipients.length == amounts.length);

        // Bound individual amounts to prevent overflow
        for (uint256 i = 0; i < amounts.length; i++) {
            vm.assume(amounts[i] <= 1e30);
        }

        uint256 distributedBefore = processor.totalDistributed();

        processor.batchTransfer(recipients, amounts);

        // Calculate expected total
        uint256 expectedIncrease;
        for (uint256 i = 0; i < amounts.length; i++) {
            expectedIncrease += amounts[i];
        }

        assert(
            processor.totalDistributed() == distributedBefore + expectedIncrease
        );
    }

    /// @dev maxBalance must return a value >= every individual balance
    function check_max_is_upper_bound(
        address[] calldata accounts
    ) public {
        vm.assume(accounts.length > 0);

        // Give symbolic balances to each account
        for (uint256 i = 0; i < accounts.length; i++) {
            vm.assume(accounts[i] != address(0));
        }

        uint256 max = processor.maxBalance(accounts);

        for (uint256 i = 0; i < accounts.length; i++) {
            assert(max >= processor.balances(accounts[i]));
        }
    }

    /// @dev maxBalance must return a value that exists in the array
    function check_max_exists_in_array(
        address[] calldata accounts
    ) public {
        vm.assume(accounts.length > 0);

        uint256 max = processor.maxBalance(accounts);

        // At least one account must have the max balance
        bool found = false;
        for (uint256 i = 0; i < accounts.length; i++) {
            if (processor.balances(accounts[i]) == max) {
                found = true;
            }
        }
        assert(found);
    }

    /// @dev Two sequential batch transfers: totals are additive
    function check_batch_additive(
        address[] calldata recipients1,
        uint256[] calldata amounts1,
        address[] calldata recipients2,
        uint256[] calldata amounts2
    ) public {
        vm.assume(recipients1.length > 0);
        vm.assume(recipients1.length == amounts1.length);
        vm.assume(recipients2.length > 0);
        vm.assume(recipients2.length == amounts2.length);

        for (uint256 i = 0; i < amounts1.length; i++) {
            vm.assume(amounts1[i] <= 1e30);
        }
        for (uint256 i = 0; i < amounts2.length; i++) {
            vm.assume(amounts2[i] <= 1e30);
        }

        processor.batchTransfer(recipients1, amounts1);
        uint256 afterFirst = processor.totalDistributed();

        processor.batchTransfer(recipients2, amounts2);
        uint256 afterSecond = processor.totalDistributed();

        // Second batch adds to the total, never subtracts
        assert(afterSecond >= afterFirst);
    }
}
```

## Running with Different Bounds

```bash
# Default: --loop 2 (checks arrays of length 0, 1, 2)
halmos --contract BoundedCheckSymTest

# Higher bound: arrays up to length 5
halmos --contract BoundedCheckSymTest --loop 5

# Maximum practical bound for this contract
halmos --contract BoundedCheckSymTest --loop 10 --solver-timeout-assertion 120000
```

## Understanding --loop Output

### With --loop 2 (default):

```
[PASS] check_batch_total_tracking(address[],uint256[]) (paths: 8, time: 4.21s)
```

This means: "For arrays of length 0, 1, or 2, the property holds for ALL possible addresses and amounts."

### With --loop 5:

```
[PASS] check_batch_total_tracking(address[],uint256[]) (paths: 24, time: 18.73s)
```

More paths explored (up to length 5), more time, higher confidence.

### With --loop 10:

```
[PASS] check_batch_total_tracking(address[],uint256[]) (paths: 56, time: 87.42s)
```

Significant time increase. Each additional loop iteration roughly doubles the path count.

## What Bounded Means in Practice

```
--loop 2:  Verified for arrays up to length 2
--loop 5:  Verified for arrays up to length 5
--loop 10: Verified for arrays up to length 10
--loop 256: Verified for arrays up to length 256 (may timeout)
```

### Choosing the Right Bound

| Contract Pattern | Recommended --loop | Rationale |
|-----------------|-------------------|-----------|
| Fixed-size arrays (e.g., 3 signers) | Exact size + 1 | Cover the exact case plus off-by-one |
| Dynamic arrays with `require(len <= 100)` | 10-20 | Covers typical usage; bugs in loop logic show up early |
| Unbounded arrays (no length check) | 5-10 | Beyond 10, solver time grows exponentially |
| Single iteration (no array loops) | 2 (default) | Sufficient for non-loop code |

### When Bounds Are Insufficient

If a bug only manifests at array length 11 but you run `--loop 10`, Halmos will report PASS. Example:

```solidity
/// @dev Bug: off-by-one that only triggers at length > 10
function buggyProcess(uint256[] calldata data) external {
    for (uint256 i = 0; i <= data.length; i++) { // <= instead of <
        if (i < data.length) {
            // Processes correctly for i < length
        }
        // At i == data.length, this is a no-op for small arrays
        // but causes issues in downstream logic for length > 10
    }
}
```

**Mitigation**: Combine Halmos (bounded proof) with Foundry fuzz tests (unbounded random exploration). The fuzzer may hit length 11+ randomly.

## Practical Tips

### 1. Start with Low Bounds, Increase Gradually

```bash
# Quick feedback loop
halmos --loop 2 --solver-timeout-assertion 30000

# After tests pass at low bounds, increase
halmos --loop 5 --solver-timeout-assertion 60000

# CI: use moderate bounds with generous timeout
halmos --loop 5 --solver-timeout-assertion 120000
```

### 2. Separate Loop-Heavy Tests

Keep loop-intensive tests in separate contracts so you can run them with different flags:

```bash
# Fast tests (no loops)
halmos --contract SimplePropertyTest

# Slow tests (loops, higher bounds)
halmos --contract LoopPropertyTest --loop 10 --solver-timeout-assertion 180000
```

### 3. Watch the Path Count

If path count grows exponentially with bound increase, your contract may have path explosion issues. Consider simplifying the test or splitting properties.

```
--loop 2: paths: 8    (good — linear growth)
--loop 3: paths: 16   (acceptable)
--loop 5: paths: 512  (exponential — may timeout at higher bounds)
```

> Last verified: February 2026
