# AdaptiveCurveIRM Configuration

The AdaptiveCurveIRM is Morpho Blue's default (and currently only governance-enabled) interest rate model. It autonomously adjusts rates based on utilization without any governance or manual parameters.

**Contract:** `0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC`

## How It Works

The IRM targets a utilization rate and adjusts the rate curve over time:

- **Target utilization:** 90% (`0.9e18`)
- When utilization is **above** 90%, rates increase over time
- When utilization is **below** 90%, rates decrease over time
- The adjustment speed is proportional to the distance from target

## Curve Parameters

The rate at any point is determined by an exponential curve:

```
rate = rateAtTarget * e^(curveSteepness * (utilization - targetUtilization))
```

### Constants

| Parameter | Value | Description |
|-----------|-------|-------------|
| Target Utilization | `0.9e18` (90%) | Utilization the model tries to achieve |
| Curve Steepness | `4e18` | How sharply rates increase above target |
| Adjustment Speed | `50e18 / 365 days` | How fast `rateAtTarget` changes per second |
| Min Rate At Target | `0.1% APY` | Floor for the base rate |
| Max Rate At Target | `200% APY` | Ceiling for the base rate |
| Initial Rate At Target | `4% APY` | Starting base rate for new markets |

### Rate Multipliers

At any given `rateAtTarget`:

| Utilization | Approximate Rate |
|-------------|-----------------|
| 0% | `rateAtTarget / e^(4 * 0.9)` (very low) |
| 50% | `rateAtTarget / e^(4 * 0.4)` |
| 80% | `rateAtTarget / e^(4 * 0.1)` |
| 90% (target) | `rateAtTarget` |
| 95% | `rateAtTarget * e^(4 * 0.05)` |
| 100% | `rateAtTarget * e^(4 * 0.1)` (~1.5x rateAtTarget) |

## Adaptive Behavior

The `rateAtTarget` adjusts over time:

```
If utilization > 90%:
  rateAtTarget increases (makes borrowing more expensive to reduce utilization)

If utilization < 90%:
  rateAtTarget decreases (makes borrowing cheaper to attract utilization)
```

### Adjustment Example

A market sitting at 95% utilization for 24 hours:
1. `rateAtTarget` gradually increases
2. Higher rates discourage borrowing
3. Higher rates attract more supply
4. Utilization moves back toward 90%

A market sitting at 50% utilization for 24 hours:
1. `rateAtTarget` gradually decreases
2. Lower rates encourage borrowing
3. Utilization moves back toward 90%

## Reading IRM State

The current `rateAtTarget` is stored per-market inside the IRM contract:

```typescript
const irmAbi = [
  {
    name: "borrowRateView",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      {
        name: "market",
        type: "tuple",
        components: [
          { name: "totalSupplyAssets", type: "uint128" },
          { name: "totalSupplyShares", type: "uint128" },
          { name: "totalBorrowAssets", type: "uint128" },
          { name: "totalBorrowShares", type: "uint128" },
          { name: "lastUpdate", type: "uint128" },
          { name: "fee", type: "uint128" },
        ],
      },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ADAPTIVE_CURVE_IRM = "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC" as const;
const MORPHO = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as const;

// First read market data from Morpho
const marketData = await publicClient.readContract({
  address: MORPHO,
  abi: morphoAbi,
  functionName: "market",
  args: [marketId],
});

// Then query the IRM for current borrow rate
const borrowRatePerSecond = await publicClient.readContract({
  address: ADAPTIVE_CURVE_IRM,
  abi: irmAbi,
  functionName: "borrowRateView",
  args: [
    marketParams,
    {
      totalSupplyAssets: marketData[0],
      totalSupplyShares: marketData[1],
      totalBorrowAssets: marketData[2],
      totalBorrowShares: marketData[3],
      lastUpdate: marketData[4],
      fee: marketData[5],
    },
  ],
});

// borrowRatePerSecond is a WAD (18 decimals) per-second rate
// Convert to APY: (1 + ratePerSecond)^31536000 - 1
const ratePerSecond = Number(borrowRatePerSecond) / 1e18;
const borrowAPY = (Math.pow(1 + ratePerSecond, 31536000) - 1) * 100;
console.log(`Borrow APY: ${borrowAPY.toFixed(2)}%`);

// Supply APY = Borrow APY * utilization * (1 - fee)
// Approximation for quick estimation
```

## Key Differences from Aave/Compound IRM

| Feature | Aave/Compound | Morpho AdaptiveCurveIRM |
|---------|---------------|------------------------|
| Parameter control | Governance sets slopes manually | Fully autonomous |
| Target utilization | Fixed by governance | Fixed at 90% |
| Rate adjustment | Instant (based on current utilization) | Gradual (adapts over time) |
| Rate bounds | Set by governance | Hard-coded min/max |
| Per-market customization | Different IRMs per asset | Same IRM, per-market state |

## References

- [AdaptiveCurveIRM Source](https://github.com/morpho-org/morpho-blue-irm)
- [IRM Whitepaper](https://github.com/morpho-org/morpho-blue-irm/blob/main/paper.pdf)
