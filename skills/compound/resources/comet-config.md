# Compound V3 Comet Configuration Reference

> **Last verified:** February 2026

Configuration parameters for active Compound V3 (Comet) markets. Values are set by governance via the Configurator contract and can change. Always read on-chain for the latest values.

## Ethereum Mainnet — USDC Market (cUSDCv3)

**Comet:** `0xc3d688B66703497DAA19211EEdff47f25384cdc3`
**Base Asset:** USDC (6 decimals)

### Base Asset Parameters

| Parameter | Value |
|-----------|-------|
| Base Token | USDC (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`) |
| Base Token Price Feed | Chainlink USDC/USD |
| Base Borrow Min | 100 USDC |
| Base Tracking Supply Speed | Variable (governance-set) |
| Base Tracking Borrow Speed | Variable (governance-set) |
| Target Reserves | Variable |

### Collateral Assets

| Asset | Borrow CF | Liquidate CF | Liquidation Factor | Supply Cap |
|-------|----------|-------------|-------------------|------------|
| WETH | 82.5% | 85% | 95% | 450,000 WETH |
| WBTC | 70% | 77% | 95% | 35,000 WBTC |
| COMP | 65% | 70% | 93% | 900,000 COMP |
| UNI | 65% | 70% | 93% | 5,000,000 UNI |
| LINK | 70% | 79% | 93% | 5,000,000 LINK |
| wstETH | 82% | 87% | 95% | 200,000 wstETH |
| cbETH | 78% | 85% | 95% | 60,000 cbETH |

### Interest Rate Model

| Parameter | Value |
|-----------|-------|
| Supply Kink | 80% utilization |
| Supply Per Year Interest Rate Base | ~0% |
| Supply Per Year Interest Rate Slope Low | ~3.5% |
| Supply Per Year Interest Rate Slope High | ~40% |
| Borrow Kink | 80% utilization |
| Borrow Per Year Interest Rate Base | ~1.5% |
| Borrow Per Year Interest Rate Slope Low | ~3.8% |
| Borrow Per Year Interest Rate Slope High | ~50% |

> Rate model parameters are approximate and change via governance proposals. Query `getSupplyRate()` and `getBorrowRate()` for exact current rates.

## Ethereum Mainnet — WETH Market (cWETHv3)

**Comet:** `0xA17581A9E3356d9A858b789D68B4d866e593aE94`
**Base Asset:** WETH (18 decimals)

### Collateral Assets

| Asset | Borrow CF | Liquidate CF | Liquidation Factor | Supply Cap |
|-------|----------|-------------|-------------------|------------|
| wstETH | 90% | 93% | 97% | 400,000 wstETH |
| cbETH | 88% | 90% | 97% | 80,000 cbETH |
| rETH | 88% | 91% | 97% | 50,000 rETH |

## Reading Configuration On-Chain

### Get Collateral Asset Info

```typescript
// Read all collateral configuration for a Comet market
async function getMarketConfig(cometAddress: `0x${string}`) {
  const numAssets = await publicClient.readContract({
    address: cometAddress,
    abi: cometAbi,
    functionName: "numAssets",
  });

  for (let i = 0; i < numAssets; i++) {
    const info = await publicClient.readContract({
      address: cometAddress,
      abi: cometAbi,
      functionName: "getAssetInfo",
      args: [i],
    });

    console.log(`Asset ${i}: ${info.asset}`);
    console.log(`  Borrow CF: ${Number(info.borrowCollateralFactor) / 1e18 * 100}%`);
    console.log(`  Liquidate CF: ${Number(info.liquidateCollateralFactor) / 1e18 * 100}%`);
    console.log(`  Liquidation Factor: ${Number(info.liquidationFactor) / 1e18 * 100}%`);
    console.log(`  Supply Cap: ${info.supplyCap}`);
    console.log(`  Price Feed: ${info.priceFeed}`);
    console.log(`  Scale: ${info.scale}`);
  }
}
```

### Get Current Interest Rates

```typescript
async function getCurrentRates(cometAddress: `0x${string}`) {
  const utilization = await publicClient.readContract({
    address: cometAddress,
    abi: cometAbi,
    functionName: "getUtilization",
  });

  const supplyRate = await publicClient.readContract({
    address: cometAddress,
    abi: cometAbi,
    functionName: "getSupplyRate",
    args: [utilization],
  });

  const borrowRate = await publicClient.readContract({
    address: cometAddress,
    abi: cometAbi,
    functionName: "getBorrowRate",
    args: [utilization],
  });

  const SECONDS_PER_YEAR = 31_536_000n;
  console.log(`Utilization: ${Number(utilization) / 1e18 * 100}%`);
  console.log(`Supply APR: ${(Number(supplyRate * SECONDS_PER_YEAR) / 1e18 * 100).toFixed(2)}%`);
  console.log(`Borrow APR: ${(Number(borrowRate * SECONDS_PER_YEAR) / 1e18 * 100).toFixed(2)}%`);
}
```

### Get Market Totals

```typescript
async function getMarketTotals(cometAddress: `0x${string}`) {
  const [totalSupply, totalBorrow] = await Promise.all([
    publicClient.readContract({
      address: cometAddress,
      abi: cometAbi,
      functionName: "totalSupply",
    }),
    publicClient.readContract({
      address: cometAddress,
      abi: cometAbi,
      functionName: "totalBorrow",
    }),
  ]);

  const baseToken = await publicClient.readContract({
    address: cometAddress,
    abi: cometAbi,
    functionName: "baseToken",
  });

  console.log(`Base token: ${baseToken}`);
  console.log(`Total supply: ${totalSupply}`);
  console.log(`Total borrow: ${totalBorrow}`);
}
```

### Get Current Prices via cast

```bash
# Get WETH price from the Comet's configured feed
COMET=0xc3d688B66703497DAA19211EEdff47f25384cdc3

# Get WETH asset info (index 0 in USDC market)
cast call $COMET "getAssetInfo(uint8)((uint8,address,address,uint64,uint64,uint64,uint64,uint128))" 0 --rpc-url $RPC_URL

# Get price from a specific Chainlink feed
PRICE_FEED=0x... # from getAssetInfo result
cast call $COMET "getPrice(address)(uint256)" $PRICE_FEED --rpc-url $RPC_URL
```

## Key Parameter Definitions

| Parameter | Description |
|-----------|-------------|
| **Borrow Collateral Factor** | Max ratio of borrow value to collateral value. 80% means you can borrow up to 80% of collateral value. |
| **Liquidate Collateral Factor** | Threshold at which position becomes liquidatable. Higher than borrow CF, creating a buffer. |
| **Liquidation Factor** | Portion of collateral value the protocol reclaims during liquidation. Remainder covers bad debt. |
| **Supply Cap** | Maximum amount of this collateral that can be supplied across all users. Limits risk exposure. |
| **Scale** | Normalization factor to convert collateral amounts to base asset precision. |
| **Kink** | Utilization rate at which the interest rate slope changes from gentle to steep. |
| **Store Front Price Factor** | Discount applied when selling absorbed collateral via `buyCollateral()`. |

## Reference

- [Compound V3 Configurator](https://github.com/compound-finance/comet/blob/main/contracts/Configurator.sol)
- [Compound V3 CometConfiguration](https://github.com/compound-finance/comet/blob/main/contracts/CometConfiguration.sol)
- [Compound Governance Forum](https://www.comp.xyz/)
