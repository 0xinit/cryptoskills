# Mythril Detection Modules

All Mythril detection modules with vulnerability descriptions and SWC mappings. Modules are the analysis plugins that define what Mythril looks for during symbolic execution.

## Module Reference

### ether_thief

**SWC-105: Unprotected Ether Withdrawal**

Detects when any arbitrary sender can withdraw Ether from the contract. Mythril checks if there exists a transaction sequence where an attacker (who is not the contract deployer) can cause Ether to be sent to an attacker-controlled address.

```bash
myth analyze Contract.sol -m ether_thief
```

Catches:
- Missing access control on withdrawal functions
- Unprotected `selfdestruct` that sends ETH to caller
- Fallback functions that forward contract balance

### suicide

**SWC-106: Unprotected Selfdestruct**

Detects `selfdestruct` (or `SELFDESTRUCT` opcode) that can be called by an unauthorized address. A successful exploit permanently destroys the contract and sends remaining ETH to the attacker.

```bash
myth analyze Contract.sol -m suicide
```

Catches:
- `selfdestruct` without `onlyOwner` or equivalent guard
- `selfdestruct` reachable through delegatecall to attacker-controlled implementation

### delegatecall

**SWC-112: Delegatecall to Untrusted Callee**

Detects `delegatecall` where the target address can be influenced by a user. Since `delegatecall` executes the target's code in the context of the calling contract (same storage, same `msg.sender`), an attacker-controlled target can overwrite arbitrary storage slots.

```bash
myth analyze Contract.sol -m delegatecall
```

Catches:
- `delegatecall` with user-supplied address parameter
- Proxy patterns where implementation address is not properly protected
- Libraries called via `delegatecall` with controllable function selectors

### state_change_external_calls (reentrancy)

**SWC-107: Reentrancy**

Detects state variables that are written after an external call. The external call gives the recipient control flow, allowing them to re-enter the calling contract before state updates complete.

```bash
myth analyze Contract.sol -m state_change_external_calls
```

Catches:
- Classic reentrancy: `call{value:}` before balance update
- Cross-function reentrancy: external call in function A, state read in function B
- Read-only reentrancy: external call before state update that another view function reads

### integer

**SWC-101: Integer Overflow and Underflow**

Detects arithmetic operations that can overflow or underflow. Primarily relevant for Solidity <0.8.0 contracts or code inside `unchecked {}` blocks in 0.8.x+.

```bash
myth analyze Contract.sol -m integer
```

Catches:
- Addition/multiplication overflow in unchecked blocks
- Subtraction underflow in unchecked blocks
- Casting overflow (e.g., `uint256` to `uint128` truncation)

For Solidity 0.8.x+ contracts without `unchecked`, this module rarely triggers because the compiler inserts overflow checks. Exclude it to speed up analysis:

```bash
myth analyze Contract.sol --exclude-modules integer
```

### unchecked_retval

**SWC-104: Unchecked Call Return Value**

Detects low-level calls (`.call()`, `.delegatecall()`, `.staticcall()`, `.send()`) where the return value is not checked. A failed call returns `false` instead of reverting, so ignoring the return value means the transaction continues with silent failure.

```bash
myth analyze Contract.sol -m unchecked_retval
```

Catches:
- `address.call{value: amount}("")` without checking the bool return
- `address.send(amount)` without checking return
- `address.delegatecall(data)` without checking return

### tx_origin

**SWC-115: Authorization through tx.origin**

Detects use of `tx.origin` for authorization checks. `tx.origin` returns the original external account that initiated the transaction, not the immediate caller. This enables phishing attacks where a malicious contract tricks the owner into calling it, then calls the victim contract with the owner's `tx.origin`.

```bash
myth analyze Contract.sol -m tx_origin
```

Catches:
- `require(tx.origin == owner)` patterns
- `if (tx.origin == admin)` conditionals
- Any comparison of `tx.origin` used as an access control mechanism

### exceptions

**SWC-110: Assert Violation**

Detects reachable `assert()` statements that can fail. In Solidity, `assert` is intended for invariant checking — it should never be reachable with inputs that cause it to fail. A reachable `assert(false)` indicates either a logic bug or an incorrect invariant assumption.

```bash
myth analyze Contract.sol -m exceptions
```

Catches:
- `assert(balance >= 0)` that can be violated through arithmetic
- `assert(totalSupply == sum(balances))` where the invariant breaks
- Compiler-generated assertions (array bounds, division by zero)

Note: This module produces the most false positives. Custom `assert` statements used as defensive checks will trigger findings even when they represent correct defensive programming.

### external_calls

**SWC-107: Dangerous External Call Patterns**

Detects dangerous patterns in external calls beyond reentrancy — including calls to addresses derived from user input and calls with user-controlled calldata.

```bash
myth analyze Contract.sol -m external_calls
```

### arbitrary_write

**SWC-124: Write to Arbitrary Storage Location**

Detects when a user-controllable value can determine which storage slot is written to. This is critical because EVM storage is a flat key-value map — an attacker who controls the storage key can overwrite any contract state, including the owner variable.

```bash
myth analyze Contract.sol -m arbitrary_write
```

Catches:
- Array access with unbounded user input as index
- Mapping key derivation that collides with critical storage slots
- Assembly `sstore` with user-controlled slot parameter

### arbitrary_read

**No SWC mapping**

Detects when a user-controllable value can determine which storage slot is read. While less dangerous than arbitrary write, arbitrary reads can leak private state or enable oracle manipulation.

```bash
myth analyze Contract.sol -m arbitrary_read
```

### multiple_sends

**SWC-113: DoS with Failed Call**

Detects functions that make multiple external calls (ETH sends) in a single transaction. If one recipient's fallback reverts, the entire transaction reverts — blocking all other recipients from receiving their funds.

```bash
myth analyze Contract.sol -m multiple_sends
```

Catches:
- Loops that send ETH to multiple addresses
- Batch payout functions where one revert blocks all payouts

### dependence_on_predictable_vars

**SWC-116, SWC-120: Block Variable Dependence**

Detects reliance on predictable block variables (`block.timestamp`, `block.number`, `blockhash`) for critical logic. Validators can manipulate `block.timestamp` within a ~15 second window, and `blockhash` is only available for the most recent 256 blocks.

```bash
myth analyze Contract.sol -m dependence_on_predictable_vars
```

Catches:
- Using `block.timestamp` as randomness source
- Time-based access control with tight windows
- `blockhash` used for lottery/gambling outcomes

## Running Multiple Modules

```bash
# Comma-separated module names
myth analyze Contract.sol -m reentrancy,ether_thief,delegatecall

# Exclude specific modules
myth analyze Contract.sol --exclude-modules integer,exceptions
```

## Module Selection Guide

| Contract Type | Recommended Modules | Exclude |
|---------------|--------------------|---------|
| Solidity 0.8.x+ vault/treasury | `ether_thief,state_change_external_calls,delegatecall,unchecked_retval` | `integer` |
| Pre-0.8 legacy contract | All modules | None |
| Proxy/upgradeable | `delegatecall,suicide,arbitrary_write` | None |
| Token contract | `integer,state_change_external_calls,unchecked_retval` | `suicide` |
| Governance/DAO | `tx_origin,ether_thief,state_change_external_calls,exceptions` | None |

Last verified: February 2026
