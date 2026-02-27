# Slither Detector List

Complete reference of all Slither detectors organized by severity. Run `slither --list-detectors` to see the list for your installed version.

Last verified: February 2026 against Slither v0.10.x

## High Impact

| Detector ID | Confidence | Description |
|-------------|------------|-------------|
| `abiencoderv2-array` | High | ABI encoder v2 array compiler bug (solc 0.4.7-0.5.9) |
| `arbitrary-send-erc20` | High | `transferFrom` with `from` not set to `msg.sender` — allows stealing approved tokens |
| `arbitrary-send-erc20-permit` | High | Arbitrary `from` in `transferFrom` combined with `permit` — steal tokens without prior approval |
| `arbitrary-send-eth` | Medium | Unprotected ETH transfer to user-controlled address |
| `array-by-reference` | High | Storage array passed by value to internal function — modifications lost |
| `controlled-array-length` | High | Direct assignment to `array.length` enables arbitrary storage writes (pre-0.6.0) |
| `controlled-delegatecall` | High | `delegatecall` target controlled by user input — full storage takeover |
| `delegatecall-loop` | High | `delegatecall` inside loop in `payable` function — `msg.value` reused per iteration |
| `encode-packed-collision` | High | `abi.encodePacked` with multiple dynamic types — hash collision possible |
| `incorrect-exp` | High | `^` used instead of `**` — XOR vs exponentiation |
| `incorrect-return` | High | `return` in assembly block exits entire function prematurely |
| `incorrect-shift` | High | Shift operands reversed in assembly — shifts wrong direction |
| `msg-value-loop` | High | `msg.value` read inside loop — same value counted per iteration |
| `multiple-constructors` | High | Multiple constructor definitions (solc < 0.4.22 allows both old/new syntax) |
| `name-reused` | High | Duplicate contract names prevent correct artifact generation |
| `protected-vars` | High | State variable annotated with security comment but unprotected in code |
| `public-mappings-nested` | High | Public mapping with nested struct (compiler bug pre-0.5.0) |
| `reentrancy-balance` | High | Balance check before external call — attacker re-enters with stale balance |
| `reentrancy-eth` | High | State written after ETH-transferring external call — classic reentrancy |
| `return-leave` | High | `return` used instead of `leave` in Yul — silently returns wrong value |
| `rtlo` | High | Right-to-left override Unicode character — visual source manipulation |
| `shadowing-state` | High | Derived contract redeclares parent state variable — writes go to wrong slot |
| `storage-array` | High | Signed integer array compiler bug (solc 0.4.7-0.5.10) |
| `suicidal` | High | `selfdestruct` callable without access control |
| `unchecked-transfer` | High | ERC20 `transfer`/`transferFrom` return value not checked — silent failure |
| `uninitialized-state` | High | State variable read before any assignment — defaults to zero |
| `uninitialized-storage` | High | Local `storage` pointer overlaps critical state variable slots |
| `unprotected-upgrade` | High | Upgradeable proxy `initialize` has no access control |
| `weak-prng` | High | Pseudorandom number derived from `block.timestamp` or `blockhash` |

## Medium Impact

| Detector ID | Confidence | Description |
|-------------|------------|-------------|
| `boolean-cst` | Medium | Boolean constant misuse in conditions (`if (true)`, `require(false)`) |
| `chronicle-unchecked-price` | Medium | Chronicle oracle price not checked for validity before use |
| `constant-function-asm` | Medium | Function marked `view`/`pure` contains assembly that may modify state |
| `constant-function-state` | Medium | Function marked `view`/`pure` modifies state variables |
| `divide-before-multiply` | Medium | Division truncates before multiplication — precision loss compounds |
| `domain-separator-collision` | Medium | Function selector collides with EIP-2612 `DOMAIN_SEPARATOR()` (0x3644e515) |
| `enum-conversion` | Medium | Out-of-range integer-to-enum cast (solc < 0.4.5 does not revert) |
| `erc20-interface` | Medium | ERC20 function returns wrong type — breaks composability |
| `erc721-interface` | Medium | ERC721 function returns wrong type |
| `gelato-unprotected-randomness` | Medium | Gelato VRF callback has no access control |
| `incorrect-equality` | Medium | Strict `==` on ETH balance or token balance — manipulable via `selfdestruct` or direct transfer |
| `locked-ether` | Medium | Contract has `payable` function but no way to withdraw ETH |
| `mapping-deletion` | Medium | `delete structVar` leaves nested mapping data intact |
| `out-of-order-retryable` | Medium | Arbitrum retryable tickets created out of order — second can execute before first |
| `pyth-deprecated-functions` | Medium | Deprecated Pyth Network function used — will break in future versions |
| `pyth-unchecked-confidence` | Medium | Pyth oracle confidence interval not validated |
| `pyth-unchecked-publishtime` | Medium | Pyth oracle `publishTime` not checked for staleness |
| `reentrancy-no-eth` | Medium | State written after external call (no ETH) — reentrancy for state manipulation |
| `reused-constructor` | Medium | Base constructor called from multiple inheritance paths — executed twice |
| `shadowing-abstract` | Medium | State variable shadows abstract contract's variable |
| `tautological-compare` | Medium | Variable compared to itself (`x >= x`) — always true |
| `tautology` | Medium | Expression is always true or always false |
| `tx-origin` | Medium | `tx.origin` used for authorization — phishable via forwarding contract |
| `unchecked-lowlevel` | Medium | `.call()` return value not checked — failure silently ignored |
| `unchecked-send` | Medium | `.send()` return value not checked |
| `uninitialized-local` | Medium | Local variable used before assignment |
| `unused-return` | Medium | Return value from external call discarded |
| `write-after-write` | Medium | State variable written twice without read between — first write is dead |

## Low Impact

| Detector ID | Confidence | Description |
|-------------|------------|-------------|
| `calls-loop` | Medium | External call inside loop — single revert DoS-es entire transaction |
| `chainlink-feed-registry` | Medium | Chainlink Feed Registry used — only deployed on Ethereum mainnet |
| `events-access` | Medium | Access control change (role grant, owner transfer) without event |
| `events-maths` | Medium | Arithmetic parameter change (fee, rate, threshold) without event |
| `incorrect-modifier` | Low | Modifier has execution path without `_` placeholder or revert |
| `incorrect-unary` | Medium | Unary expression looks like typo (`=+` instead of `+=`) |
| `missing-zero-check` | Medium | Address parameter not validated against `address(0)` |
| `optimism-deprecation` | Medium | Deprecated Optimism predeploy or function |
| `reentrancy-benign` | Medium | Reentrancy possible but no harmful state change identified |
| `reentrancy-events` | Medium | Reentrancy that can reorder event emissions |
| `return-bomb` | Medium | External call callee can return huge data — consumes all caller gas |
| `shadowing-builtin` | High | Local/state variable shadows Solidity builtin (`now`, `msg`, `block`) |
| `shadowing-local` | High | Local variable shadows state variable or parent function |
| `timestamp` | Medium | Logic depends on `block.timestamp` — miner-manipulable by ~15 seconds |
| `uninitialized-fptr-cst` | High | Function pointer in constructor not initialized — points to wrong function |
| `variable-scope` | High | Variable referenced before declaration in same scope |
| `void-cst` | Medium | Constructor calls base constructor that has no implementation |

## Informational

| Detector ID | Confidence | Description |
|-------------|------------|-------------|
| `assembly` | High | Inline assembly used — error-prone and reduces readability |
| `assert-state-change` | High | `assert()` modifies state — assert should only check invariants |
| `boolean-equal` | High | Comparison to boolean literal (`if (x == true)` instead of `if (x)`) |
| `costly-loop` | Medium | State-modifying operation inside loop — gas cost scales with iterations |
| `cyclomatic-complexity` | High | Function cyclomatic complexity exceeds 11 — hard to audit |
| `dead-code` | Medium | Internal function never called — dead code |
| `deprecated-standards` | High | Deprecated Solidity feature used (`throw`, `sha3`, `suicide`, `constant` for functions) |
| `erc20-indexed` | High | ERC20 Transfer/Approval event parameters missing `indexed` keyword |
| `function-init-state` | High | State variable initialized via non-pure function call — fragile |
| `incorrect-using-for` | High | `using X for Y` where library X has no functions matching type Y |
| `low-level-calls` | High | Direct `.call()`, `.delegatecall()`, `.staticcall()` used |
| `missing-inheritance` | High | Contract implements interface functions but does not declare `is Interface` |
| `naming-convention` | High | Naming violates Solidity style guide (mixedCase, UPPER_CASE, etc.) |
| `pragma` | High | Multiple different pragma statements across source files |
| `redundant-statements` | High | Statement with no side effect (e.g., standalone expression) |
| `reentrancy-unlimited-gas` | Medium | Reentrancy via `.transfer()` or `.send()` (2300 gas may change) |
| `solc-version` | High | Outdated or floating pragma (`pragma solidity ^0.8.0` vs pinned) |
| `too-many-digits` | Medium | Number literal has many digits — use scientific notation for clarity |
| `unimplemented-functions` | High | Abstract function declared but never implemented |
| `unindexed-event-address` | High | Event has `address` parameter without `indexed` — harder to filter |
| `unused-state` | High | State variable declared but never read in any function |

## Optimization

| Detector ID | Confidence | Description |
|-------------|------------|-------------|
| `cache-array-length` | High | `array.length` evaluated on every loop iteration — cache in local variable |
| `constable-states` | High | State variable never written after declaration — should be `constant` |
| `external-function` | High | Public function never called internally — should be `external` (saves gas) |
| `immutable-states` | High | State variable written only in constructor — should be `immutable` |

## Detector Count by Severity

| Severity | Count |
|----------|-------|
| High | ~29 |
| Medium | ~28 |
| Low | ~17 |
| Informational | ~21 |
| Optimization | ~4 |
| **Total** | **~99** |

Exact count varies by Slither version. New detectors are added regularly.
