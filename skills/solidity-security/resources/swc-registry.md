# SWC Registry Quick Reference

Smart Contract Weakness Classification -- standard identifiers for Solidity vulnerabilities. Reference: [swcregistry.io](https://swcregistry.io/)

## SWC-101: Integer Overflow and Underflow

Arithmetic operation exceeds the range of the type.

**Status:** Mostly mitigated in Solidity 0.8+ (checked math by default). Still relevant inside `unchecked {}` blocks and assembly.

```solidity
// Vulnerable (0.8+ unchecked block)
unchecked {
    uint8 x = 255;
    x += 1; // wraps to 0
}

// Safe
uint8 x = 255;
x += 1; // reverts with overflow
```

**Detection:** Slither `controlled-array-length`, Mythril `integer-overflow`

## SWC-104: Unchecked Call Return Value

Low-level `call`, `send`, or `delegatecall` returns `false` on failure, but code does not check it.

```solidity
// Vulnerable
payable(to).send(amount); // silently fails if send returns false

// Safe
(bool ok, ) = to.call{value: amount}("");
require(ok, "Transfer failed");
```

**Detection:** Slither `unchecked-lowlevel`, `unchecked-send`

## SWC-106: Unprotected SELFDESTRUCT

`selfdestruct` callable by unauthorized accounts destroys the contract and sends all funds to an arbitrary address.

```solidity
// Vulnerable
function kill() external {
    selfdestruct(payable(msg.sender));
}

// Safe
function kill() external onlyRole(DEFAULT_ADMIN_ROLE) {
    selfdestruct(payable(msg.sender));
}
```

**Note:** Post-Dencun (EIP-6780), `selfdestruct` only destroys storage when called in the same transaction as contract creation. It still force-sends ETH in all cases.

**Detection:** Slither `suicidal`

## SWC-107: Reentrancy

External call allows callee to re-enter the calling contract before state is finalized.

```solidity
// Vulnerable -- state update after external call
function withdraw(uint256 amt) external {
    require(balances[msg.sender] >= amt);
    (bool ok, ) = msg.sender.call{value: amt}("");
    require(ok);
    balances[msg.sender] -= amt;
}

// Safe -- CEI pattern + ReentrancyGuard
function withdraw(uint256 amt) external nonReentrant {
    require(balances[msg.sender] >= amt);
    balances[msg.sender] -= amt;
    (bool ok, ) = msg.sender.call{value: amt}("");
    require(ok);
}
```

**Detection:** Slither `reentrancy-eth`, `reentrancy-no-eth`, Mythril `state-change-after-external-call`

## SWC-110: Assert Violation

`assert()` should only guard invariants that can never be false under correct operation. Using `assert()` for input validation wastes gas (consumes all remaining gas on failure) and signals a bug, not a user error.

```solidity
// Wrong -- assert for input validation
assert(amount > 0);

// Correct -- require for input validation, assert for invariants
require(amount > 0, "Zero amount");
assert(totalSupply == sumOfAllBalances); // true invariant
```

**Detection:** Mythril `assert-violation`

## SWC-111: Use of Deprecated Solidity Functions

Functions removed or deprecated in newer Solidity versions.

| Deprecated | Replacement |
|-----------|-------------|
| `msg.gas` | `gasleft()` |
| `throw` | `revert()` |
| `sha3(...)` | `keccak256(...)` |
| `callcode(...)` | `delegatecall(...)` |
| `suicide(addr)` | `selfdestruct(addr)` |
| `constant` (functions) | `view` or `pure` |

**Detection:** Slither `deprecated-standards`, compiler warnings

## SWC-112: Delegatecall to Untrusted Callee

`delegatecall` executes foreign code in the caller's storage context. If the target is user-controlled, an attacker can overwrite any storage slot.

```solidity
// Vulnerable -- user controls target
function forward(address target, bytes calldata data) external {
    (bool ok, ) = target.delegatecall(data);
    require(ok);
}

// Safe -- whitelist targets
mapping(address => bool) public approvedTargets;
function forward(address target, bytes calldata data) external {
    require(approvedTargets[target], "Unapproved target");
    (bool ok, ) = target.delegatecall(data);
    require(ok);
}
```

**Detection:** Slither `controlled-delegatecall`

## SWC-115: Authorization Through tx.origin

`tx.origin` is the original EOA, not the immediate caller. A phishing contract can relay calls with the victim's `tx.origin`.

```solidity
// Vulnerable
require(tx.origin == owner, "Not owner");

// Safe
require(msg.sender == owner, "Not owner");
```

**Detection:** Slither `tx-origin`

## SWC-116: Block Values as a Proxy for Time

`block.timestamp` is set by the validator and can be manipulated by ~15 seconds. Never use for tight time windows or entropy.

```solidity
// Vulnerable -- tight window
require(block.timestamp == targetTime, "Wrong time");

// Safe -- use a range
require(block.timestamp >= startTime && block.timestamp <= endTime, "Outside window");
```

**Detection:** Slither `timestamp`

## SWC-120: Weak Sources of Randomness from Chain Attributes

`block.timestamp`, `block.number`, `blockhash`, and `block.prevrandao` are observable and/or manipulable by validators. They are not secure randomness sources.

```solidity
// Vulnerable
uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));

// Safe -- use Chainlink VRF or similar oracle-based randomness
// See https://docs.chain.link/vrf
```

**Detection:** Slither `weak-prng`, manual review

## Quick Lookup

| SWC | Name | Solidity 0.8 Status |
|-----|------|---------------------|
| 101 | Integer Overflow | Mitigated (except `unchecked`) |
| 104 | Unchecked Return Value | Still relevant |
| 106 | Unprotected SELFDESTRUCT | Reduced impact post-Dencun |
| 107 | Reentrancy | Still relevant |
| 110 | Assert Violation | Still relevant |
| 111 | Deprecated Functions | Compiler catches most |
| 112 | Delegatecall to Untrusted | Still relevant |
| 115 | tx.origin Auth | Still relevant |
| 116 | Block Timestamp | Still relevant |
| 120 | Weak Randomness | Still relevant |
