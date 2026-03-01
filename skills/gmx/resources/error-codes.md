# GMX V2 Error Codes and Revert Reasons

Common revert errors encountered when interacting with GMX V2 contracts. Errors are defined in `gmx-synthetics/contracts/error/Errors.sol`.

Last verified: February 2026

## Order Errors

### `InsufficientExecutionFee`

```
InsufficientExecutionFee(uint256 minExecutionFee, uint256 executionFee)
```

**Cause**: The execution fee provided is less than the minimum required to compensate keepers.

**Fix**: Query the minimum execution fee from the DataStore and add a buffer:

```typescript
// Read minimum execution fee from DataStore
const minFee = await publicClient.readContract({
  address: DATA_STORE,
  abi: [
    {
      name: "getUint",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "key", type: "bytes32" }],
      outputs: [{ name: "", type: "uint256" }],
    },
  ],
  functionName: "getUint",
  // keccak256("MIN_EXECUTION_FEE")
  args: ["0x3c65195a99bb22f9e5aa9ae64100c02029476acf480c60b29e2a78e3e4c6264a"],
});
```

### `EmptyOrder`

**Cause**: The order parameters are invalid — typically `sizeDeltaUsd` is 0 for position orders, or `initialCollateralToken` is zero address.

**Fix**: Ensure `sizeDeltaUsd > 0` for increase/decrease orders and that `initialCollateralToken` is a valid token address.

### `InvalidOrderType`

**Cause**: The `orderType` enum value does not correspond to a valid order type (0-7).

**Fix**: Use the correct enum: `MarketSwap=0, LimitSwap=1, MarketIncrease=2, LimitIncrease=3, MarketDecrease=4, LimitDecrease=5, StopLossDecrease=6, Liquidation=7`.

### `OrderNotFulfillableAtAcceptablePrice`

```
OrderNotFulfillableAtAcceptablePrice(uint256 price, uint256 acceptablePrice)
```

**Cause**: The execution price does not meet the `acceptablePrice` threshold. For longs, execution price exceeded the max; for shorts, it was below the min.

**Fix**: Set a more permissive `acceptablePrice` or wait for favorable market conditions.

### `InsufficientCollateralAmount`

**Cause**: The collateral deposited to the OrderVault is insufficient for the requested position size at the current leverage limits.

**Fix**: Increase collateral or decrease `sizeDeltaUsd`.

### `InsufficientCollateralUsd`

**Cause**: After fees (borrowing, funding, position fee), the remaining collateral is below the minimum required by the protocol.

**Fix**: Deposit more collateral or reduce position size.

## Position Errors

### `MaxLeverageExceeded`

```
MaxLeverageExceeded(uint256 leverage, uint256 maxLeverage)
```

**Cause**: The effective leverage (`sizeDeltaUsd / collateralUsd`) exceeds the market's maximum allowed leverage.

**Fix**: Reduce `sizeDeltaUsd` or increase collateral. Max leverage varies by market (typically 50x-100x).

### `MinLeverageNotMet`

**Cause**: The position's leverage is below the minimum (typically 1.1x).

**Fix**: Increase `sizeDeltaUsd` or decrease collateral.

### `InsufficientPoolAmount`

**Cause**: The pool does not have enough liquidity to support the requested position size.

**Fix**: Use a smaller position size or wait for more liquidity to enter the pool.

### `InsufficientReserve`

**Cause**: The market's reserve capacity (total open interest limit) has been reached.

**Fix**: Reduce position size or use a different market.

### `PositionNotFound`

**Cause**: Attempted to decrease or close a position that does not exist.

**Fix**: Verify the account, market, collateral token, and `isLong` flag match an existing position. Use `Reader.getAccountPositions()` to check.

### `EmptyPosition`

**Cause**: The position being modified has zero size.

**Fix**: Create a new position instead of modifying a non-existent one.

## Deposit/Withdrawal Errors

### `EmptyDeposit`

**Cause**: Neither `initialLongToken` nor `initialShortToken` has a non-zero amount deposited in the DepositVault.

**Fix**: Ensure tokens are sent to DepositVault via `sendWnt` or `sendTokens` before `createDeposit`.

### `EmptyWithdrawal`

**Cause**: No GM tokens were sent to the WithdrawalVault before calling `createWithdrawal`.

**Fix**: Send GM tokens to WithdrawalVault via `sendTokens` in the same multicall.

### `InsufficientMarketTokens`

**Cause**: The minted GM tokens would be less than `minMarketTokens` specified in the deposit params.

**Fix**: Reduce `minMarketTokens` (increase slippage tolerance) or wait for better pool conditions.

## Token/Transfer Errors

### `InsufficientWntAmount`

```
InsufficientWntAmount(uint256 wntAmount, uint256 msgValue)
```

**Cause**: The `msg.value` sent with the transaction does not match the amount specified in `sendWnt` calls.

**Fix**: Set `value` in the transaction to match the total ETH sent via `sendWnt`.

### `TokenTransferError`

**Cause**: An ERC-20 token transfer failed. Common reasons: insufficient balance, missing approval, or token is paused.

**Fix**: Check token balance and ensure approval is granted to the Router contract (not ExchangeRouter).

### `EmptyReceiver`

**Cause**: The `receiver` address is set to `address(0)`.

**Fix**: Set `receiver` to a valid address (typically `msg.sender`).

## Keeper/Execution Errors

### `RequestNotYetCancellable`

**Cause**: Attempted to cancel an order before the cancellation delay has passed.

**Fix**: Wait for the configured delay period before attempting cancellation.

### `OracleBlockNumbersAreSmallerThanRequired`

**Cause**: The oracle price data submitted by the keeper is stale.

**Fix**: This is a keeper issue, not a user issue. If your order is not executing, check GMX status page or governance for keeper issues.

### `MaxCallbackGasLimitExceeded`

**Cause**: The `callbackGasLimit` exceeds the protocol's maximum.

**Fix**: Reduce `callbackGasLimit` or set to 0 if no callback is needed.

## Common Transaction Failures

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `CALL_EXCEPTION` | Wrong contract address or ABI mismatch | Verify contract address and ABI against current deployment |
| `UNPREDICTABLE_GAS_LIMIT` | Simulation failure — collateral/fee issue | Check token balance, approval, and execution fee |
| Order created but never executed | Insufficient execution fee or keeper backlog | Increase execution fee; check GMX status |
| Order auto-cancelled | Price moved past `acceptablePrice` | Widen acceptable price range |
| `INSUFFICIENT_OUTPUT_AMOUNT` | `minOutputAmount` set too high for swap | Reduce `minOutputAmount` (increase slippage tolerance) |

## References

- [Errors.sol source](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/error/Errors.sol)
- [ErrorUtils.sol source](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/error/ErrorUtils.sol)
