# Fuzz Testing Patterns

Property-based fuzz testing with Foundry. Foundry generates random inputs for function parameters and runs your test hundreds or thousands of times looking for violations.

## Basic Property-Based Fuzz Test

Any test parameter that isn't provided by `setUp` becomes a fuzz input.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Vault} from "../src/Vault.sol";

contract VaultFuzzTest is Test {
    Vault vault;
    address alice;

    function setUp() public {
        vault = new Vault();
        alice = makeAddr("alice");
    }

    function test_fuzz_depositWithdrawRoundTrip(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);

        vm.deal(alice, amount);
        vm.startPrank(alice);

        vault.deposit{value: amount}();
        vault.withdraw(amount);

        vm.stopPrank();

        assertEq(vault.balanceOf(alice), 0, "balance should be zero after full withdrawal");
        assertEq(alice.balance, amount, "ETH should be returned in full");
    }
}
```

## Constraining Inputs with `bound()`

`bound()` maps any `uint256` into a valid range without discarding runs. Always prefer it over `vm.assume()` for continuous ranges.

```solidity
function test_fuzz_transferBetweenUsers(uint256 amount, uint256 actorSeed) public {
    amount = bound(amount, 1, 1000e18);
    address sender = actors[bound(actorSeed, 0, actors.length - 1)];

    deal(address(token), sender, amount);
    vm.prank(sender);
    token.transfer(address(vault), amount);

    assertEq(token.balanceOf(address(vault)), amount);
}
```

## Using `vm.assume()` for Preconditions

`vm.assume()` discards the current run if the condition is false. Use it only for discrete conditions that cannot be bounded. Too many rejections (default >65536) fails the entire campaign.

```solidity
function test_fuzz_cannotTransferToSelf(address from, address to, uint256 amount) public {
    // Discrete condition -- cannot be expressed with bound()
    vm.assume(from != to);
    vm.assume(from != address(0));
    vm.assume(to != address(0));

    amount = bound(amount, 1, 1000e18);

    deal(address(token), from, amount);
    vm.prank(from);
    token.transfer(to, amount);

    assertEq(token.balanceOf(to), amount);
}
```

## Structured Input Generation

For complex inputs, define a struct and let Foundry fuzz all fields.

```solidity
struct SwapParams {
    uint256 amountIn;
    uint256 reserveA;
    uint256 reserveB;
    bool zeroForOne;
}

function test_fuzz_swapPreservesK(SwapParams memory params) public {
    params.reserveA = bound(params.reserveA, 1e18, 1_000_000e18);
    params.reserveB = bound(params.reserveB, 1e18, 1_000_000e18);
    params.amountIn = bound(params.amountIn, 1e15, params.reserveA / 10);

    uint256 kBefore = params.reserveA * params.reserveB;

    uint256 amountOut = pool.swap(
        params.amountIn,
        params.zeroForOne ? address(tokenA) : address(tokenB)
    );

    uint256 kAfter = params.zeroForOne
        ? (params.reserveA + params.amountIn) * (params.reserveB - amountOut)
        : (params.reserveA - amountOut) * (params.reserveB + params.amountIn);

    assertGe(kAfter, kBefore, "constant product violated");
}
```

## Failure Replay with Seed

When a fuzz test fails, Foundry logs the seed. Replay it deterministically.

```bash
# Foundry output on failure:
# Failing tests:
# [FAIL. Reason: constant product violated]
#   Counterexample: calldata=0x..., args=[1234, 5678, true]
#   Seed: 0xabc123...

# Replay the exact failing seed
forge test --match-test test_fuzz_swapPreservesK --fuzz-seed 0xabc123
```

## Fuzz Configuration

```toml
# foundry.toml

[fuzz]
runs = 256                # runs per fuzz test (default)
max_test_rejects = 65536  # max vm.assume rejections before failure
seed = "0x1"              # deterministic seed for reproducibility
dictionary_weight = 40    # % of inputs from dictionary vs random

[profile.ci.fuzz]
runs = 10000              # more runs in CI for higher coverage

[profile.deep.fuzz]
runs = 100000             # deep fuzzing for critical code paths
```

## Common Property Patterns

### Commutativity

```solidity
function test_fuzz_additionIsCommutative(uint128 a, uint128 b) public pure {
    // uint128 to avoid overflow in addition
    assertEq(a + b, b + a);
}
```

### Monotonicity

```solidity
function test_fuzz_moreDepositMoreShares(uint256 a, uint256 b) public {
    a = bound(a, 1, 50 ether);
    b = bound(b, a + 1, 100 ether);

    uint256 sharesA = vault.previewDeposit(a);
    uint256 sharesB = vault.previewDeposit(b);

    assertGe(sharesB, sharesA, "more deposit should yield >= shares");
}
```

### Round-Trip (Encode/Decode)

```solidity
function test_fuzz_encodeDecodeRoundTrip(uint256 value, address addr, bytes32 slot) public pure {
    bytes memory encoded = abi.encode(value, addr, slot);
    (uint256 v, address a, bytes32 s) = abi.decode(encoded, (uint256, address, bytes32));

    assertEq(v, value);
    assertEq(a, addr);
    assertEq(s, slot);
}
```

### No Profit from Self-Interaction

```solidity
function test_fuzz_noArbitrageFromSelfSwap(uint256 amount) public {
    amount = bound(amount, 1e18, 100_000e18);

    deal(address(tokenA), alice, amount);
    vm.startPrank(alice);

    tokenA.approve(address(pool), amount);
    uint256 out = pool.swap(address(tokenA), address(tokenB), amount);

    tokenB.approve(address(pool), out);
    uint256 returned = pool.swap(address(tokenB), address(tokenA), out);

    vm.stopPrank();

    // After round-trip swap, should not profit (fees eat into it)
    assertLe(returned, amount, "round-trip swap should not yield profit");
}
```

## References

- [Foundry Book - Fuzz Testing](https://book.getfoundry.sh/forge/fuzz-testing)
- [Foundry Book - Fuzz Test Configuration](https://book.getfoundry.sh/reference/config/testing#fuzz)
