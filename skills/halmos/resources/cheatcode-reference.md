# Halmos Cheatcode Reference

Halmos supports a subset of Foundry's cheatcodes plus its own symbolic variable constructors. This reference covers what works, what does not, and the differences from standard Foundry behavior.

> Last verified: February 2026

## Supported Foundry Cheatcodes

### Input Constraints

| Cheatcode | Description | Halmos Behavior |
|-----------|-------------|-----------------|
| `vm.assume(bool)` | Constrain symbolic inputs | Prunes paths where condition is false. Over-constraining can make tests vacuously true |

```solidity
function check_example(uint256 x) public {
    // Only consider x in range [1, 1000]
    vm.assume(x > 0);
    vm.assume(x <= 1000);

    // x is now symbolically constrained to [1, 1000]
    assert(x > 0 && x <= 1000);
}
```

### Caller Manipulation

| Cheatcode | Description | Halmos Behavior |
|-----------|-------------|-----------------|
| `vm.prank(address)` | Set `msg.sender` for next call | Works identically to Foundry |
| `vm.startPrank(address)` | Set `msg.sender` for subsequent calls | Works identically to Foundry |
| `vm.stopPrank()` | Reset `msg.sender` | Works identically to Foundry |
| `vm.prank(address, address)` | Set `msg.sender` and `tx.origin` | Works identically to Foundry |

```solidity
function check_access_control(address caller) public {
    vm.assume(caller != owner);

    vm.prank(caller);
    (bool success,) = address(target).call(
        abi.encodeCall(target.adminFunction, ())
    );
    // Non-owner calls must revert
    assert(!success);
}
```

### Balance and Storage Manipulation

| Cheatcode | Description | Halmos Behavior |
|-----------|-------------|-----------------|
| `vm.deal(address, uint256)` | Set ETH balance | Works — sets balance in symbolic state |
| `vm.store(address, bytes32, bytes32)` | Write to storage slot | Works — useful for setting up symbolic initial state |
| `vm.load(address, bytes32)` | Read from storage slot | Works — returns symbolic value if slot is symbolic |
| `deal(address, address, uint256)` | Set ERC-20 balance (forge-std) | Works for standard ERC-20 storage layouts |

```solidity
function check_with_eth_balance(uint256 amount) public {
    vm.assume(amount > 0);
    vm.assume(amount <= 100 ether);

    vm.deal(alice, amount);
    assert(alice.balance == amount);
}
```

### Assertions and Expectations

| Cheatcode | Description | Halmos Behavior |
|-----------|-------------|-----------------|
| `assert(bool)` | Raw assertion | **PRIMARY** — Halmos checks this symbolically |
| `vm.expectRevert()` | Expect next call to revert | Supported — verifies revert occurs |
| `vm.expectRevert(bytes)` | Expect specific revert data | Supported — matches revert selector |
| `vm.expectEmit(bool,bool,bool,bool)` | Expect event emission | Limited support — may not match all indexed topics symbolically |

**Important**: Use `assert()` for symbolic properties. `assertEq`, `assertGt`, etc. from forge-std revert on failure — Halmos treats reverts as valid execution paths (the transaction just reverts, no property violation detected) unless `--error-unknown` is set.

### Time and Block Manipulation

| Cheatcode | Description | Halmos Behavior |
|-----------|-------------|-----------------|
| `vm.warp(uint256)` | Set `block.timestamp` | Works |
| `vm.roll(uint256)` | Set `block.number` | Works |
| `vm.fee(uint256)` | Set `block.basefee` | Works |
| `vm.chainId(uint256)` | Set `block.chainid` | Works |

```solidity
function check_timelock(uint256 delay) public {
    vm.assume(delay >= 1 days);
    vm.assume(delay <= 30 days);

    vm.warp(block.timestamp + delay);
    // Test time-dependent logic
}
```

### Labels and Debugging

| Cheatcode | Description | Halmos Behavior |
|-----------|-------------|-----------------|
| `vm.label(address, string)` | Label address in traces | Supported for readability |
| `console.log(...)` | Log output | Limited support — may not print during symbolic execution |

## Unsupported Foundry Cheatcodes

These cheatcodes are NOT supported or have limited support in Halmos:

| Cheatcode | Reason |
|-----------|--------|
| `vm.createSelectFork(...)` | No fork mode — cannot access live chain state symbolically |
| `vm.createFork(...)` | No fork mode |
| `vm.ffi(string[])` | Arbitrary external calls cannot be made symbolic |
| `vm.readFile(string)` | File I/O not available during symbolic execution |
| `vm.writeFile(string, string)` | File I/O not available |
| `vm.envUint(string)` | Environment variable access not supported symbolically |
| `vm.broadcast()` | Deployment cheatcode — not relevant for symbolic testing |
| `vm.startBroadcast()` | Deployment cheatcode |
| `vm.snapshot()` | State snapshots not supported |
| `vm.revertTo(uint256)` | State snapshot revert not supported |
| `vm.record()` | Storage access recording not supported |
| `vm.accesses(address)` | Storage access recording not supported |
| `vm.recordLogs()` | Log recording — limited support |
| `vm.getRecordedLogs()` | Log recording — limited support |
| `vm.sign(uint256, bytes32)` | Cryptographic signing — returns concrete result for concrete inputs only |

## Halmos-Specific Cheatcodes (halmos-cheatcodes)

Install: `forge install a16z/halmos-cheatcodes`

Import: `import {SymTest} from "halmos-cheatcodes/SymTest.sol";`

### Symbolic Variable Constructors

These create fresh symbolic variables not tied to function parameters:

| Function | Description |
|----------|-------------|
| `svm.createUint256(string label)` | Create symbolic uint256 |
| `svm.createUint(uint256 bits, string label)` | Create symbolic uint of N bits (8, 16, 32, ..., 256) |
| `svm.createInt256(string label)` | Create symbolic int256 |
| `svm.createInt(uint256 bits, string label)` | Create symbolic int of N bits |
| `svm.createAddress(string label)` | Create symbolic address |
| `svm.createBytes32(string label)` | Create symbolic bytes32 |
| `svm.createBytes(uint256 length, string label)` | Create symbolic bytes of fixed length |
| `svm.createBool(string label)` | Create symbolic boolean |
| `svm.createBytes4(string label)` | Create symbolic bytes4 (useful for function selectors) |

```solidity
import {SymTest} from "halmos-cheatcodes/SymTest.sol";

contract MySymTest is SymTest, Test {
    function check_with_symbolic_state() public {
        // Create symbolic values not tied to function params
        uint256 balance = svm.createUint256("balance");
        address user = svm.createAddress("user");

        vm.assume(user != address(0));
        vm.assume(balance > 0);
        vm.assume(balance <= 1e30);

        // Set up contract state with symbolic values
        vm.store(
            address(token),
            keccak256(abi.encode(user, uint256(0))), // balanceOf slot
            bytes32(balance)
        );

        // Now test properties over this symbolic state
        assert(token.balanceOf(user) == balance);
    }
}
```

### When to Use svm vs Function Parameters

| Approach | Use When |
|----------|----------|
| Function parameters | Testing a single function with symbolic inputs |
| `svm.create*` | Testing properties over symbolic contract STATE (not just inputs) |
| Both | Complex scenarios: symbolic state + symbolic function inputs |

```solidity
// Function params: symbolic inputs to the function under test
function check_transfer(address to, uint256 amount) public { ... }

// svm: symbolic initial state that the test sets up
function check_invariant_any_state() public {
    uint256 totalAssets = svm.createUint256("totalAssets");
    uint256 totalShares = svm.createUint256("totalShares");
    // ... set up contract state, then test properties
}
```

## Cheatcode Interaction Patterns

### Pattern: Test Access Control Exhaustively

```solidity
function check_only_owner_can_pause(address caller) public {
    vm.assume(caller != vault.owner());

    vm.prank(caller);
    (bool success,) = address(vault).call(
        abi.encodeCall(vault.pause, ())
    );

    // ANY non-owner caller must fail
    assert(!success);
}
```

### Pattern: Symbolic Storage + Symbolic Input

```solidity
function check_withdraw_bounded_by_balance() public {
    uint256 balance = svm.createUint256("balance");
    address user = svm.createAddress("user");
    uint256 withdrawAmount = svm.createUint256("withdrawAmount");

    vm.assume(user != address(0));
    vm.assume(balance > 0);
    vm.assume(withdrawAmount > balance);

    // Set up state
    vm.store(address(vault), keccak256(abi.encode(user, uint256(2))), bytes32(balance));

    // Attempt over-withdrawal
    vm.prank(user);
    (bool success,) = address(vault).call(
        abi.encodeCall(vault.withdraw, (withdrawAmount))
    );

    // Must revert
    assert(!success);
}
```

### Pattern: Time-Dependent Properties

```solidity
function check_timelock_enforced(uint256 elapsed) public {
    vm.assume(elapsed < TIMELOCK_DURATION);

    vm.warp(block.timestamp + elapsed);

    vm.prank(admin);
    (bool success,) = address(timelock).call(
        abi.encodeCall(timelock.execute, (proposalId))
    );

    // Cannot execute before timelock expires
    assert(!success);
}
```
