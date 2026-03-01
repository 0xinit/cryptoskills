# Hyperliquid Error Codes and Solutions

Common API errors with root causes and fixes.

Last verified: February 2026

## Order Errors

These appear in the `statuses` array of the exchange response.

### "Price must be divisible by tick size."

**Error type**: `Tick`

**Cause**: The order price does not align with the asset's tick size. Each perpetual has a specific price precision defined in the `meta` response.

**Fix**: Query `meta` to find the asset's `szDecimals` and price tick, then round your price:

```python
meta = info.meta()
asset = meta["universe"][asset_index]
# Round price to valid tick
tick_size = 10 ** -asset.get("szDecimals", 0)
```

### "Order must have minimum value of $10."

**Error type**: `MinTradeNtl`

**Cause**: Order notional (price * size) is below the $10 minimum for perpetual orders.

**Fix**: Increase size or use a price where `size * price >= 10`.

### "Order must have minimum value of 10 {quote_token}."

**Error type**: `MinTradeSpotNtl`

**Cause**: Spot order notional below minimum.

**Fix**: Same as perpetual — increase notional above 10 in the quote token.

### "Insufficient margin to place order."

**Error type**: `PerpMargin`

**Cause**: Account does not have enough USDC collateral for the order's margin requirement at the current leverage.

**Fix**:
1. Deposit more USDC
2. Close existing positions to free margin
3. Reduce order size
4. Increase leverage (higher leverage = less margin per order)

### "Reduce only order would increase position."

**Error type**: `ReduceOnly`

**Cause**: A `reduce_only=True` order would open or increase a position instead of reducing it.

**Fix**: Ensure the order side is opposite to your current position and the size does not exceed position size.

### "Post only order would have immediately matched, bbo was {bbo}."

**Error type**: `BadAloPx`

**Cause**: An ALO (Add-Liquidity-Only / post-only) order's price crosses the current best bid or offer, which would result in a taker fill.

**Fix**: Use a less aggressive price — buy below best bid, sell above best ask.

### "Order could not immediately match against any resting orders."

**Error type**: `IocCancel`

**Cause**: An IOC (Immediate-or-Cancel) order found no matching liquidity at or better than the limit price.

**Fix**: Use a more aggressive price, increase slippage, or switch to GTC.

### "Invalid TP/SL price."

**Error type**: `BadTriggerPx`

**Cause**: Trigger price is on the wrong side of the current oracle price. A take-profit trigger must be above entry for longs (below for shorts); stop-loss must be below entry for longs (above for shorts).

**Fix**: Verify trigger price direction matches position side.

### "No liquidity available for market order."

**Error type**: `MarketOrderNoLiquidity`

**Cause**: The order book is empty or all resting orders are outside the slippage tolerance.

**Fix**: Wait for liquidity or use a limit order instead.

### "Order would increase open interest while open interest is capped"

**Error type**: `PositionIncreaseAtOpenInterestCap` / `PositionFlipAtOpenInterestCap`

**Cause**: The asset has reached its maximum open interest limit. New position-increasing orders are blocked.

**Fix**: Wait for OI to decrease or trade an asset that is not at cap.

### "Order rejected due to price more aggressive than oracle while..."

**Error type**: `TooAggressiveAtOpenInterestCap`

**Cause**: Near OI cap, orders priced more aggressively than the oracle are rejected to prevent manipulation.

**Fix**: Price your order closer to or less aggressively than the oracle.

### "Order would increase open interest too quickly"

**Error type**: `OpenInterestIncrease`

**Cause**: Rate-of-change limit on open interest growth.

**Fix**: Reduce order size or wait before placing additional position-increasing orders.

### "Order has insufficient spot balance to trade"

**Error type**: `InsufficientSpotBalance`

**Cause**: Spot trading — not enough token balance to fill the sell order or enough USDC for the buy.

**Fix**: Deposit the required token or USDC.

### "Order price too far from oracle"

**Error type**: `Oracle`

**Cause**: Limit price deviates too far from the oracle price. Protects against fat-finger errors.

**Fix**: Use a price closer to the current oracle price.

### "Order would cause position to exceed margin tier limit..."

**Error type**: `PerpMaxPosition`

**Cause**: The resulting position would exceed the maximum size allowed for the current leverage tier.

**Fix**: Reduce leverage or reduce order size. Higher leverage has stricter position size limits.

## Cancel Errors

### "Order was never placed, already canceled, or filled."

**Error type**: `MissingOrder`

**Cause**: The OID or CLOID does not correspond to an active open order.

**Fix**: Check the order status via `orderStatus` info endpoint before canceling. The order may have been filled or already canceled.

## Authentication Errors

### "User or API Wallet 0x... does not exist"

**Cause**: One of:
1. Incorrect EIP-712 signature — the recovered signer address does not match any registered account
2. Using the wrong chain ID (1337 for L1 actions, 421614 for user-signed actions)
3. The account has never deposited USDC to Hyperliquid

**Fix**:
1. Verify chain ID in your signing code
2. Use the official SDK's signing methods instead of manual implementation
3. Ensure the account has been initialized with a USDC deposit

### "Must deposit before performing actions"

**Cause**: The wallet address has never deposited to Hyperliquid. All wallets must have at least one USDC deposit before placing orders.

**Fix**: Deposit USDC via the Arbitrum bridge at https://app.hyperliquid.xyz.

## Batch Errors

When placing batch orders, a pre-validation error on any single order rejects the **entire batch** with a single error response instead of per-order statuses.

**Fix**: Validate each order individually before batching. Common pre-validation failures: invalid asset index, malformed order type, missing required fields.

## Rate Limit Errors

### HTTP 429

**Cause**: Exceeded the per-address rate limit (base 1200 requests/minute).

**Fix**:
1. Check current usage via `userRateLimit` info endpoint
2. Batch orders instead of placing individually
3. Reduce polling frequency for info endpoints
4. Reserve additional capacity via `requestWeightReservation` (0.0005 USDC/request)
