# Unit Testing Patterns

Foundry unit testing patterns using forge-std's `Test` base contract.

## Basic Test Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ERC20Token} from "../src/ERC20Token.sol";

contract ERC20TokenTest is Test {
    ERC20Token token;
    address alice;
    address bob;

    function setUp() public {
        // setUp runs before EVERY test function
        token = new ERC20Token("Test", "TST", 18);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        vm.label(address(token), "Token");
    }

    function testInitialSupply() public view {
        assertEq(token.totalSupply(), 0);
    }

    function testMint() public {
        token.mint(alice, 1000e18);
        assertEq(token.balanceOf(alice), 1000e18);
    }
}
```

Run with:

```bash
forge test --match-contract ERC20TokenTest -vv
```

## Assertion Patterns

```solidity
function testAssertions() public {
    // Equality
    assertEq(token.decimals(), 18);
    assertEq(token.name(), "Test");

    // Boolean
    assertTrue(token.balanceOf(alice) == 0);
    assertFalse(token.paused());

    // Comparison
    token.mint(alice, 500e18);
    assertGt(token.balanceOf(alice), 0);
    assertGe(token.balanceOf(alice), 500e18);
    assertLt(token.balanceOf(alice), 1000e18);
    assertLe(token.balanceOf(alice), 500e18);

    // Approximate equality — third arg is max delta
    // Useful for rounding in DeFi math
    assertApproxEqAbs(token.balanceOf(alice), 500e18, 1e15);

    // Approximate equality by percentage — third arg is max % delta (in WAD, 1e18 = 100%)
    assertApproxEqRel(token.balanceOf(alice), 499e18, 0.01e18); // within 1%

    // Custom error messages (last param on any assert)
    assertEq(token.balanceOf(alice), 500e18, "Alice should have 500 tokens");
}
```

## Testing Events with vm.expectEmit

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);

function testEmitsTransferEvent() public {
    token.mint(alice, 1000e18);

    // Args: checkTopic1, checkTopic2, checkTopic3, checkData
    vm.expectEmit(true, true, false, true);
    emit Transfer(alice, bob, 500e18);

    vm.prank(alice);
    token.transfer(bob, 500e18);
}

function testEmitsApprovalEvent() public {
    // Shorthand — check all topics and data (most common usage)
    vm.expectEmit(address(token));
    emit Approval(alice, bob, 1000e18);

    vm.prank(alice);
    token.approve(bob, 1000e18);
}

function testMultipleEvents() public {
    token.mint(alice, 1000e18);

    // Expect events in order — one expectEmit per event
    vm.expectEmit(true, true, false, true);
    emit Approval(alice, bob, 500e18);

    vm.expectEmit(true, true, false, true);
    emit Transfer(alice, bob, 500e18);

    vm.prank(alice);
    token.transferWithApproval(bob, 500e18);
}
```

## Testing Reverts with vm.expectRevert

```solidity
function testRevertWithCustomError() public {
    // Custom error with no args
    vm.prank(alice);
    vm.expectRevert(ERC20Token.Unauthorized.selector);
    token.mint(alice, 1000e18);
}

function testRevertWithCustomErrorAndArgs() public {
    token.mint(alice, 100e18);

    vm.prank(alice);
    vm.expectRevert(
        abi.encodeWithSelector(ERC20Token.InsufficientBalance.selector, 100e18, 200e18)
    );
    token.transfer(bob, 200e18);
}

function testRevertWithStringMessage() public {
    vm.expectRevert("ERC20: transfer to zero address");
    vm.prank(alice);
    token.transfer(address(0), 100e18);
}

function testRevertWithNoMessage() public {
    // Catches any revert regardless of message
    vm.expectRevert();
    token.riskyFunction();
}
```

## Label and Bound Helpers

```solidity
function testWithLabels() public {
    // Labels improve trace readability in -vvvv output
    address treasury = makeAddr("treasury");
    address feeCollector = makeAddr("feeCollector");
    vm.label(address(token), "ERC20Token");

    // Now traces show "treasury" instead of 0x1234...
    token.mint(treasury, 1_000_000e18);
    vm.prank(treasury);
    token.transfer(feeCollector, 50_000e18);
}

function testWithDealAndHoax() public {
    // deal sets ETH balance
    vm.deal(alice, 100 ether);
    assertEq(alice.balance, 100 ether);

    // hoax = deal + prank combined
    hoax(bob, 50 ether);
    // next call is from bob with 50 ETH balance
}

function testWithSkipAndRewind() public {
    uint256 start = block.timestamp;

    // skip advances block.timestamp by N seconds
    skip(1 days);
    assertEq(block.timestamp, start + 1 days);

    // rewind decreases block.timestamp by N seconds
    rewind(12 hours);
    assertEq(block.timestamp, start + 12 hours);
}
```

## Gas Snapshots

Capture per-test gas usage for regression tracking:

```bash
# Create .gas-snapshot file
forge snapshot

# Compare against existing snapshot (fails if regression detected)
forge snapshot --check

# Show diff against existing snapshot
forge snapshot --diff

# Run gas report per function call
forge test --gas-report

# Filter gas report to specific contract
forge test --gas-report --match-contract ERC20TokenTest
```

## Test Organization Patterns

```solidity
contract ERC20Token_transfer_Test is Test {
    // Group tests by function: ContractName_functionName_Test
    // This lets you run all transfer tests with:
    //   forge test --match-contract ERC20Token_transfer_Test

    function test_transfer_succeeds() public { /* ... */ }
    function test_transfer_revertsWhenInsufficientBalance() public { /* ... */ }
    function test_transfer_revertsWhenRecipientIsZero() public { /* ... */ }
    function test_transfer_emitsEvent() public { /* ... */ }
}
```

## Snapshot and Restore State

```solidity
function testSnapshotRestore() public {
    token.mint(alice, 1000e18);

    // Snapshot current EVM state
    uint256 snapshot = vm.snapshotState();

    // Modify state
    vm.prank(alice);
    token.transfer(bob, 500e18);
    assertEq(token.balanceOf(bob), 500e18);

    // Revert to snapshot — all state changes rolled back
    vm.revertToState(snapshot);
    assertEq(token.balanceOf(bob), 0);
    assertEq(token.balanceOf(alice), 1000e18);
}
```

## References

- [Foundry Book — Writing Tests](https://book.getfoundry.sh/forge/writing-tests)
- [forge-std Test Reference](https://book.getfoundry.sh/reference/forge-std/)
- [Cheatcodes Reference](https://book.getfoundry.sh/cheatcodes/)
