# Uniswap V3 Fee Tiers

Fee tiers determine the swap fee charged to traders and the tick spacing that constrains LP position boundaries.

## Fee Tier Reference

| Fee (bps) | Fee (%) | Fee Parameter | Tick Spacing | Typical Use |
|-----------|---------|---------------|-------------|-------------|
| 1 | 0.01% | `100` | 1 | Stable-stable pairs (USDC/DAI, USDC/USDT). Minimal price deviation. |
| 5 | 0.05% | `500` | 10 | Correlated pairs and high-volume blue chips (WETH/USDC, WETH/WBTC). Most liquid tier for majors. |
| 30 | 0.30% | `3000` | 60 | Standard pairs. Default for most token pairs. Good balance of LP revenue and trader cost. |
| 100 | 1.00% | `10000` | 200 | Exotic, volatile, or low-liquidity pairs. Higher fee compensates LPs for impermanent loss risk. |

## Fee Parameter Encoding

The fee parameter is in **hundredths of a basis point**. One basis point = 0.01%.

```
fee = 3000  means  3000 / 1_000_000 = 0.003 = 0.3%
fee = 500   means  500  / 1_000_000 = 0.0005 = 0.05%
fee = 100   means  100  / 1_000_000 = 0.0001 = 0.01%
fee = 10000 means  10000 / 1_000_000 = 0.01  = 1.0%
```

## Tick Spacing

Tick spacing determines the granularity of LP position boundaries. Positions can only start/end at ticks divisible by the tick spacing.

- **Tick spacing 1** (0.01% tier): Maximum precision. Each tick = 0.01% price change. Positions can be extremely narrow.
- **Tick spacing 10** (0.05% tier): Each position boundary step = ~0.1% price change. Good for tight ranges on stable pairs.
- **Tick spacing 60** (0.3% tier): Each step = ~0.6% price change. Standard granularity.
- **Tick spacing 200** (1% tier): Each step = ~2% price change. Coarse granularity for volatile assets.

Lower tick spacing = more granular positions = higher gas costs for swaps that cross many ticks.

## Choosing a Fee Tier

| Pair Type | Recommended Tier | Reasoning |
|-----------|-----------------|-----------|
| Stablecoin / stablecoin | 100 (0.01%) | Minimal impermanent loss. Traders expect near-zero slippage. |
| Major / stablecoin (ETH/USDC) | 500 (0.05%) | High volume compensates low fee. Deepest liquidity lives here. |
| Major / major (WETH/WBTC) | 500 (0.05%) | Correlated assets, high volume. |
| Mid-cap / major | 3000 (0.3%) | Standard pairs. Balances LP compensation with trade cost. |
| Small-cap / major | 3000 (0.3%) or 10000 (1%) | Higher fee offsets volatility risk for LPs. |
| Exotic or new token | 10000 (1%) | High volatility, low volume. LPs need maximum fee to justify risk. |

## Multiple Pools Per Pair

A pair can have pools at every fee tier simultaneously. Liquidity concentrates in whichever tier the market finds optimal. Check all tiers when routing:

```typescript
const FEE_TIERS = [100, 500, 3000, 10000] as const;

for (const fee of FEE_TIERS) {
  const pool = await publicClient.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "getPool",
    args: [tokenA, tokenB, fee],
  });
  if (pool !== "0x0000000000000000000000000000000000000000") {
    console.log(`Pool exists at fee ${fee}: ${pool}`);
  }
}
```

## V4 Fee Differences

V4 allows **dynamic fees** via hooks. When a pool is created with `LPFeeLibrary.DYNAMIC_FEE_FLAG` set in the fee field, the `beforeSwap` hook can override the fee on every swap. This enables time-based fees, volatility-adjusted fees, and other custom models that are impossible with V3's fixed fee tiers.
