# E-Mode (Efficiency Mode) Examples

E-Mode lets users achieve higher capital efficiency when borrowing and supplying correlated assets. For example, supply USDC and borrow USDT at 97% LTV instead of the default 75%.

## Setup

```typescript
import { createPublicClient, createWalletClient, http, parseUnits, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const POOL: Address = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const POOL_DATA_PROVIDER: Address = "0x7B4EB56E7CD4b454BA8ff71E4518426c9e3634AE";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const poolAbi = [
  {
    name: "setUserEMode",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "categoryId", type: "uint8" }],
    outputs: [],
  },
  {
    name: "getUserEMode",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getEModeCategoryData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint8" }],
    outputs: [
      { name: "ltv", type: "uint16" },
      { name: "liquidationThreshold", type: "uint16" },
      { name: "liquidationBonus", type: "uint16" },
      { name: "priceSource", type: "address" },
      { name: "label", type: "string" },
    ],
  },
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;
```

## Checking Available E-Mode Categories

Category IDs and parameters vary by chain and market. Query on-chain to get the current values.

```typescript
async function getEModeCategoryInfo(categoryId: number) {
  const [ltv, liquidationThreshold, liquidationBonus, priceSource, label] =
    await publicClient.readContract({
      address: POOL,
      abi: poolAbi,
      functionName: "getEModeCategoryData",
      args: [categoryId],
    });

  return {
    categoryId,
    label,
    ltv: Number(ltv) / 100,
    liquidationThreshold: Number(liquidationThreshold) / 100,
    // Liquidation bonus is stored as 10000 + bonus bps (e.g. 10100 = 1% bonus)
    liquidationBonus: (Number(liquidationBonus) - 10000) / 100,
    priceSource,
  };
}

// Scan known category IDs
const KNOWN_CATEGORIES = [0, 1, 2];

for (const id of KNOWN_CATEGORIES) {
  const info = await getEModeCategoryInfo(id);
  if (info.label) {
    console.log(`Category ${id}: ${info.label}`);
    console.log(`  LTV: ${info.ltv}%`);
    console.log(`  Liquidation Threshold: ${info.liquidationThreshold}%`);
    console.log(`  Liquidation Bonus: ${info.liquidationBonus}%`);
  }
}
```

## Setting User E-Mode Category

```typescript
async function setEMode(categoryId: number) {
  const hash = await walletClient.writeContract({
    address: POOL,
    abi: poolAbi,
    functionName: "setUserEMode",
    args: [categoryId],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("setUserEMode transaction reverted");
  }

  return receipt;
}

async function getCurrentEMode(user: Address): Promise<number> {
  const mode = await publicClient.readContract({
    address: POOL,
    abi: poolAbi,
    functionName: "getUserEMode",
    args: [user],
  });

  return Number(mode);
}

// Enable stablecoin E-Mode
await setEMode(1);

const currentMode = await getCurrentEMode(account.address);
console.log(`Current E-Mode: ${currentMode}`);
```

## E-Mode Benefits Comparison

```typescript
async function compareEModeBenefit(user: Address, targetCategory: number) {
  const [, , availableBorrowsBefore, , ltvBefore, hfBefore] =
    await publicClient.readContract({
      address: POOL,
      abi: poolAbi,
      functionName: "getUserAccountData",
      args: [user],
    });

  const categoryInfo = await getEModeCategoryInfo(targetCategory);

  const borrowCapacityBefore = Number(availableBorrowsBefore) / 1e8;
  const ltvPctBefore = Number(ltvBefore) / 100;

  console.log("=== Without E-Mode ===");
  console.log(`LTV: ${ltvPctBefore}%`);
  console.log(`Available borrows: $${borrowCapacityBefore.toFixed(2)}`);
  console.log(`Health Factor: ${(Number(hfBefore) / 1e18).toFixed(4)}`);

  console.log(`\n=== With E-Mode (${categoryInfo.label}) ===`);
  console.log(`LTV: ${categoryInfo.ltv}%`);
  console.log(`Liquidation Threshold: ${categoryInfo.liquidationThreshold}%`);
  console.log(`Liquidation Bonus: ${categoryInfo.liquidationBonus}%`);
}

await compareEModeBenefit(account.address, 1);
```

## Correlated Asset Strategies

### Stablecoin E-Mode (Category 1)

Supply USDC, borrow USDT at ~97% LTV. Useful for yield farming or bridging stablecoin liquidity.

```typescript
const USDC: Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDT: Address = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

async function stablecoinLeverageLoop() {
  // 1. Enable stablecoin E-Mode
  await setEMode(1);

  // 2. Supply USDC as collateral (assume already approved)
  const supplyAmount = parseUnits("10000", 6);
  await walletClient.writeContract({
    address: POOL,
    abi: [poolAbi[0]], // supply
    functionName: "supply",
    args: [USDC, supplyAmount, account.address, 0],
  });

  // 3. Borrow USDT at high LTV (only assets in the E-Mode category are borrowable)
  const borrowAmount = parseUnits("9500", 6); // ~95% of collateral
  await walletClient.writeContract({
    address: POOL,
    abi: [poolAbi[1]], // borrow
    functionName: "borrow",
    args: [USDT, borrowAmount, 2n, 0, account.address],
  });
}
```

### ETH Correlated E-Mode (Category 2)

Supply wstETH, borrow WETH at ~93% LTV. The oracle uses an ETH-denominated price source so the position is protected from ETH/USD volatility.

```typescript
const WSTETH: Address = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";
const WETH: Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

async function ethCorrelatedStrategy() {
  // Enable ETH correlated E-Mode
  await setEMode(2);

  // Supply wstETH, borrow WETH
  // Since wstETH/WETH price ratio is stable (~1.15:1 due to staking rewards),
  // liquidation risk is minimal.
}
```

## Disabling E-Mode

Setting E-Mode back to 0 reverts to default LTV/threshold. This will **revert** if the position would become undercollateralized under default parameters.

```typescript
async function disableEModeSafely(user: Address) {
  const [, totalDebtBase, , , , healthFactor] = await publicClient.readContract({
    address: POOL,
    abi: poolAbi,
    functionName: "getUserAccountData",
    args: [user],
  });

  if (totalDebtBase === 0n) {
    await setEMode(0);
    return;
  }

  // Simulate disabling E-Mode to check if position stays healthy
  try {
    await publicClient.simulateContract({
      address: POOL,
      abi: poolAbi,
      functionName: "setUserEMode",
      args: [0],
      account: user,
    });
    await setEMode(0);
  } catch {
    const hf = Number(healthFactor) / 1e18;
    throw new Error(
      `Cannot disable E-Mode: position would be undercollateralized. ` +
      `Current HF: ${hf.toFixed(4)}. Repay debt first.`
    );
  }
}
```
