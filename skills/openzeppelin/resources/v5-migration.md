# OpenZeppelin V4 to V5 Migration Guide

V5 shipped breaking changes. This guide covers every change that will cause compilation failures or behavioral differences.

## Import Path Changes

V5 import paths stayed structurally the same (`@openzeppelin/contracts/...`), but some contracts moved or were removed. If you were importing from barrel files, switch to specific paths:

```solidity
// v4 (still works, but verify the contract exists in v5)
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Upgradeable variant
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
```

## Removed Contracts

| Removed | Replacement |
|---------|-------------|
| `SafeMath` | Built-in Solidity 0.8+ overflow checks |
| `Counters` | Plain `uint256` with `++` operator |
| `ERC20Snapshot` | `ERC20Votes` (use checkpoints instead) |
| `ERC777` | Entire standard removed (reentrancy risks) |
| `GovernorCompatibilityBravo` | Use `GovernorCountingSimple` directly |
| `TokenTimelock` | Use `VestingWallet` |
| `ERC20PresetMinterPauser` | Use the Contracts Wizard to generate |
| `ERC721PresetMinterPauserAutoId` | Use the Contracts Wizard to generate |

## Constructor Changes

### Ownable Requires Initial Owner

```solidity
// v4: default owner was msg.sender
contract MyContract is Ownable { }

// v5: MUST pass initial owner explicitly
contract MyContract is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}
}
```

### Pausable Moved to utils

```solidity
// v4
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

// v5
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
```

### ReentrancyGuard Moved to utils

```solidity
// v4
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// v5
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
```

## Hook Function Changes (ERC20)

The single `_update` hook replaces `_beforeTokenTransfer` and `_afterTokenTransfer`.

```solidity
// v4
function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
    super._beforeTokenTransfer(from, to, amount);
}

// v5
function _update(address from, address to, uint256 value) internal override {
    super._update(from, to, value);
}
```

## Hook Function Changes (ERC721)

```solidity
// v4
function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override {
    super._beforeTokenTransfer(from, to, tokenId, batchSize);
}

// v5: different signature, returns previous owner
function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
    return super._update(to, tokenId, auth);
}
```

ERC721Enumerable now also requires `_increaseBalance` override:

```solidity
function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
    super._increaseBalance(account, value);
}
```

## Access Control Changes

### _setupRole Removed

```solidity
// v4
_setupRole(DEFAULT_ADMIN_ROLE, admin);

// v5
_grantRole(DEFAULT_ADMIN_ROLE, admin);
```

### renounceRole Requires Caller Confirmation

```solidity
// v4
accessControl.renounceRole(ROLE, msg.sender);

// v5: second param is callerConfirmation (prevents accidents)
accessControl.renounceRole(ROLE, msg.sender);
// Same call signature, but the contract now validates that account == msg.sender
```

## Custom Errors Replace Require Strings

V5 uses custom errors for gas efficiency. Error names follow the pattern `ContractNameErrorName`.

```solidity
// v4
require(balance >= amount, "ERC20: transfer amount exceeds balance");

// v5: custom error (cheaper gas, better tooling)
error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
```

Catching errors in tests:

```solidity
// Foundry
vm.expectRevert(
    abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, sender, balance, needed)
);
```

## ERC20 Breaking Changes

| v4 | v5 |
|----|-----|
| `_beforeTokenTransfer` / `_afterTokenTransfer` | `_update(from, to, value)` |
| `_mint` / `_burn` call hooks | `_update` with `from=address(0)` (mint) or `to=address(0)` (burn) |
| `ERC20Snapshot` | Removed. Use `ERC20Votes` checkpoints |
| Require strings | Custom errors |

## ERC721 Breaking Changes

| v4 | v5 |
|----|-----|
| `_beforeTokenTransfer` / `_afterTokenTransfer` | `_update(to, tokenId, auth)` returns `address` |
| `_safeMint` override | Override `_update` instead |
| `ERC721Enumerable` override | Must override both `_update` and `_increaseBalance` |
| Require strings | Custom errors |

## New Features in V5

### AccessManager

Centralized permission hub. Contracts delegate auth checks to a single AccessManager instead of storing roles internally.

```solidity
import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";

contract MyContract is AccessManaged {
    constructor(address manager) AccessManaged(manager) {}

    function restricted() external restricted { }
}
```

### ERC-7201 Namespaced Storage

Upgradeable contracts use structured storage namespaces instead of `__gap` arrays. Reduces storage collision risk.

### GovernorStorage

New extension that stores proposal details on-chain, eliminating the need to pass full proposal data for queue/execute calls.

### Nonces Utility

Shared nonce tracking extracted into a standalone contract. Both ERC20Permit and ERC20Votes inherit from `Nonces`, requiring a diamond resolution override.

### ERC2771Forwarder

Improved meta-transaction support with built-in nonce and deadline validation.

## Migration Checklist

- [ ] Update `@openzeppelin/contracts` to `^5.0.0`
- [ ] Update Solidity pragma to `^0.8.20`
- [ ] Replace `_beforeTokenTransfer` / `_afterTokenTransfer` with `_update`
- [ ] Add `_increaseBalance` override if using ERC721Enumerable
- [ ] Pass initial owner to `Ownable` constructor
- [ ] Replace `_setupRole` with `_grantRole`
- [ ] Remove `SafeMath` and `Counters` usage
- [ ] Move `Pausable` and `ReentrancyGuard` imports from `security/` to `utils/`
- [ ] Update error handling for custom errors
- [ ] Add `nonces` override if combining ERC20Permit with ERC20Votes
- [ ] Run full test suite and fix compilation errors

## References

- [Official V5 Migration Guide](https://docs.openzeppelin.com/contracts/5.x/upgradeable)
- [V5 Changelog](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/CHANGELOG.md)
- [Contracts Wizard](https://wizard.openzeppelin.com/) (generates v5 code)
