# Aave V3 Reserve Configuration Reference

> **Last verified:** 2025-05-01 (Ethereum mainnet, Main market). Parameters change via governance votes. Query on-chain for current values.

## LTV, Liquidation Threshold, and Liquidation Bonus

- **LTV**: Maximum percentage of collateral value that can be borrowed.
- **Liquidation Threshold**: Collateral ratio at which a position becomes liquidatable.
- **Liquidation Bonus**: Discount liquidators receive on seized collateral (incentive to liquidate).

| Asset | LTV | Liq Threshold | Liq Bonus | Supply Cap | Borrow Cap |
|-------|-----|---------------|-----------|------------|------------|
| WETH | 80.5% | 83% | 5% | 1,800,000 | 1,400,000 |
| USDC | 77% | 80% | 4.5% | 4,000,000,000 | 3,500,000,000 |
| USDT | 77% | 80% | 4.5% | 4,000,000,000 | 3,500,000,000 |
| DAI | 67% | 77% | 4% | 338,000,000 | 271,000,000 |
| WBTC | 73% | 78% | 6.25% | 43,000 | 28,000 |
| wstETH | 68.5% | 79.5% | 7% | 650,000 | 12,000 |
| LINK | 68% | 73% | 7.5% | 16,000,000 | 7,400,000 |
| AAVE | 66% | 73% | 7.5% | 1,800,000 | 0 (not borrowable) |

## Interest Rate Model

Aave V3 uses a variable-slope interest rate model as a function of utilization:
- Below optimal utilization: rate increases slowly (slope 1)
- Above optimal utilization: rate increases steeply (slope 2) to incentivize repayment

| Parameter | WETH | USDC | USDT | DAI | WBTC |
|-----------|------|------|------|-----|------|
| Optimal Utilization | 80% | 90% | 90% | 90% | 45% |
| Base Variable Rate | 0% | 0% | 0% | 0% | 0% |
| Slope 1 | 3.3% | 3.5% | 4% | 4% | 4% |
| Slope 2 | 80% | 60% | 75% | 75% | 300% |

### Rate Calculation

```
If utilization <= optimal:
  borrowRate = baseRate + (utilization / optimal) * slope1

If utilization > optimal:
  borrowRate = baseRate + slope1 + ((utilization - optimal) / (1 - optimal)) * slope2
```

## Reserve Factor

Percentage of borrower interest that goes to the Aave treasury (protocol revenue) rather than to suppliers.

| Asset | Reserve Factor |
|-------|---------------|
| WETH | 15% |
| USDC | 10% |
| USDT | 10% |
| DAI | 10% |
| WBTC | 20% |
| wstETH | 15% |
| LINK | 20% |

## E-Mode Categories (Ethereum Mainnet)

E-Mode overrides LTV, liquidation threshold, and liquidation bonus for assets within the same category.

### Category 0: Default (No E-Mode)

Uses per-asset LTV/threshold values from the table above.

### Category 1: Stablecoins

| Parameter | Value |
|-----------|-------|
| LTV | 97% |
| Liquidation Threshold | 97.5% |
| Liquidation Bonus | 1% |
| Eligible Assets | USDC, USDT, DAI, FRAX, LUSD |

### Category 2: ETH Correlated

| Parameter | Value |
|-----------|-------|
| LTV | 93% |
| Liquidation Threshold | 95% |
| Liquidation Bonus | 1% |
| Eligible Assets | WETH, wstETH, rETH, cbETH |

## Reading Configuration On-Chain

```typescript
const dataProviderAbi = [
  {
    name: "getReserveConfigurationData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "decimals", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "liquidationThreshold", type: "uint256" },
      { name: "liquidationBonus", type: "uint256" },
      { name: "reserveFactor", type: "uint256" },
      { name: "usageAsCollateralEnabled", type: "bool" },
      { name: "borrowingEnabled", type: "bool" },
      { name: "stableBorrowRateEnabled", type: "bool" },
      { name: "isActive", type: "bool" },
      { name: "isFrozen", type: "bool" },
    ],
  },
  {
    name: "getReserveCaps",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "borrowCap", type: "uint256" },
      { name: "supplyCap", type: "uint256" },
    ],
  },
] as const;

const POOL_DATA_PROVIDER = "0x7B4EB56E7CD4b454BA8ff71E4518426c84552Dc";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const config = await publicClient.readContract({
  address: POOL_DATA_PROVIDER,
  abi: dataProviderAbi,
  functionName: "getReserveConfigurationData",
  args: [USDC],
});

// ltv and liquidationThreshold are in basis points (8000 = 80%)
console.log(`LTV: ${Number(config[1]) / 100}%`);
console.log(`Liq Threshold: ${Number(config[2]) / 100}%`);
// liquidationBonus: 10450 = 104.5% (4.5% bonus to liquidator)
console.log(`Liq Bonus: ${(Number(config[3]) - 10000) / 100}%`);
console.log(`Borrowing enabled: ${config[6]}`);
console.log(`Frozen: ${config[9]}`);
```

## References

- [Aave V3 Risk Parameters](https://docs.aave.com/risk/asset-risk/risk-parameters)
- [Aave Governance Forum](https://governance.aave.com) -- parameter change proposals
- [BGD Labs Address Book](https://github.com/bgd-labs/aave-address-book)
