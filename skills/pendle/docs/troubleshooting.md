# Pendle Troubleshooting Guide

Common issues and solutions when integrating Pendle v2.

## Transaction Reverts with ApproxFail

**Symptoms:**
- Transaction reverts with `ApproxFail()` error
- Simulation passes but on-chain execution fails

**Solutions:**

1. **Widen the guess range.** The Router uses binary search to find the optimal output. If `guessMin`/`guessMax` are too tight, the search fails:
   ```typescript
   const guessPtOut = {
     guessMin: 0n,
     guessMax: expectedPtOut * 3n, // generous upper bound
     guessOffchain: 0n,
     maxIteration: 256n,
     eps: 1_000_000_000_000_000n, // 1e15 = 0.1% precision
   };
   ```

2. **Use `guessOffchain` for gas savings.** If you have a good estimate of the output (from the SDK or RouterStatic preview), pass it as `guessOffchain`. The binary search uses it as the starting point:
   ```typescript
   const { netPtOut: preview } = await previewBuyPt(WETH, wethAmount);
   const guessPtOut = {
     guessMin: 0n,
     guessMax: preview * 2n,
     guessOffchain: preview, // starts search here instead of midpoint
     maxIteration: 256n,
     eps: 1_000_000_000_000_000n,
   };
   ```

3. **Increase `maxIteration`.** Default 256 is sufficient for most cases. If the pool is in an extreme state (near maturity, thin liquidity), try 512.

4. **Market conditions changed between simulation and execution.** Re-simulate immediately before broadcasting.

## Insufficient Output Errors

**Symptoms:**
- `RouterInsufficientPtOut()`, `RouterInsufficientYtOut()`, `RouterInsufficientSyOut()`
- Simulation succeeds but execution reverts

**Solutions:**

1. **Price moved between preview and execution.** Widen slippage:
   ```typescript
   // 1% slippage for Pendle (higher than standard DEX due to binary search + yield curve)
   const slippageBps = 100n;
   const minPtOut = expectedPtOut - (expectedPtOut * slippageBps) / 10000n;
   ```

2. **Near-maturity markets are more volatile.** As expiry approaches, the AMM curve compresses and small trades can cause larger price movements. Use 2-3% slippage for markets within 7 days of maturity.

3. **Large trades relative to pool reserves.** If your trade is > 5% of the pool's PT or SY reserves, expect higher slippage. Split into smaller trades.

4. **Use Flashbots Protect on mainnet.** MEV bots can front-run Pendle swaps:
   ```typescript
   const walletClient = createWalletClient({
     account,
     chain: mainnet,
     transport: http("https://rpc.flashbots.net"),
   });
   ```

## Market Expired Errors

**Symptoms:**
- `MarketExpired()` revert when calling swap or LP functions
- AMM operations fail after a certain date

**Solutions:**

1. **Check expiry before any market operation:**
   ```typescript
   const expiry = await publicClient.readContract({
     address: market,
     abi: parseAbi(["function expiry() view returns (uint256)"]),
     functionName: "expiry",
   });

   const now = BigInt(Math.floor(Date.now() / 1000));
   if (now > expiry) {
     // Market is expired -- use redeem functions only
   }
   ```

2. **Post-maturity actions available:**
   - Redeem PT via `redeemPyToToken` or `redeemPyToSy` (1:1 for underlying)
   - Claim accrued YT yield via `redeemDueInterestAndRewards`
   - Remove LP positions via `removeLiquiditySingleToken`

3. **Find the new active market for the same underlying.** Query the Pendle API:
   ```bash
   curl "https://api-v2.pendle.finance/core/v1/1/markets?order_by=tvl&order=desc"
   ```

## Approval Issues

**Symptoms:**
- Reverts with ERC-20 allowance errors
- `InsufficientAllowance` or `TransferFrom failed`

**Solutions:**

1. **Approve the Router, not the market.** All approvals go to PendleRouter:
   ```typescript
   const PENDLE_ROUTER = "0x888888888889758F76e7103c6CbF23ABbF58F946" as const;

   // Approve SY, PT, YT, and LP tokens to Router
   for (const token of [syAddress, ptAddress, ytAddress, marketAddress]) {
     await walletClient.writeContract({
       address: token,
       abi: parseAbi(["function approve(address, uint256) returns (bool)"]),
       functionName: "approve",
       args: [PENDLE_ROUTER, 2n ** 256n - 1n],
     });
   }
   ```

2. **For native ETH, no approval needed.** Pass `value` in the transaction. Use `address(0)` as `tokenIn`:
   ```typescript
   const tokenInput = {
     tokenIn: "0x0000000000000000000000000000000000000000" as const,
     netTokenIn: ethAmount,
     tokenMintSy: "0x0000000000000000000000000000000000000000" as const,
     // ...
   };
   ```

3. **Check existing allowance before approving:**
   ```typescript
   const allowance = await publicClient.readContract({
     address: token,
     abi: parseAbi(["function allowance(address,address) view returns (uint256)"]),
     functionName: "allowance",
     args: [account.address, PENDLE_ROUTER],
   });
   ```

## Oracle Not Ready

**Symptoms:**
- `OracleNotReady()` when calling `getPtToAssetRate`
- TWAP returns stale or incorrect data

**Solutions:**

1. **Initialize oracle cardinality on the market:**
   ```typescript
   const { request } = await publicClient.simulateContract({
     address: marketAddress,
     abi: parseAbi([
       "function increaseObservationsCardinalityNext(uint16) external",
     ]),
     functionName: "increaseObservationsCardinalityNext",
     args: [100], // 100 observation slots
     account: account.address,
   });

   await walletClient.writeContract(request);
   ```

2. **Wait for the observation window to fill.** After increasing cardinality, the oracle needs enough blocks with trades to build a TWAP history. For a 15-minute TWAP, wait at least 15 minutes after the cardinality increase with some trading activity on the market.

3. **Verify oracle readiness before reading:**
   ```typescript
   const oracleState = await publicClient.readContract({
     address: PENDLE_PT_ORACLE,
     abi: parseAbi([
       "function getOracleState(address, uint32) view returns (bool, uint16, bool)",
     ]),
     functionName: "getOracleState",
     args: [marketAddress, 900],
   });

   const [increaseRequired, , observationSatisfied] = oracleState;
   if (increaseRequired || !observationSatisfied) {
     throw new Error("Oracle not ready for this TWAP duration");
   }
   ```

## SY Token Compatibility

**Symptoms:**
- `SYInvalidTokenIn()` when depositing
- `SYInvalidTokenOut()` when redeeming

**Solutions:**

1. **Query valid tokens before depositing:**
   ```typescript
   const tokensIn = await publicClient.readContract({
     address: syAddress,
     abi: parseAbi(["function getTokensIn() view returns (address[])"]),
     functionName: "getTokensIn",
   });

   // For SY-wstETH, valid inputs typically include: WETH, stETH, wstETH, ETH (address(0))
   ```

2. **Different SY contracts accept different tokens.** SY-wstETH accepts WETH, stETH, wstETH, and native ETH. SY-sDAI accepts DAI and sDAI. SY-aUSDC accepts USDC and aUSDC. Always check first.

3. **Use the Router for multi-step conversions.** If your token is not directly supported by the SY, the Router can route through an external DEX (via `pendleSwap` and `swapData` parameters).

## LP Position Issues

**Symptoms:**
- `MarketZeroLpReceive()` when adding liquidity
- Unexpected impermanent loss
- Cannot remove liquidity after maturity

**Solutions:**

1. **Minimum deposit amounts.** Very small deposits may round to zero LP tokens. Ensure meaningful amounts relative to pool TVL.

2. **Remove LP before or shortly after maturity.** Post-maturity, the AMM curve is inactive. Removing liquidity still works, but there is no more trading activity to generate fees:
   ```typescript
   const { request } = await publicClient.simulateContract({
     address: PENDLE_ROUTER,
     abi: removeLpAbi,
     functionName: "removeLiquiditySingleToken",
     args: [account.address, market, lpBalance, tokenOutput],
     account: account.address,
   });
   ```

3. **Claim rewards separately from LP removal.** LP rewards (swap fees, underlying yield, PENDLE emissions) must be claimed via `redeemDueInterestAndRewards`. They are not automatically included in LP removal.

## Gas Estimation Failures

**Symptoms:**
- `estimateGas` returns unreasonably high values
- "Gas estimation failed" in wallet

**Solutions:**

1. **The underlying operation would revert.** Gas estimation runs full simulation. Fix the revert first.

2. **Pendle Router operations use significant gas.** Typical gas usage:
   - Simple swap (token -> PT): ~300,000 - 500,000
   - Mint PT+YT from token: ~250,000 - 400,000
   - Add liquidity (single-sided): ~400,000 - 700,000
   - Claim rewards: ~150,000 - 300,000

3. **Add a gas buffer for complex operations:**
   ```typescript
   const estimatedGas = await publicClient.estimateContractGas({ /* ... */ });
   const gasLimit = (estimatedGas * 130n) / 100n; // 30% buffer
   ```

## Debug Checklist

- [ ] Market is not expired (`expiry() > block.timestamp`)
- [ ] Token is valid for the SY contract (`getTokensIn()` / `getTokensOut()`)
- [ ] Router is approved for all relevant tokens (SY, PT, YT, LP)
- [ ] `minOutput` is set (never 0 in production)
- [ ] `guessMin < guessMax` in ApproxParams
- [ ] Oracle cardinality is initialized (for oracle reads)
- [ ] Sufficient token balance for the operation
- [ ] Transaction simulated successfully before broadcast
- [ ] Correct market address for desired maturity date
