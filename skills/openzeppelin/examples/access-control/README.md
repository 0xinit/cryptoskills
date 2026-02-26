# Access Control Examples

OpenZeppelin v5 access control patterns, from single-admin to role-based.

## Ownable (Single Owner)

Simplest access model. One address has all admin privileges.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleVault is Ownable {
    event Withdrawal(address indexed to, uint256 amount);

    // v5: MUST pass initial owner -- no default owner
    constructor(address initialOwner) Ownable(initialOwner) {}

    function withdraw(uint256 amount) external onlyOwner {
        emit Withdrawal(msg.sender, amount);
        payable(owner()).transfer(amount);
    }
}
```

## Ownable2Step (Safe Ownership Transfer)

Two-phase transfer prevents losing ownership to a typo address. New owner must explicitly accept.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract SafeVault is Ownable2Step {
    constructor(address initialOwner) Ownable(initialOwner) {}

    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
```

Transfer flow:

```solidity
// Step 1: Current owner initiates transfer
safeVault.transferOwnership(newOwnerAddress);

// Step 2: New owner accepts (from newOwnerAddress)
safeVault.acceptOwnership();

// If newOwnerAddress never calls acceptOwnership, ownership stays with the original owner
```

## AccessControl (Role-Based)

Multiple independent roles. Each role has an admin role that can grant and revoke it.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract Treasury is AccessControl {
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    event Deposit(address indexed from, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);
    event AuditCompleted(address indexed auditor, uint256 timestamp);

    constructor(address admin) {
        // v5: use _grantRole in constructor (_setupRole was removed)
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURER_ROLE, admin);
    }

    function withdraw(address payable to, uint256 amount) external onlyRole(TREASURER_ROLE) {
        emit Withdrawal(to, amount);
        to.transfer(amount);
    }

    function logAudit() external onlyRole(AUDITOR_ROLE) {
        emit AuditCompleted(msg.sender, block.timestamp);
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
}
```

## AccessControlDefaultAdminRules

Adds safety rules to the DEFAULT_ADMIN_ROLE: delayed transfers and a two-step acceptance process. Prevents accidental admin loss in high-value protocols.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlDefaultAdminRules} from
    "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";

contract SecureTreasury is AccessControlDefaultAdminRules {
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");

    event Withdrawal(address indexed to, uint256 amount);

    // 3-day delay before admin transfer takes effect
    constructor(address initialAdmin)
        AccessControlDefaultAdminRules(3 days, initialAdmin)
    {}

    function withdraw(address payable to, uint256 amount) external onlyRole(TREASURER_ROLE) {
        emit Withdrawal(to, amount);
        to.transfer(amount);
    }
}
```

Admin transfer flow with delay:

```solidity
// Step 1: Current admin begins transfer (starts the delay timer)
secureTreasury.beginDefaultAdminTransfer(newAdmin);

// Step 2: Wait for delay period (3 days in this example)

// Step 3: New admin accepts
secureTreasury.acceptDefaultAdminTransfer();

// Can cancel during delay period
secureTreasury.cancelDefaultAdminTransfer();
```

## Custom Roles with DEFAULT_ADMIN_ROLE

`DEFAULT_ADMIN_ROLE` (bytes32(0)) is the admin of every role by default. Set custom admin hierarchies with `_setRoleAdmin`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract MultiTierAccess is AccessControl {
    bytes32 public constant OPERATOR_ADMIN = keccak256("OPERATOR_ADMIN");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);

        // OPERATOR_ADMIN can grant/revoke OPERATOR_ROLE
        // This means DEFAULT_ADMIN_ROLE does NOT directly manage OPERATOR_ROLE
        _setRoleAdmin(OPERATOR_ROLE, OPERATOR_ADMIN);

        _grantRole(OPERATOR_ADMIN, admin);
    }
}
```

## Granting and Revoking Roles

```solidity
// Grant a role (caller must have the role's admin role)
treasury.grantRole(TREASURER_ROLE, newTreasurer);

// Revoke a role (caller must have the role's admin role)
treasury.revokeRole(TREASURER_ROLE, oldTreasurer);

// Renounce your own role
// v5: requires callerConfirmation to prevent accidental renouncement
treasury.renounceRole(TREASURER_ROLE, msg.sender);

// Check if an account has a role
bool isTreasurer = treasury.hasRole(TREASURER_ROLE, someAddress);

// Get the admin role for a given role
bytes32 adminRole = treasury.getRoleAdmin(TREASURER_ROLE);
```

## Pattern Comparison

| Feature | Ownable | Ownable2Step | AccessControl | AccessControlDefaultAdminRules |
|---------|---------|-------------|---------------|-------------------------------|
| Single admin | Yes | Yes | Yes | Yes |
| Multiple roles | No | No | Yes | Yes |
| Safe transfer | No | Yes | No | Yes (admin only) |
| Transfer delay | No | No | No | Yes |
| Gas cost | Low | Low | Medium | Medium |
| Use case | Simple tokens | DeFi vaults | DAOs, protocols | High-value protocols |

## Import Path Reference

| Contract | Import Path |
|----------|-------------|
| Ownable | `@openzeppelin/contracts/access/Ownable.sol` |
| Ownable2Step | `@openzeppelin/contracts/access/Ownable2Step.sol` |
| AccessControl | `@openzeppelin/contracts/access/AccessControl.sol` |
| AccessControlDefaultAdminRules | `@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol` |
| AccessManager | `@openzeppelin/contracts/access/manager/AccessManager.sol` |
| AccessManaged | `@openzeppelin/contracts/access/manager/AccessManaged.sol` |
