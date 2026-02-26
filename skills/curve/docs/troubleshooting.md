# Curve Troubleshooting Guide

Common issues and solutions when integrating Curve Finance.

## Transaction Reverts with Empty Data

**Symptoms:**
- Transaction reverts with no error message
- Vyper contracts return empty revert data on mainnet

**Solutions:**

1. **Simulate first with `simulateContract`:**
   ```typescript
   try {
     const { request } = await publicClient.simulateContract({
       address: poolAddress,
       abi: poolAbi,
       functionName: "exchange",
       args: [i, j, amountIn, minDy],
       account: account.address,
     });
   } catch (error) {
     console.error("Revert reason:", error.message);
   }
   ```

2. **Wrong ABI for pool type.** This is the most common cause. StableSwap pools, CryptoSwap pools, Meta pools, and Factory pools all have different ABIs. Verify you are using the correct ABI for the specific pool.

3. **Wrong index type.** Older pools (3pool, stETH/ETH) use `int128` for coin indices. Newer factory pools use `uint256`. Using the wrong type causes an ABI encoding mismatch that appears as an empty revert.

4. **Use `cast run` to trace failed transactions:**
   ```bash
   cast run <tx_hash> --rpc-url $RPC_URL
   ```

## Exchange Resulted in Fewer Coins Than Expected

**Symptoms:**
- Revert with "Exchange resulted in fewer coins than expected"
- Simulation succeeds but on-chain execution fails

**Solutions:**

1. **Price moved between quote and execution.** Re-quote immediately before submitting and widen slippage:
   ```typescript
   // For stableswap: 10-30 bps is normal
   const minDy = (expectedOut * 9970n) / 10000n; // 30 bps

   // For cryptoswap/volatile: 50-200 bps
   const minDy = (expectedOut * 9800n) / 10000n; // 200 bps
   ```

2. **MEV sandwich attack.** Use [Flashbots Protect RPC](https://rpc.flashbots.net) to submit transactions privately on Ethereum mainnet.

3. **Pool imbalance changed.** Large trades in the same block can shift pool balances. Simulate at the latest block before submitting.

## USDT Approval Failures

**Symptoms:**
- Approval transaction reverts
- "SafeERC20: low-level call failed" when approving USDT

**Solutions:**

USDT's `approve()` function requires the current allowance to be 0 before setting a new non-zero value. This is a non-standard ERC-20 behavior.

```typescript
const currentAllowance = await publicClient.readContract({
  address: USDT,
  abi: parseAbi(["function allowance(address,address) view returns (uint256)"]),
  functionName: "allowance",
  args: [account.address, spender],
});

if (currentAllowance > 0n) {
  // Reset to 0 first
  const { request: resetReq } = await publicClient.simulateContract({
    address: USDT,
    abi: parseAbi(["function approve(address,uint256) returns (bool)"]),
    functionName: "approve",
    args: [spender, 0n],
    account: account.address,
  });
  const resetHash = await walletClient.writeContract(resetReq);
  await publicClient.waitForTransactionReceipt({ hash: resetHash });
}

// Now set the new allowance
const { request } = await publicClient.simulateContract({
  address: USDT,
  abi: parseAbi(["function approve(address,uint256) returns (bool)"]),
  functionName: "approve",
  args: [spender, amount],
  account: account.address,
});
```

## Wrong Token Swapped

**Symptoms:**
- Swap completes but you received the wrong token
- Expected USDC but got DAI

**Solutions:**

Token indices are pool-specific and NOT alphabetically sorted. Always verify indices before swapping:

```typescript
// ALWAYS verify which token is at which index
const coin0 = await publicClient.readContract({
  address: poolAddress,
  abi: parseAbi(["function coins(uint256) view returns (address)"]),
  functionName: "coins",
  args: [0n],
});

const coin1 = await publicClient.readContract({
  address: poolAddress,
  abi: parseAbi(["function coins(uint256) view returns (address)"]),
  functionName: "coins",
  args: [1n],
});

// Build index map
const coinMap: Record<string, bigint> = {};
coinMap[coin0.toLowerCase()] = 0n;
coinMap[coin1.toLowerCase()] = 1n;

const fromIndex = coinMap[tokenIn.toLowerCase()];
const toIndex = coinMap[tokenOut.toLowerCase()];
if (fromIndex === undefined || toIndex === undefined) {
  throw new Error("Token not found in pool");
}
```

## add_liquidity Array Length Mismatch

**Symptoms:**
- `add_liquidity` reverts with no error
- Works on one pool but not another

**Solutions:**

The amounts array length must match the number of coins in the pool:

| Pool Type | Array Length | Example |
|-----------|------------|---------|
| 2-pool (stETH/ETH) | `uint256[2]` | `[ethAmount, stethAmount]` |
| 3-pool (DAI/USDC/USDT) | `uint256[3]` | `[daiAmount, usdcAmount, usdtAmount]` |
| 4-pool | `uint256[4]` | `[coin0, coin1, coin2, coin3]` |

Each pool has a different ABI signature. There is no generic `add_liquidity` that works across all pools.

## Meta Pool: exchange() vs exchange_underlying()

**Symptoms:**
- `exchange()` reverts on a meta pool when trying to swap the meta-asset for a basepool token
- Can only swap between the meta-asset and the LP token, not the underlying

**Solutions:**

Meta pools have two swap functions:
- `exchange(i, j, dx, min_dy)` — Swaps between the meta-asset (index 0) and the basepool LP token (index 1)
- `exchange_underlying(i, j, dx, min_dy)` — Swaps between the meta-asset and the individual basepool tokens

For a LUSD/3CRV meta pool:
- `exchange(0, 1, ...)` swaps LUSD for 3CRV LP token
- `exchange_underlying(0, 1, ...)` swaps LUSD for DAI
- `exchange_underlying(0, 2, ...)` swaps LUSD for USDC
- `exchange_underlying(0, 3, ...)` swaps LUSD for USDT

## ETH Pool: Missing msg.value

**Symptoms:**
- Swap reverts when trying to sell ETH
- "Insufficient funds" on ETH pool despite having balance

**Solutions:**

ETH pools (stETH/ETH, frxETH/ETH) require native ETH sent as `msg.value`:

```typescript
const ethAmount = 1_000000000000000000n; // 1 ETH

const { request } = await publicClient.simulateContract({
  address: poolAddress,
  abi: ethPoolAbi,
  functionName: "exchange",
  args: [0n, 1n, ethAmount, minDy],
  value: ethAmount, // send ETH with the call
  account: account.address,
});
```

Do NOT approve WETH to the pool. These pools accept raw ETH, not wrapped ETH (unless the pool specifically uses WETH — check `coins(0)` to verify).

## Gauge Deposit: LP Tokens Not Earning CRV

**Symptoms:**
- Deposited LP tokens into gauge but CRV rewards are 0
- `claimable_tokens` always returns 0

**Solutions:**

1. **Verify you deposited to the correct gauge.** Each pool has a specific gauge. Use the MetaRegistry to find it:
   ```typescript
   const gauge = await publicClient.readContract({
     address: META_REGISTRY,
     abi: parseAbi(["function get_gauge(address) view returns (address)"]),
     functionName: "get_gauge",
     args: [poolAddress],
   });
   ```

2. **Gauge may have 0 weight.** If no veCRV holders vote for this gauge, it receives 0 CRV emissions. Check the gauge weight:
   ```typescript
   const weight = await publicClient.readContract({
     address: GAUGE_CONTROLLER,
     abi: parseAbi(["function gauge_relative_weight(address) view returns (uint256)"]),
     functionName: "gauge_relative_weight",
     args: [gaugeAddress],
   });
   // weight = 0 means no CRV emissions to this gauge
   ```

3. **CRV rewards accrue over time.** You must wait at least 1 epoch (1 week) after depositing. Check back after the next Thursday 00:00 UTC.

4. **Use Minter to claim.** Call `mint(gauge_addr)` on the Minter contract (`0xd061D61a4d941c39E5453435B6345Dc261C2fcE0`), not on the gauge directly.

## veCRV: "Withdraw old tokens first"

**Symptoms:**
- `create_lock()` reverts with "Withdraw old tokens first"

**Solutions:**

You already have a veCRV lock. You cannot create a second one. Options:
1. **If lock is expired**: Call `withdraw()` first, then `create_lock()`.
2. **If lock is active**: Use `increase_amount()` to add more CRV, or `increase_unlock_time()` to extend duration.

## crvUSD: Loan Health Dropping

**Symptoms:**
- Health percentage decreasing rapidly
- Position entering soft liquidation (stablecoin field > 0 in user_state)

**Solutions:**

1. **Add collateral:**
   ```typescript
   const { request } = await publicClient.simulateContract({
     address: controller,
     abi: parseAbi(["function add_collateral(uint256 collateral)"]),
     functionName: "add_collateral",
     args: [additionalCollateral],
     account: account.address,
   });
   ```

2. **Partially repay debt** to improve health ratio.

3. **Soft liquidation is expected behavior** — the position is being gradually converted. If price recovers, it converts back. This is not a bug.

4. **Hard liquidation occurs at health < 0** — at this point, anyone can liquidate your position. Monitor health and act when it drops below 10%.

## Debug Checklist

- [ ] ABI matches the specific pool type (StableSwap/CryptoSwap/Meta/Factory)
- [ ] Token indices verified via `coins(i)` on-chain
- [ ] Correct index type (`int128` for old pools, `uint256` for factory pools)
- [ ] Token approved to the correct pool/gauge/controller address
- [ ] USDT allowance reset to 0 before setting new value
- [ ] ETH sent as `msg.value` for ETH pools (not as WETH approval)
- [ ] `min_dy` set via `get_dy()` quote + slippage tolerance
- [ ] Transaction simulated successfully before broadcasting
- [ ] For meta pools: using `exchange_underlying()` for cross-pool swaps
