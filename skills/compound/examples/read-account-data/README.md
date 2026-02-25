# Read Account Data Example

Read all account state from Compound V3: supplied base, borrowed base, collateral positions, health status, accrued rewards, and market rates.

## Setup

```typescript
import {
  createPublicClient,
  http,
  formatUnits,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const COMET_USDC = "0xc3d688B66703497DAA19211EEdff47f25384cdc3" as const;
const COMET_REWARDS = "0x1B0e765F6224C21223AeA2af16c1C46E38885a40" as const;
```

## ABIs

```typescript
const cometAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "borrowBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "collateralBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    name: "isLiquidatable",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getAssetInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "i", type: "uint8" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "offset", type: "uint8" },
          { name: "asset", type: "address" },
          { name: "priceFeed", type: "address" },
          { name: "scale", type: "uint64" },
          { name: "borrowCollateralFactor", type: "uint64" },
          { name: "liquidateCollateralFactor", type: "uint64" },
          { name: "liquidationFactor", type: "uint64" },
          { name: "supplyCap", type: "uint128" },
        ],
      },
    ],
  },
  {
    name: "numAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "baseToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getUtilization",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getSupplyRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "utilization", type: "uint256" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    name: "getBorrowRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "utilization", type: "uint256" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "priceFeed", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalBorrow",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "baseTokenPriceFeed",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const cometRewardsAbi = [
  {
    name: "getRewardOwed",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "comet", type: "address" },
      { name: "account", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "owed", type: "uint256" },
        ],
      },
    ],
  },
] as const;
```

## Read User Position

```typescript
interface CollateralPosition {
  asset: Address;
  balance: bigint;
  priceUsd: bigint;
  valueUsd: bigint;
  borrowCollateralFactor: bigint;
  liquidateCollateralFactor: bigint;
  supplyCap: bigint;
}

interface UserPosition {
  baseSupplied: bigint;
  baseBorrowed: bigint;
  collaterals: CollateralPosition[];
  totalCollateralValueUsd: bigint;
  borrowCapacityUsd: bigint;
  liquidationThresholdUsd: bigint;
  isLiquidatable: boolean;
}

async function getUserPosition(
  comet: Address,
  userAddress: Address
): Promise<UserPosition> {
  const [baseSupplied, baseBorrowed, numAssets, isLiquidatable] =
    await Promise.all([
      publicClient.readContract({
        address: comet,
        abi: cometAbi,
        functionName: "balanceOf",
        args: [userAddress],
      }),
      publicClient.readContract({
        address: comet,
        abi: cometAbi,
        functionName: "borrowBalanceOf",
        args: [userAddress],
      }),
      publicClient.readContract({
        address: comet,
        abi: cometAbi,
        functionName: "numAssets",
      }),
      publicClient.readContract({
        address: comet,
        abi: cometAbi,
        functionName: "isLiquidatable",
        args: [userAddress],
      }),
    ]);

  const collaterals: CollateralPosition[] = [];
  let totalCollateralValueUsd = 0n;
  let borrowCapacityUsd = 0n;
  let liquidationThresholdUsd = 0n;

  for (let i = 0; i < numAssets; i++) {
    const assetInfo = await publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "getAssetInfo",
      args: [i],
    });

    const balance = await publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "collateralBalanceOf",
      args: [userAddress, assetInfo.asset],
    });

    if (balance > 0n) {
      const priceUsd = await publicClient.readContract({
        address: comet,
        abi: cometAbi,
        functionName: "getPrice",
        args: [assetInfo.priceFeed],
      });

      // price is 8 decimals (Chainlink), scale normalizes to base asset precision
      const valueUsd =
        (BigInt(balance) * priceUsd) / BigInt(assetInfo.scale);

      totalCollateralValueUsd += valueUsd;

      // borrowCollateralFactor and liquidateCollateralFactor are 18-decimal
      borrowCapacityUsd +=
        (valueUsd * BigInt(assetInfo.borrowCollateralFactor)) / 10n ** 18n;
      liquidationThresholdUsd +=
        (valueUsd * BigInt(assetInfo.liquidateCollateralFactor)) / 10n ** 18n;

      collaterals.push({
        asset: assetInfo.asset,
        balance: BigInt(balance),
        priceUsd,
        valueUsd,
        borrowCollateralFactor: BigInt(assetInfo.borrowCollateralFactor),
        liquidateCollateralFactor: BigInt(assetInfo.liquidateCollateralFactor),
        supplyCap: BigInt(assetInfo.supplyCap),
      });
    }
  }

  return {
    baseSupplied,
    baseBorrowed,
    collaterals,
    totalCollateralValueUsd,
    borrowCapacityUsd,
    liquidationThresholdUsd,
    isLiquidatable,
  };
}
```

## Read Market Rates

```typescript
interface MarketRates {
  utilization: bigint;
  supplyRatePerSecond: bigint;
  borrowRatePerSecond: bigint;
  supplyApr: number;
  borrowApr: number;
  totalSupply: bigint;
  totalBorrow: bigint;
}

async function getMarketRates(comet: Address): Promise<MarketRates> {
  const utilization = await publicClient.readContract({
    address: comet,
    abi: cometAbi,
    functionName: "getUtilization",
  });

  const [supplyRate, borrowRate, totalSupply, totalBorrow] = await Promise.all([
    publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "getSupplyRate",
      args: [utilization],
    }),
    publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "getBorrowRate",
      args: [utilization],
    }),
    publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "totalSupply",
    }),
    publicClient.readContract({
      address: comet,
      abi: cometAbi,
      functionName: "totalBorrow",
    }),
  ]);

  // Rates are per-second, scaled by 1e18. Multiply by seconds per year for APR.
  const SECONDS_PER_YEAR = 31_536_000n;
  const supplyApr = Number(supplyRate * SECONDS_PER_YEAR) / 1e18;
  const borrowApr = Number(borrowRate * SECONDS_PER_YEAR) / 1e18;

  return {
    utilization,
    supplyRatePerSecond: supplyRate,
    borrowRatePerSecond: borrowRate,
    supplyApr,
    borrowApr,
    totalSupply,
    totalBorrow,
  };
}
```

## Read Accrued Rewards

```typescript
async function getAccruedRewards(
  comet: Address,
  userAddress: Address
): Promise<{ token: Address; owed: bigint }> {
  const result = await publicClient.readContract({
    address: COMET_REWARDS,
    abi: cometRewardsAbi,
    functionName: "getRewardOwed",
    args: [comet, userAddress],
  });

  return { token: result.token, owed: result.owed };
}
```

## Complete Usage

```typescript
async function main() {
  const userAddress = "0xYourAddress" as Address;

  // Read position
  const position = await getUserPosition(COMET_USDC, userAddress);

  console.log("=== User Position ===");
  console.log(`Base supplied: ${formatUnits(position.baseSupplied, 6)} USDC`);
  console.log(`Base borrowed: ${formatUnits(position.baseBorrowed, 6)} USDC`);
  console.log(`Liquidatable: ${position.isLiquidatable}`);
  console.log(
    `Total collateral value: ${formatUnits(position.totalCollateralValueUsd, 6)} USDC`
  );
  console.log(
    `Borrow capacity: ${formatUnits(position.borrowCapacityUsd, 6)} USDC`
  );
  console.log(
    `Liquidation threshold: ${formatUnits(position.liquidationThresholdUsd, 6)} USDC`
  );

  // Health ratio: liquidationThreshold / debt. > 1 = safe, < 1 = liquidatable
  if (position.baseBorrowed > 0n) {
    const healthRatio =
      Number(position.liquidationThresholdUsd) / Number(position.baseBorrowed);
    console.log(`Health ratio: ${healthRatio.toFixed(4)}`);
  }

  for (const col of position.collaterals) {
    console.log(
      `  Collateral ${col.asset}: balance=${col.balance}, value=${formatUnits(col.valueUsd, 6)} USDC`
    );
  }

  // Read market rates
  const rates = await getMarketRates(COMET_USDC);

  console.log("\n=== Market Rates ===");
  console.log(`Utilization: ${Number(rates.utilization) / 1e18 * 100}%`);
  console.log(`Supply APR: ${(rates.supplyApr * 100).toFixed(2)}%`);
  console.log(`Borrow APR: ${(rates.borrowApr * 100).toFixed(2)}%`);
  console.log(`Total Supply: ${formatUnits(rates.totalSupply, 6)} USDC`);
  console.log(`Total Borrow: ${formatUnits(rates.totalBorrow, 6)} USDC`);

  // Read accrued rewards
  const rewards = await getAccruedRewards(COMET_USDC, userAddress);
  console.log(`\nCOMP owed: ${formatUnits(rewards.owed, 18)}`);
}

main().catch(console.error);
```
