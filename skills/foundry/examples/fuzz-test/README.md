# Fuzz Testing

Foundry auto-generates random inputs for any test function with parameters. No additional tooling required.

## Basic Fuzz Test

Any test function parameter becomes a fuzz input. Foundry generates random values and runs the test hundreds of times.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Vault} from "../src/Vault.sol";

contract VaultFuzzTest is Test {
    Vault vault;
    address alice = makeAddr("alice");

    function setUp() public {
        vault = new Vault();
    }

    function testFuzz_deposit(uint256 amount) public {
        // Without bounding, amount can be 0 to type(uint256).max
        amount = bound(amount, 1, 100 ether);

        vm.deal(alice, amount);
        vm.prank(alice);
        vault.deposit{value: amount}();

        assertEq(vault.balanceOf(alice), amount);
        assertEq(address(vault).balance, amount);
    }
}
```

Run:

```bash
forge test --match-test testFuzz -vv
```

## Bound vs vm.assume

```solidity
function testFuzz_transferBound(uint256 amount) public {
    // PREFERRED: bound() clamps value to range without discarding runs
    amount = bound(amount, 1, 1000e18);

    token.mint(alice, amount);
    vm.prank(alice);
    token.transfer(bob, amount);
    assertEq(token.balanceOf(bob), amount);
}

function testFuzz_transferAssume(uint256 amount) public {
    // AVOID unless necessary: vm.assume discards inputs that don't match.
    // Too many rejections (>65536 by default) cause test failure.
    vm.assume(amount > 0 && amount <= 1000e18);

    token.mint(alice, amount);
    vm.prank(alice);
    token.transfer(bob, amount);
    assertEq(token.balanceOf(bob), amount);
}
```

Rule: use `bound()` for ranges, `vm.assume()` only for constraints that cannot be expressed as ranges (e.g., `vm.assume(a != b)`).

## Fuzz Runs Configuration

In `foundry.toml`:

```toml
[fuzz]
runs = 256            # Number of random inputs per fuzz test (default 256)
max_test_rejects = 65536  # Max rejected inputs before failure
seed = "0x1"         # Fixed seed for reproducibility (optional)
```

Override per-run:

```bash
# More runs for CI
forge test --fuzz-runs 10000

# Fixed seed to reproduce a failure
FOUNDRY_FUZZ_SEED=0xdeadbeef forge test --match-test testFuzz_deposit
```

## Multiple Fuzz Inputs

```solidity
function testFuzz_transferBetweenUsers(
    uint256 mintAmount,
    uint256 transferAmount,
    address recipient
) public {
    mintAmount = bound(mintAmount, 1e18, 1_000_000e18);
    transferAmount = bound(transferAmount, 1, mintAmount);

    // Filter out addresses that would cause reverts for non-property reasons
    vm.assume(recipient != address(0));
    vm.assume(recipient != alice);

    token.mint(alice, mintAmount);

    vm.prank(alice);
    token.transfer(recipient, transferAmount);

    assertEq(token.balanceOf(recipient), transferAmount);
    assertEq(token.balanceOf(alice), mintAmount - transferAmount);
}
```

## Structured Fuzzing with Custom Types

```solidity
struct FuzzInput {
    uint128 depositAmount;
    uint128 withdrawAmount;
    uint32 timeSkip;
}

function testFuzz_depositAndWithdraw(FuzzInput memory input) public {
    uint256 deposit = bound(uint256(input.depositAmount), 0.01 ether, 100 ether);
    uint256 timeSkip = bound(uint256(input.timeSkip), 0, 365 days);

    vm.deal(alice, deposit);
    vm.prank(alice);
    vault.deposit{value: deposit}();

    skip(timeSkip);

    uint256 maxWithdraw = vault.balanceOf(alice);
    uint256 withdraw = bound(uint256(input.withdrawAmount), 0, maxWithdraw);

    if (withdraw > 0) {
        vm.prank(alice);
        vault.withdraw(withdraw);
        assertEq(vault.balanceOf(alice), maxWithdraw - withdraw);
    }
}
```

## Failure Replay

When a fuzz test fails, Foundry prints the counterexample:

```
[FAIL. Reason: assertion failed]
  Counterexample: args=[115792089237316195423570985008687907853269984665640564039457584007913129639935]
```

Reproduce the exact failure:

```bash
# Replay with the seed that found the failure
FOUNDRY_FUZZ_SEED=0x<seed_from_output> forge test --match-test testFuzz_deposit -vvvv

# Or hardcode the input as a unit test to debug
```

```solidity
function test_depositEdgeCase() public {
    // Pin the counterexample as a permanent regression test
    uint256 amount = 115792089237316195423570985008687907853269984665640564039457584007913129639935;
    testFuzz_deposit(amount);
}
```

## Common Fuzz Patterns

### Property: no tokens created from nothing

```solidity
function testFuzz_noTokensFromNothing(uint256 amount, address to) public {
    vm.assume(to != address(0));
    amount = bound(amount, 0, 1_000_000e18);

    uint256 supplyBefore = token.totalSupply();
    token.mint(to, amount);

    assertEq(token.totalSupply(), supplyBefore + amount);
}
```

### Property: transfers are zero-sum

```solidity
function testFuzz_transferZeroSum(uint256 amount) public {
    amount = bound(amount, 1, 1_000_000e18);
    token.mint(alice, amount);

    uint256 aliceBefore = token.balanceOf(alice);
    uint256 bobBefore = token.balanceOf(bob);

    vm.prank(alice);
    token.transfer(bob, amount);

    uint256 aliceAfter = token.balanceOf(alice);
    uint256 bobAfter = token.balanceOf(bob);

    // Conservation: sum of balances unchanged
    assertEq(aliceBefore + bobBefore, aliceAfter + bobAfter);
}
```

### Property: arithmetic doesn't overflow

```solidity
function testFuzz_noOverflowOnDeposit(uint256 existingBalance, uint256 newDeposit) public {
    existingBalance = bound(existingBalance, 0, type(uint128).max);
    newDeposit = bound(newDeposit, 0, type(uint128).max);

    vault.setBalance(alice, existingBalance);
    vm.deal(alice, newDeposit);
    vm.prank(alice);
    vault.deposit{value: newDeposit}();

    assertEq(vault.balanceOf(alice), existingBalance + newDeposit);
}
```

## References

- [Foundry Book — Fuzz Testing](https://book.getfoundry.sh/forge/fuzz-testing)
- [Foundry Book — Fuzz Configuration](https://book.getfoundry.sh/reference/config/testing#fuzz)
