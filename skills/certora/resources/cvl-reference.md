# CVL Language Reference

Quick reference for Certora Verification Language (CVL) types, operators, built-in functions, and special variables.

## Types

### Primitive Types

| Type | Description | Example |
|------|-------------|---------|
| `uint256` | 256-bit unsigned integer (matches Solidity) | `uint256 x = 42;` |
| `int256` | 256-bit signed integer | `int256 y = -1;` |
| `address` | 20-byte Ethereum address | `address a = 0;` |
| `bool` | Boolean | `bool b = true;` |
| `bytes32` | 32-byte fixed-size byte array | `bytes32 h;` |
| `string` | String (limited support) | Used mainly in assertions |
| `mathint` | Unbounded mathematical integer — no overflow | `mathint sum = x + y;` |

### Special Types

| Type | Description | Usage |
|------|-------------|-------|
| `env` | Transaction context (msg.sender, msg.value, block.timestamp) | `env e;` |
| `calldataarg` | Arbitrary calldata for parametric rules | `calldataarg args;` |
| `method` | Contract function reference for parametric rules | `method f;` |

### `mathint` Details

`mathint` is the recommended type for spec-side arithmetic. It has no overflow or underflow — values are true mathematical integers.

```cvl
rule noOverflow(uint256 a, uint256 b) {
    // mathint computation cannot overflow
    mathint sum = to_mathint(a) + to_mathint(b);

    // convert back to uint256 only when comparing to contract values
    assert to_mathint(someContractFunction()) == sum;
}
```

**Conversions:**
- `to_mathint(uint256)` — converts uint256 to mathint
- `require_uint256(mathint)` — converts mathint to uint256 (adds implicit require that value fits)
- `assert_uint256(mathint)` — converts mathint to uint256 (asserts that value fits)

### `env` Fields

```cvl
env e;

e.msg.sender    // address — caller
e.msg.value     // uint256 — ETH sent
e.block.number  // uint256 — block number
e.block.timestamp // uint256 — block timestamp
```

### `method` Fields

```cvl
method f;

f.selector      // bytes4 — function selector
f.isView        // bool — is it a view/pure function
f.isFallback    // bool — is it the fallback function
```

## Operators

### Arithmetic

| Operator | Description | Notes |
|----------|-------------|-------|
| `+` | Addition | On mathint: unbounded. On uint256: wraps like Solidity |
| `-` | Subtraction | Same overflow behavior as type |
| `*` | Multiplication | |
| `/` | Division | Integer division, rounds toward zero |
| `%` | Modulo | |

### Comparison

| Operator | Description |
|----------|-------------|
| `==` | Equal |
| `!=` | Not equal |
| `<` | Less than |
| `<=` | Less than or equal |
| `>` | Greater than |
| `>=` | Greater than or equal |

### Logical

| Operator | Description |
|----------|-------------|
| `&&` | Logical AND |
| `\|\|` | Logical OR |
| `!` | Logical NOT |
| `=>` | Implication (if A then B) |
| `<=>` | If and only if (biconditional) |

### Implication (`=>`)

The implication operator is heavily used in Certora specs. `A => B` means "if A is true, then B must be true." If A is false, the entire expression is true regardless of B.

```cvl
// "If balance changed, then sender must be the token owner"
assert balanceOf(user) != balanceBefore =>
    e.msg.sender == owner();
```

### Bitwise

| Operator | Description |
|----------|-------------|
| `&` | Bitwise AND |
| `\|` | Bitwise OR |
| `^` | Bitwise XOR |
| `~` | Bitwise NOT |
| `<<` | Left shift |
| `>>` | Right shift |

## Built-in Functions and Variables

### Constants

| Name | Value |
|------|-------|
| `max_uint256` | 2^256 - 1 |
| `max_uint128` | 2^128 - 1 |
| `max_uint64` | 2^64 - 1 |
| `max_uint32` | 2^32 - 1 |
| `max_uint8` | 2^8 - 1 |
| `max_int256` | 2^255 - 1 |
| `min_int256` | -2^255 |

### Special Variables

| Variable | Type | Description |
|----------|------|-------------|
| `currentContract` | `address` | Address of the contract being verified |
| `lastReverted` | `bool` | True if the last `@withrevert` call reverted |
| `lastHasThrown` | `bool` | Deprecated alias for `lastReverted` |
| `nativeBalances[addr]` | `uint256` | ETH balance of an address |

### Type Casting

```cvl
// uint256 to mathint
mathint m = to_mathint(someUint);

// mathint to uint256 (adds require that value is in range)
uint256 u = require_uint256(someMathint);

// mathint to uint256 (adds assert that value is in range)
uint256 u = assert_uint256(someMathint);

// mathint to other uint types
uint128 u = require_uint128(someMathint);
uint64 u = require_uint64(someMathint);
```

## Declarations

### Methods Block

```cvl
methods {
    // envfree: function does not depend on env (msg.sender, msg.value, etc.)
    function balanceOf(address) external returns (uint256) envfree;

    // Without envfree: must pass env when calling
    function transfer(address, uint256) external returns (bool);

    // External contract functions (using declaration required)
    function otherContract.someFunction(uint256) external returns (bool) envfree;

    // Wildcard for unknown callees — DISPATCHER considers all implementations
    function _.transfer(address, uint256) external => DISPATCHER(true);

    // NONDET — assume any return value (sound abstraction)
    function _.balanceOf(address) external => NONDET;

    // ALWAYS(x) — always returns x
    function _.decimals() external returns (uint8) => ALWAYS(18);

    // PER_CALLEE_CONSTANT — returns same value per callee address
    function _.name() external returns (string) => PER_CALLEE_CONSTANT;
}
```

### Rules

```cvl
// Basic rule
rule myRule(uint256 param) {
    env e;
    // ... assertions ...
}

// Parametric rule — runs for every non-view function
rule myParametricRule(method f) {
    env e;
    calldataarg args;
    f(e, args);
    // ... assertions ...
}

// Filtered parametric rule
rule myFilteredRule(method f) filtered {
    f -> !f.isView && f.selector != sig:someFunction(uint256).selector
} {
    // ... body ...
}
```

### Invariants

```cvl
// Basic invariant
invariant myInvariant()
    someCondition()

// With preserved block
invariant myInvariant()
    someCondition()
    {
        preserved with (env e) {
            requireInvariant myInvariant();
            require e.msg.value == 0;
        }
        // Per-function preserved
        preserved specificFunction(uint256 arg) with (env e) {
            requireInvariant myInvariant();
        }
    }
```

### Ghost Variables

```cvl
// Simple ghost
ghost uint256 myGhost {
    init_state axiom myGhost == 0;
}

// Ghost mapping
ghost mapping(address => uint256) ghostBalances {
    init_state axiom forall address a. ghostBalances[a] == 0;
}

// Ghost with mathint (recommended for sums)
ghost mathint totalTracked {
    init_state axiom totalTracked == 0;
}
```

### Hooks

```cvl
// Storage store hook — fires when a storage slot is written
hook Sstore myMapping[KEY address user] uint256 newValue (uint256 oldValue) {
    ghostSum = ghostSum + newValue - oldValue;
}

// Storage load hook — fires when a storage slot is read
hook Sload uint256 value myMapping[KEY address user] {
    require to_mathint(value) <= ghostSum;
}
```

### Using Declarations

```cvl
// Reference another contract deployed alongside the main contract
using Token as token;
using OtherContract as other;
```

## Function Call Syntax

```cvl
// Regular call — reverts propagate and fail the rule
transfer(e, to, amount);

// @withrevert — captures revert in lastReverted instead of failing
transfer@withrevert(e, to, amount);
assert lastReverted;

// envfree function — no env needed
uint256 bal = balanceOf(user);

// Calling on a specific contract (with using declaration)
uint256 tokenBal = token.balanceOf(user);
```

## Function Selectors

```cvl
// Reference a function by its selector
sig:transfer(address,uint256).selector    // bytes4

// Use in filters
rule myRule(method f) filtered {
    f -> f.selector != sig:transfer(address,uint256).selector
} {
    // ...
}
```

## Quantifiers

```cvl
// forall in ghost axioms
ghost mapping(address => uint256) balances {
    init_state axiom forall address a. balances[a] == 0;
}
```

## Common Patterns

### Require vs Assert

```cvl
// require: constrain the prover's search space (precondition)
require amount > 0;
require e.msg.sender != address(0);

// assert: state what must be true (postcondition)
assert balanceOf(user) >= 0;
```

### requireInvariant

```cvl
// In a preserved block, assume invariant holds at start of inductive step
preserved with (env e) {
    requireInvariant myInvariant();
}

// In a rule, assume invariant holds (useful for composing properties)
rule myRule() {
    requireInvariant otherInvariant();
    // ... can now assume otherInvariant holds ...
}
```

### satisfy vs assert

```cvl
// assert: must hold for ALL executions (universal)
assert balanceOf(user) >= 0;

// satisfy: must hold for at LEAST ONE execution (existential / reachability)
satisfy balanceOf(user) > 100;
```

Last verified: February 2026
