# Pendle Error Codes and Revert Reasons

Common revert reasons encountered when interacting with Pendle v2 contracts.

## Router Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `RouterInsufficientPtOut()` | PT received is below the `minPtOut` parameter | Increase slippage tolerance or re-quote with current market state before executing |
| `RouterInsufficientSyOut()` | SY received is below the `minSyOut` parameter | Widen slippage. Underlying rate may have changed between quote and execution |
| `RouterInsufficientYtOut()` | YT received is below the `minYtOut` parameter | Re-quote. YT pricing is volatile, especially near maturity |
| `RouterInsufficientLpOut()` | LP tokens received below the `minLpOut` parameter | Recompute expected LP output with current reserve state |
| `RouterInsufficientTokenOut()` | Output token amount below the `minTokenOut` parameter | Widen slippage or re-quote. May indicate large price movement |
| `RouterExceededLimitPtIn()` | PT input exceeded the maximum allowed | Reduce the PT amount or split into multiple transactions |
| `RouterExceededLimitSyIn()` | SY input exceeded the maximum allowed | Reduce SY input amount |

## Approximation (Binary Search) Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ApproxFail()` | Binary search for optimal swap amount did not converge within `maxIteration` | Widen `guessMin`/`guessMax` range, increase `maxIteration` (default 256 is usually sufficient), or decrease `eps` precision |
| `ApproxParamsInvalid()` | `guessMin >= guessMax` or `eps` is zero | Ensure `guessMin < guessMax` and `eps > 0`. Typical eps: `1e15` (0.1%) |
| `ApproxBinarySearchInputInvalid()` | Search bounds do not contain a valid solution | The guess range is wrong. Set `guessMin = 0` and `guessMax` to a generous upper bound (e.g., 2x expected output) |

## Market Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `MarketExpired()` | Trading on a market past its maturity date | Check `market.expiry()` before trading. Use redeem functions instead of swaps post-maturity |
| `MarketZeroAmountsInput()` | Zero-value input passed to market function | Ensure all input amounts are > 0 |
| `MarketZeroAmountsOutput()` | Trade would produce zero output | Input amount may be too small for the pool's precision. Increase trade size |
| `MarketInsufficientPtForTrade()` | Not enough PT reserves in the pool for this trade | Reduce trade size or split across multiple transactions |
| `MarketProportionTooHigh()` | Single trade would move the pool too far from balance | Trade exceeds max proportion limit (~95% of reserves). Split into smaller trades |
| `MarketRateScalarBelowZero()` | Internal market math error during curve calculation | Market is in an extreme state. Usually happens when pool is nearly empty or at extreme ratios |
| `MarketExchangeRateBelowOne()` | PT exchange rate calculation resulted in value < 1 | Internal issue. May indicate a bug or extreme market conditions. Do not trade |

## SY (Standardized Yield) Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `SYInvalidTokenIn()` | Token passed is not a valid deposit token for this SY | Call `SY.getTokensIn()` to get the list of valid input tokens |
| `SYInvalidTokenOut()` | Token passed is not a valid withdrawal token for this SY | Call `SY.getTokensOut()` to get the list of valid output tokens |
| `SYZeroDeposit()` | Attempted to deposit zero tokens into SY | Ensure deposit amount > 0 |
| `SYZeroRedeem()` | Attempted to redeem zero SY tokens | Ensure redeem amount > 0 |
| `SYInsufficientSharesOut()` | Shares received from deposit below minimum | Underlying protocol (e.g., Lido, EtherFi) may have a deposit limit or rounding issue |

## Oracle Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `OracleNotReady()` | Oracle cardinality not initialized or observation window not filled | Call `market.increaseObservationsCardinalityNext()` and wait for enough blocks to fill the observation window |
| `OracleZeroDuration()` | TWAP duration parameter is zero | Pass a non-zero duration (e.g., 900 for 15-minute TWAP) |
| `OracleCardinalityTooLow()` | Not enough observation slots for the requested TWAP duration | Increase cardinality with `increaseObservationsCardinalityNext()` |

## Token / ERC-20 Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `InsufficientBalance()` | Sender does not have enough tokens | Check `balanceOf()` before transaction |
| `InsufficientAllowance()` | Router not approved to spend tokens | Call `approve(router, amount)` on the token contract before interacting with Router |
| Generic transfer revert | Fee-on-transfer token or token with hooks blocking transfer | Pendle SY adapters handle most cases, but exotic tokens may not be compatible |

## Debugging Tips

1. **Always simulate first.** Use `publicClient.simulateContract()` to catch reverts before broadcasting:
   ```typescript
   try {
     const { request } = await publicClient.simulateContract({ ... });
   } catch (error) {
     console.error("Revert reason:", error.message);
   }
   ```

2. **Trace failed transactions:**
   ```bash
   cast run <tx_hash> --rpc-url $RPC_URL
   ```

3. **Check market expiry before any trade:**
   ```typescript
   const expiry = await publicClient.readContract({
     address: market,
     abi: parseAbi(["function expiry() view returns (uint256)"]),
     functionName: "expiry",
   });
   if (BigInt(Math.floor(Date.now() / 1000)) > expiry) {
     throw new Error("Market is expired — use redeem functions instead");
   }
   ```

4. **Verify SY token compatibility:**
   ```typescript
   const tokensIn = await publicClient.readContract({
     address: syAddress,
     abi: parseAbi(["function getTokensIn() view returns (address[])"]),
     functionName: "getTokensIn",
   });
   if (!tokensIn.includes(yourToken)) {
     throw new Error(`Token ${yourToken} is not a valid input for this SY`);
   }
   ```
