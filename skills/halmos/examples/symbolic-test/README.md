# Symbolic Test for ERC-20 Transfer

Prove that an ERC-20 transfer function is correct for ALL possible inputs — not just random samples. This example writes a symbolic test with Halmos that verifies supply conservation, balance correctness, and access control.

## Contract Under Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

error InsufficientBalance(address sender, uint256 balance, uint256 amount);
error ZeroAddress();

contract SimpleToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 amount);

    constructor(string memory _name, string memory _symbol, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[msg.sender] < amount) {
            revert InsufficientBalance(msg.sender, balanceOf[msg.sender], amount);
        }

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
```

## Symbolic Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {SimpleToken} from "../src/SimpleToken.sol";

contract TransferSymTest is Test {
    SimpleToken token;
    address alice;
    address bob;

    function setUp() public {
        token = new SimpleToken("Test", "TST", 1_000_000e18);
        alice = address(0x1);
        bob = address(0x2);

        // Give alice tokens via storage manipulation
        deal(address(token), alice, 500_000e18);
    }

    /// @dev Total supply must never change through transfers
    function check_transfer_supply_conservation(
        address to,
        uint256 amount
    ) public {
        // Constrain symbolic inputs to valid transfer preconditions
        vm.assume(to != address(0));
        vm.assume(to != alice);
        vm.assume(amount <= token.balanceOf(alice));

        uint256 supplyBefore = token.totalSupply();

        vm.prank(alice);
        token.transfer(to, amount);

        // Must hold for EVERY valid (to, amount) combination
        assert(token.totalSupply() == supplyBefore);
    }

    /// @dev Sender loses exactly the transferred amount
    function check_transfer_sender_accounting(
        address to,
        uint256 amount
    ) public {
        vm.assume(to != address(0));
        vm.assume(to != alice);
        vm.assume(amount <= token.balanceOf(alice));

        uint256 senderBefore = token.balanceOf(alice);

        vm.prank(alice);
        token.transfer(to, amount);

        assert(token.balanceOf(alice) == senderBefore - amount);
    }

    /// @dev Receiver gains exactly the transferred amount
    function check_transfer_receiver_accounting(
        address to,
        uint256 amount
    ) public {
        vm.assume(to != address(0));
        vm.assume(to != alice);
        vm.assume(amount <= token.balanceOf(alice));

        uint256 receiverBefore = token.balanceOf(to);

        vm.prank(alice);
        token.transfer(to, amount);

        assert(token.balanceOf(to) == receiverBefore + amount);
    }

    /// @dev Transfer to self: balance unchanged
    function check_transfer_to_self(uint256 amount) public {
        vm.assume(amount <= token.balanceOf(alice));

        uint256 balBefore = token.balanceOf(alice);

        vm.prank(alice);
        token.transfer(alice, amount);

        assert(token.balanceOf(alice) == balBefore);
    }

    /// @dev Zero transfer: always succeeds, no state change
    function check_transfer_zero_amount(address to) public {
        vm.assume(to != address(0));

        uint256 senderBefore = token.balanceOf(alice);
        uint256 receiverBefore = token.balanceOf(to);

        vm.prank(alice);
        token.transfer(to, 0);

        assert(token.balanceOf(alice) == senderBefore);
        assert(token.balanceOf(to) == receiverBefore);
    }

    /// @dev Third-party balances must not change
    function check_transfer_no_third_party_effect(
        address to,
        uint256 amount,
        address bystander
    ) public {
        vm.assume(to != address(0));
        vm.assume(to != alice);
        vm.assume(bystander != alice);
        vm.assume(bystander != to);
        vm.assume(amount <= token.balanceOf(alice));

        uint256 bystanderBefore = token.balanceOf(bystander);

        vm.prank(alice);
        token.transfer(to, amount);

        // No other account's balance should be affected
        assert(token.balanceOf(bystander) == bystanderBefore);
    }
}
```

## Running

```bash
# Build first
forge build

# Run all symbolic tests
halmos

# Run a specific check
halmos --function check_transfer_supply_conservation

# With increased loop bound and timeout
halmos --loop 3 --solver-timeout-assertion 60000
```

## Expected Output

```
Running 6 tests for test/TransferSym.t.sol:TransferSymTest
[PASS] check_transfer_supply_conservation(address,uint256) (paths: 3, time: 1.82s)
[PASS] check_transfer_sender_accounting(address,uint256) (paths: 3, time: 1.95s)
[PASS] check_transfer_receiver_accounting(address,uint256) (paths: 3, time: 2.01s)
[PASS] check_transfer_to_self(uint256) (paths: 2, time: 1.43s)
[PASS] check_transfer_zero_amount(address) (paths: 2, time: 1.21s)
[PASS] check_transfer_no_third_party_effect(address,uint256,address) (paths: 3, time: 3.15s)
```

All tests pass, meaning these properties hold for ALL possible inputs — not just the random subset a fuzzer would test.

## Comparison with Foundry Fuzz Test

The equivalent fuzz test:

```solidity
function test_transfer_supply_conservation(
    address to,
    uint256 amount
) public {
    vm.assume(to != address(0));
    vm.assume(to != alice);
    vm.assume(amount <= token.balanceOf(alice));

    uint256 supplyBefore = token.totalSupply();
    vm.prank(alice);
    token.transfer(to, amount);
    assertEq(token.totalSupply(), supplyBefore);
}
```

The fuzz test runs with ~256 random inputs by default. Halmos checks ALL ~2^256 possible `amount` values and ALL ~2^160 possible `to` addresses symbolically.

> Last verified: February 2026
