// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {SymTest} from "halmos-cheatcodes/SymTest.sol";

// Replace with your contract import
// import {MyToken} from "../src/MyToken.sol";

/**
 * Halmos Symbolic Test Template
 *
 * Usage:
 * 1. Replace MyToken with your contract
 * 2. Update setUp() with your deployment logic
 * 3. Write check_ functions for properties to verify
 * 4. Run: halmos --loop 3 --solver-timeout-assertion 60000
 *
 * Key differences from Foundry fuzz tests:
 * - Prefix functions with check_ (not test_)
 * - Use assert() instead of assertEq/assertGt (Halmos treats reverts as acceptable)
 * - vm.assume() constrains symbolic inputs (not just filtering random values)
 * - Parameters are symbolic (ALL values), not random
 *
 * Dependencies:
 *   forge install a16z/halmos-cheatcodes
 */

// Minimal interface for the template — replace with your contract
interface IToken {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MyContractSymTest is SymTest, Test {
    IToken token;

    address alice;
    address bob;

    function setUp() public {
        // Deploy your contract here
        // token = IToken(address(new MyToken("Test", "TST", 1_000_000e18)));

        alice = address(0x1);
        bob = address(0x2);

        // Set initial state
        // deal(address(token), alice, 1000e18);
        // deal(address(token), bob, 500e18);
    }

    // =========================================================================
    // Supply Invariants
    // =========================================================================

    /// @dev Transfer must not change total supply
    function check_transfer_preserves_supply(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(to != alice);
        vm.assume(amount <= token.balanceOf(alice));

        uint256 supplyBefore = token.totalSupply();

        vm.prank(alice);
        token.transfer(to, amount);

        assert(token.totalSupply() == supplyBefore);
    }

    /// @dev TransferFrom must not change total supply
    function check_transferFrom_preserves_supply(
        address from,
        address to,
        uint256 amount
    ) public {
        vm.assume(from != address(0));
        vm.assume(to != address(0));
        vm.assume(from != to);
        vm.assume(amount <= token.balanceOf(from));

        vm.prank(from);
        token.approve(address(this), amount);

        uint256 supplyBefore = token.totalSupply();

        token.transferFrom(from, to, amount);

        assert(token.totalSupply() == supplyBefore);
    }

    // =========================================================================
    // Balance Invariants
    // =========================================================================

    /// @dev Sender balance decreases by exactly the transfer amount
    function check_transfer_sender_balance(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(to != alice);
        vm.assume(amount <= token.balanceOf(alice));

        uint256 balBefore = token.balanceOf(alice);

        vm.prank(alice);
        token.transfer(to, amount);

        assert(token.balanceOf(alice) == balBefore - amount);
    }

    /// @dev Receiver balance increases by exactly the transfer amount
    function check_transfer_receiver_balance(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(to != alice);
        vm.assume(amount <= token.balanceOf(alice));

        uint256 balBefore = token.balanceOf(to);

        vm.prank(alice);
        token.transfer(to, amount);

        assert(token.balanceOf(to) == balBefore + amount);
    }

    // =========================================================================
    // Access Control
    // =========================================================================

    /// @dev Cannot transfer more than balance
    function check_transfer_bounded_by_balance(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount > token.balanceOf(alice));

        vm.prank(alice);
        // Halmos: if this call does NOT revert, something is wrong
        // We expect a revert for amounts exceeding balance
        (bool success,) = address(token).call(
            abi.encodeCall(IToken.transfer, (to, amount))
        );
        assert(!success);
    }

    // =========================================================================
    // Symbolic Storage Example
    // =========================================================================

    /// @dev Demonstrate symbolic state creation
    function check_symbolic_state_example() public {
        uint256 symbolicAmount = svm.createUint256("amount");
        address symbolicAddr = svm.createAddress("recipient");

        vm.assume(symbolicAddr != address(0));
        vm.assume(symbolicAmount > 0);
        vm.assume(symbolicAmount <= token.balanceOf(alice));

        uint256 totalBefore = token.balanceOf(alice) + token.balanceOf(symbolicAddr);

        vm.prank(alice);
        token.transfer(symbolicAddr, symbolicAmount);

        uint256 totalAfter = token.balanceOf(alice) + token.balanceOf(symbolicAddr);

        // Conservation: sum of sender + receiver balances unchanged
        assert(totalAfter == totalBefore);
    }
}
