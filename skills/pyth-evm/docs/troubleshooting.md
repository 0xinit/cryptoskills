# Pyth EVM Troubleshooting Guide

Common issues and solutions when integrating Pyth price feeds on EVM chains.

## StalePrice Revert (0x19abf40e)

**Symptoms:**
- Transaction reverts when calling `getPrice()` or `getPriceNoOlderThan()`
- Error selector `0x19abf40e`

**Solutions:**

1. **No update submitted.** Pyth is a pull oracle -- you must call `updatePriceFeeds` before reading. Fetch update data from Hermes and submit it in the same transaction:
   ```solidity
   uint256 fee = pyth.getUpdateFee(updateData);
   pyth.updatePriceFeeds{value: fee}(updateData);
   PythStructs.Price memory price = pyth.getPriceNoOlderThan(feedId, 60);
   ```

2. **maxAge too strict.** If using `getPriceNoOlderThan(id, maxAge)`, the price's `publishTime` must be within `maxAge` seconds of `block.timestamp`. Increase `maxAge` or ensure you are submitting a recent Hermes update.

3. **Hermes returned stale data.** If your backend caches Hermes responses, the cached update may be too old by the time the transaction lands. Fetch fresh data immediately before transaction submission.

## Wrong msg.value for Update Fee

**Symptoms:**
- Transaction reverts on `updatePriceFeeds` call
- `InsufficientFee` error

**Solutions:**

1. **Hardcoded fee.** Never hardcode `msg.value`. Always compute it dynamically:
   ```solidity
   uint256 fee = pyth.getUpdateFee(pythUpdateData);
   pyth.updatePriceFeeds{value: fee}(pythUpdateData);
   ```

2. **Insufficient ETH forwarded from caller.** If your contract accepts `pythUpdateData` from users, ensure `msg.value` covers the fee:
   ```solidity
   function updateAndAct(bytes[] calldata pythUpdateData) external payable {
       uint256 fee = pyth.getUpdateFee(pythUpdateData);
       pyth.updatePriceFeeds{value: fee}(pythUpdateData);
       // Refund excess
       if (msg.value > fee) {
           (bool ok, ) = msg.sender.call{value: msg.value - fee}("");
           require(ok);
       }
   }
   ```

## Confidence Interval Too Wide

**Symptoms:**
- Custom `ConfidenceTooWide` revert in your validation logic
- Prices appear correct but fail confidence checks

**Solutions:**

1. **Market volatility.** During high-volatility events, confidence intervals widen naturally. Consider using the EMA price (`getEmaPriceNoOlderThan`) which smooths spikes.

2. **Threshold too strict.** A 0.1% confidence ratio may reject legitimate prices during normal market hours. For most DeFi protocols, 1% (100 basis points) is appropriate. For perpetual DEXes, 0.5% (50 basis points).

3. **Low-liquidity asset.** Exotic pairs inherently have wider confidence intervals. Adjust thresholds per asset or use a tiered validation approach.

## Wrong Contract Address

**Symptoms:**
- Call to Pyth contract reverts with no data
- `cast code <address>` returns `0x`

**Solutions:**

Pyth addresses vary by chain. Common mistake: using the Ethereum address on Arbitrum.

| Chain Group | Address |
|-------------|---------|
| Ethereum, Avalanche | `0x4305FB66699C3B2702D4d05CF36551390A4c69C6` |
| Arbitrum, Optimism, Base, Polygon, Fantom | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` |
| BNB Chain | `0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594` |

Verify deployment before integrating:
```bash
cast code 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C --rpc-url $ARBITRUM_RPC
```

## Price Exponent Mishandled

**Symptoms:**
- Prices appear as extremely large or small numbers
- Collateral calculations are off by orders of magnitude

**Solutions:**

Pyth prices have a negative exponent (typically `-8`). The formula is: `humanPrice = price * 10^expo`.

```typescript
// Wrong -- ignoring exponent
const price = Number(pythPrice.price); // 6789000000000 -- NOT $67,890

// Correct -- applying exponent
const price = Number(pythPrice.price) * Math.pow(10, pythPrice.expo); // 67890.00
```

In Solidity, when comparing two prices or computing ratios, keep both in raw form (same exponent) to avoid precision loss.

## Hermes API Returns Empty Data

**Symptoms:**
- `binary.data` array is empty
- `parsed` array is empty or null

**Solutions:**

1. **Invalid feed ID.** Feed IDs must be the full `bytes32` hex string including `0x` prefix. Verify against https://pyth.network/developers/price-feed-ids.

2. **Rate limiting.** Hermes has rate limits. For production, run your own Hermes instance or use a paid endpoint.

3. **Network issues.** Try the backup endpoint or a different Hermes region.

## Debug Checklist

- [ ] Pyth contract address matches target chain (not a different chain's address)
- [ ] Feed ID is correct `bytes32` (same across all chains)
- [ ] `msg.value` computed via `getUpdateFee(updateData)`, not hardcoded
- [ ] Update and read happen in the same transaction (anti-sandwich)
- [ ] Price exponent applied correctly (`price * 10^expo`)
- [ ] Confidence interval validated before using price
- [ ] `getPriceNoOlderThan` used instead of `getPriceUnsafe` for standalone reads
- [ ] Hermes client fetching fresh data (not stale cache)
