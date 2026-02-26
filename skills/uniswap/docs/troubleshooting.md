# Uniswap Troubleshooting Guide

Common issues and solutions when integrating Uniswap V3 and V4.

## Transaction Reverts with No Error Message

**Symptoms:**
- Transaction reverts with empty data or generic "execution reverted"
- No revert reason string in the trace

**Solutions:**

1. **Simulate first with `simulateContract`:**
   ```typescript
   try {
     const { request } = await publicClient.simulateContract({
       address: SWAP_ROUTER_02,
       abi: swapRouterAbi,
       functionName: "exactInputSingle",
       args: [params],
       account: account.address,
     });
   } catch (error) {
     // Simulation gives the exact revert reason
     console.error("Revert reason:", error.message);
   }
   ```

2. **Use `cast run` to trace the failed transaction:**
   ```bash
   cast run <tx_hash> --rpc-url $RPC_URL
   ```

3. **Check for fee-on-transfer tokens.** Some tokens deduct a fee on every transfer, causing the router to receive less than expected. SwapRouter02 does not natively support fee-on-transfer tokens -- use UniversalRouter with the `PERMIT2_TRANSFER_FROM` command which handles this.

4. **Verify the pool exists.** If there is no pool deployed for the (tokenA, tokenB, fee) combination, the router will revert without a clear message.

## Insufficient Output Amount

**Symptoms:**
- Revert with "Too little received"
- Swap simulation succeeds but on-chain execution fails

**Solutions:**

1. **Price moved between quote and execution.** The mempool delay means prices change. Widen slippage tolerance:
   ```typescript
   // 0.5% slippage for normal conditions
   const slippageBps = 50n;
   // 1-2% for volatile markets
   const slippageBps = 200n;
   ```

2. **MEV sandwich attack.** A searcher front-ran your transaction, moving the price. Mitigations:
   - Use [Flashbots Protect RPC](https://rpc.flashbots.net) to submit transactions privately
   - Set tight `amountOutMinimum` -- this caps the attacker's extractable value
   - Use `sqrtPriceLimitX96` to bound maximum price impact

3. **Stale quote.** If you quoted minutes ago, re-quote immediately before submitting.

## Approval Issues

**Symptoms:**
- Revert with `STF` (SafeTransferFrom failed)
- Revert with "ERC20: transfer amount exceeds allowance"

**Solutions:**

1. **Approve the correct spender:**
   - For SwapRouter02: approve tokens to `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
   - For UniversalRouter: approve tokens to **Permit2** at `0x000000000022D473030F116dDEE9F6B43aC78BA3`, NOT the router
   - For NonfungiblePositionManager: approve to `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`

2. **Check existing allowance before approving:**
   ```typescript
   const allowance = await publicClient.readContract({
     address: tokenAddress,
     abi: parseAbi(["function allowance(address,address) view returns (uint256)"]),
     functionName: "allowance",
     args: [account.address, spender],
   });
   ```

3. **USDT special case.** USDT requires setting allowance to 0 before setting a new non-zero value:
   ```typescript
   // Reset to 0 first
   await walletClient.writeContract({ address: USDT, abi: erc20Abi, functionName: "approve", args: [spender, 0n] });
   // Then set desired amount
   await walletClient.writeContract({ address: USDT, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
   ```

4. **Permit2 allowance is capped at `uint160`.** Do not approve `type(uint256).max` to Permit2 -- use `2n ** 160n - 1n`.

## Pool Doesn't Exist

**Symptoms:**
- `getPool` returns zero address
- Router reverts when trying to swap

**Solutions:**

1. **Verify token addresses.** Confirm both token addresses are correct and on the right chain.

2. **Try different fee tiers.** Not all pairs have pools at every fee tier:
   ```typescript
   for (const fee of [100, 500, 3000, 10000]) {
     const pool = await publicClient.readContract({
       address: FACTORY,
       abi: factoryAbi,
       functionName: "getPool",
       args: [tokenA, tokenB, fee],
     });
     if (pool !== "0x0000000000000000000000000000000000000000") {
       console.log(`Found pool at fee ${fee}: ${pool}`);
     }
   }
   ```

3. **Token ordering does not matter for `getPool`.** The factory handles sorting internally. But for direct pool calls, `token0 < token1` must hold.

4. **Check if the pair only exists on V2.** Some low-cap tokens only have V2 liquidity. Query the V2 factory at `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f`.

## Gas Estimation Failures

**Symptoms:**
- `estimateGas` reverts or returns an unreasonably high value
- "Gas estimation failed" error in wallet

**Solutions:**

1. **The swap itself would revert.** Gas estimation runs the transaction as a simulation. If it fails, the swap parameters are invalid. Fix the underlying swap issue first.

2. **Insufficient token balance or approval.** Gas estimation executes the full transaction logic. If you lack balance or approval, it reverts.

3. **Add a buffer to gas estimates:**
   ```typescript
   const estimatedGas = await publicClient.estimateContractGas({ ... });
   // 20% buffer for cross-tick swaps where gas is variable
   const gasLimit = (estimatedGas * 120n) / 100n;
   ```

4. **Multi-hop swaps use significantly more gas.** Budget ~150,000 for single-hop, ~250,000-350,000 for two-hop, and ~350,000-500,000 for three-hop swaps.

## Tick Alignment Errors

**Symptoms:**
- Revert when minting a position
- "tickLower not aligned" or similar

**Solutions:**

Ticks must be divisible by the pool's tick spacing:

| Fee Tier | Tick Spacing | Valid Ticks (examples) |
|----------|-------------|----------------------|
| 100 (0.01%) | 1 | Any integer in [-887272, 887272] |
| 500 (0.05%) | 10 | -887270, -100, 0, 100, 887270 |
| 3000 (0.3%) | 60 | -887220, -60, 0, 60, 887220 |
| 10000 (1%) | 200 | -887200, -200, 0, 200, 887200 |

```typescript
function alignTick(tick: number, tickSpacing: number): number {
  return Math.floor(tick / tickSpacing) * tickSpacing;
}
```

## V4 Hook Deployment Issues

**Symptoms:**
- Pool initialization reverts with `HookAddressNotValid`
- Hook callbacks not being called

**Solutions:**

1. **Hook address flags must match permissions.** The leading bytes of the hook address encode which callbacks are enabled. Use `HookMiner.find` to compute a valid deployment salt.

2. **Verify flags match `getHookPermissions`:**
   ```solidity
   uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
   // Ensure the deployed address has these exact bits set
   ```

3. **Hook must be deployed before pool initialization.** The PoolManager reads the hook's code during `initialize`. Deploy the hook first, then create the pool.

## Debug Checklist

- [ ] Token addresses are correct for the target chain
- [ ] Sufficient token balance for the swap amount
- [ ] Approval granted to the correct spender (router or Permit2)
- [ ] Fee tier has an active pool with liquidity
- [ ] `amountOutMinimum` is set (never 0 in production)
- [ ] Deadline is in the future
- [ ] Tick range is aligned to tick spacing (for liquidity operations)
- [ ] Transaction simulated successfully before broadcast
