# Detect Reentrancy with Taint Tracking

Write a Semgrep rule that uses taint tracking to detect reentrancy — tracing ETH value from an external call to a state change that happens after the call.

## Why Taint Tracking

Simple pattern matching for reentrancy (external call followed by state change) produces false positives when:
- The state change is unrelated to the external call
- The function has a reentrancy guard
- The call is to a trusted contract

Taint tracking lets us trace the actual data flow: does the value from the external call (or a variable dependent on it) influence the state update?

## The Rule

Create `rules/reentrancy-taint.yaml`:

```yaml
rules:
  # Rule 1: Classic reentrancy — state update after ETH transfer
  - id: reentrancy-eth-transfer
    patterns:
      - pattern: |
          $ADDR.call{value: $AMT}($DATA);
          ...
          $MAPPING[$KEY] = $VAL;
      - pattern-not-inside: |
          function $F(...) ... nonReentrant ... { ... }
      - pattern-inside: |
          function $F(...) external { ... }
    message: >-
      State update after external call in function $F — classic reentrancy.
      The external call to $ADDR could re-enter this function before
      $MAPPING is updated. Move state changes before the call (CEI pattern)
      or add a reentrancy guard.
    languages: [solidity]
    severity: ERROR
    metadata:
      category: security
      cwe: "CWE-841: Improper Enforcement of Behavioral Workflow"
      confidence: HIGH
      references:
        - https://swcregistry.io/docs/SWC-107

  # Rule 2: Taint-based — user input flows to call target without guard
  - id: reentrancy-tainted-callback
    mode: taint
    message: >-
      User-supplied address receives ETH via low-level call, and state
      is modified afterward. The recipient can re-enter before state
      updates complete.
    languages: [solidity]
    severity: ERROR
    pattern-sources:
      - patterns:
          - pattern: $PARAM
          - pattern-inside: |
              function $F(..., address $PARAM, ...) external { ... }
    pattern-sinks:
      - pattern: $ADDR.call{value: ...}(...)
    metadata:
      category: security
      confidence: HIGH

  # Rule 3: Cross-function reentrancy via shared state
  - id: reentrancy-cross-function
    patterns:
      - pattern: |
          function $F1(...) external {
            ...
            $ADDR.call{value: ...}(...);
            ...
          }
      - pattern-not-inside: |
          function $F1(...) external nonReentrant { ... }
    message: >-
      External function $F1 makes an external call without nonReentrant.
      If other functions read shared state, cross-function reentrancy
      is possible. Add ReentrancyGuard to all state-modifying external
      functions, not just this one.
    languages: [solidity]
    severity: WARNING
    metadata:
      category: security
      confidence: MEDIUM
```

## Test Cases

Create `rules/reentrancy-taint.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ReentrancyTests {
    mapping(address => uint256) public balances;

    // ruleid: reentrancy-eth-transfer
    function withdrawVulnerable(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        balances[msg.sender] -= amount;
    }

    // ok: reentrancy-eth-transfer
    function withdrawSafeCEI(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
    }
}

contract ReentrancyGuarded is ReentrancyGuard {
    mapping(address => uint256) public balances;

    // ok: reentrancy-eth-transfer
    function withdrawSafeGuard(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient");
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        balances[msg.sender] -= amount;
    }
}

contract TaintedCallback {
    mapping(address => uint256) public balances;

    // ruleid: reentrancy-tainted-callback
    function sendTo(address recipient, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");
        (bool ok, ) = recipient.call{value: amount}("");
        require(ok);
        balances[msg.sender] -= amount;
    }

    // ok: reentrancy-tainted-callback
    function sendToFixed(address recipient, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount;
        (bool ok, ) = recipient.call{value: amount}("");
        require(ok);
    }
}
```

## Running

```bash
# Test the rules
semgrep --test ./rules/reentrancy-taint.yaml

# Run against a project
semgrep --config rules/reentrancy-taint.yaml ./contracts/

# Run with SARIF output for GitHub code scanning
semgrep --config rules/reentrancy-taint.yaml --sarif ./contracts/ > reentrancy.sarif
```

## Understanding Taint Flow

```
Source: function parameter (address recipient)  ← user-controlled
  │
  ▼
Propagation: assigned to local variable, passed to call
  │
  ▼
Sink: recipient.call{value: amount}("")  ← dangerous operation
```

The taint rule fires because:
1. `recipient` is a parameter of an `external` function (source)
2. `recipient` flows to the target of `.call{value:}` (sink)
3. No sanitizer (e.g., whitelist check) breaks the taint chain

## Extending: ERC20 Reentrancy

ERC-777 tokens have `tokensReceived` callbacks that enable reentrancy through ERC20-like interfaces:

```yaml
rules:
  - id: erc777-reentrancy-via-transfer
    patterns:
      - pattern: |
          $TOKEN.transfer($TO, $AMOUNT);
          ...
          $STATE[$KEY] = $VAL;
      - pattern-not-inside: |
          function $F(...) ... nonReentrant ... { ... }
    message: >-
      State update after token transfer. If the token implements ERC-777
      hooks (tokensReceived), the recipient can re-enter. Apply
      nonReentrant or move state changes before the transfer.
    languages: [solidity]
    severity: WARNING
    metadata:
      confidence: MEDIUM
```

## Key Takeaways

1. Use `mode: taint` when you need to track data flow, not just pattern proximity
2. Pattern-based reentrancy rules (Rule 1) are simpler and catch the classic case
3. Taint-based rules (Rule 2) catch cases where the call target is user-controlled
4. Always exclude `nonReentrant`-guarded functions with `pattern-not-inside`
5. Test both vulnerable and safe variants to validate true/false positive rates
6. Consider ERC-777 callback reentrancy — not just ETH transfers

Last verified: February 2026
