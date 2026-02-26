# Test Assertion Reference

Assertion patterns for Foundry (Solidity) and Hardhat (Chai/TypeScript).

## Foundry Assertions

All assertions are inherited from `forge-std/Test.sol`. Each accepts an optional trailing `string` parameter for a custom failure message.

### Equality and Comparison

```solidity
assertEq(a, b);                    // a == b (uint256, int256, address, bytes32, string, bool)
assertEq(a, b, "values must match");

assertNotEq(a, b);                 // a != b

assertGt(a, b);                    // a > b
assertGe(a, b);                    // a >= b
assertLt(a, b);                    // a < b
assertLe(a, b);                    // a <= b

assertTrue(condition);             // condition is true
assertFalse(condition);            // condition is false
```

### Approximate Equality

For DeFi math where rounding errors and fee dust are expected.

```solidity
// Absolute tolerance: |a - b| <= maxDelta
assertApproxEqAbs(actual, expected, maxDelta);
assertApproxEqAbs(shares, expectedShares, 1, "rounding error > 1 wei");

// Relative tolerance: |a - b| / b <= maxPercentDelta (in WAD, 1e18 = 100%)
assertApproxEqRel(actual, expected, 0.01e18); // within 1%
assertApproxEqRel(oraclePrice, spotPrice, 0.005e18, "oracle drift > 0.5%");
```

### Array Assertions

```solidity
assertEq(arrayA, arrayB);              // element-wise equality for uint256[], int256[], address[]
assertEq(bytesA, bytesB);              // bytes equality
assertEq(stringA, stringB);            // string equality
```

## Hardhat/Chai Assertions

Chai matchers from `@nomicfoundation/hardhat-chai-matchers`.

### Value Assertions

```typescript
expect(await token.name()).to.equal("Token");
expect(await token.totalSupply()).to.equal(ethers.parseEther("1000000"));

expect(balance).to.be.gt(0n);           // greater than
expect(balance).to.be.gte(minBalance);   // greater than or equal
expect(balance).to.be.lt(maxBalance);    // less than
expect(balance).to.be.lte(cap);          // less than or equal

expect(await token.paused()).to.be.true;
expect(await token.paused()).to.be.false;
```

### Revert Assertions

```typescript
await expect(tx).to.be.reverted;
await expect(tx).to.be.revertedWith("error message");
await expect(tx).to.be.revertedWithCustomError(contract, "ErrorName");
await expect(tx).to.be.revertedWithCustomError(contract, "ErrorName")
  .withArgs(arg1, arg2);
await expect(tx).to.be.revertedWithPanic(0x11);   // arithmetic overflow
await expect(tx).to.not.be.reverted;
```

### Event Assertions

```typescript
await expect(tx).to.emit(contract, "EventName");
await expect(tx).to.emit(contract, "EventName").withArgs(arg1, arg2);
await expect(tx).to.emit(contract, "Transfer")
  .withArgs(from, to, anyValue);   // anyValue matches any argument
```

### Balance Change Assertions

```typescript
await expect(tx).to.changeEtherBalance(account, delta);
await expect(tx).to.changeEtherBalances([a, b], [deltaA, deltaB]);
await expect(tx).to.changeTokenBalance(token, account, delta);
await expect(tx).to.changeTokenBalances(token, [a, b], [deltaA, deltaB]);
```

## Custom Assertion Patterns for DeFi

### Within Epsilon (Foundry)

For share/asset conversions where rounding is expected.

```solidity
function assertWithinEpsilon(uint256 actual, uint256 expected, uint256 epsilonBps) internal pure {
    if (expected == 0) {
        assertEq(actual, 0);
        return;
    }
    uint256 diff = actual > expected ? actual - expected : expected - actual;
    // epsilonBps is in basis points (1 = 0.01%)
    assertLe(diff * 10_000 / expected, epsilonBps, "exceeds epsilon tolerance");
}

// Usage: allow 0.01% rounding tolerance
assertWithinEpsilon(vault.previewRedeem(shares), expectedAssets, 1);
```

### Monotonic Property (Foundry)

Assert a value only ever increases (or decreases) across operations.

```solidity
uint256 previousCumulativeFees;

function assertMonotonicallyIncreasing(uint256 current, string memory label) internal {
    assertGe(current, previousCumulativeFees, string.concat(label, " decreased"));
    previousCumulativeFees = current;
}
```

### Bounded Output (Foundry)

Assert outputs stay within expected bounds -- useful for AMM price impact, oracle deviation, and interest rate models.

```solidity
function assertBounded(uint256 value, uint256 lower, uint256 upper, string memory label) internal pure {
    assertGe(value, lower, string.concat(label, " below lower bound"));
    assertLe(value, upper, string.concat(label, " above upper bound"));
}

// Usage: price impact should be between 0 and 3%
uint256 priceImpactBps = pool.getPriceImpact(amountIn);
assertBounded(priceImpactBps, 0, 300, "price impact");
```

### Gas Assertion (Foundry)

Assert a function stays within gas budget.

```solidity
function test_transferGasBudget() public {
    uint256 gasBefore = gasleft();
    token.transfer(bob, 100e18);
    uint256 gasUsed = gasBefore - gasleft();

    // Transfer should cost less than 65k gas
    assertLt(gasUsed, 65_000, "transfer exceeds gas budget");
}
```

## References

- [Foundry Book - Test Assertions](https://book.getfoundry.sh/reference/forge-std/assertEq)
- [Hardhat Chai Matchers](https://hardhat.org/hardhat-chai-matchers/docs/overview)
