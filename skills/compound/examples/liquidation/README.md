# Liquidation Example

Monitor and execute Compound V3 liquidations using `absorb()` and `buyCollateral()`.

## How Compound V3 Liquidation Works

Unlike V2 where liquidators atomically repay debt and seize collateral, V3 uses a two-step process:

1. **`absorb()`** — Anyone calls this on a liquidatable account. The protocol seizes the position, clearing the borrower's debt and taking their collateral into protocol reserves. The absorber receives no direct token reward.
2. **`buyCollateral()`** — After absorption, anyone can purchase the seized collateral from the protocol at a discount by paying the base asset. This is the profit opportunity.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const COMET_USDC = "0xc3d688B66703497DAA19211EEdff47f25384cdc3" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
```

## ABIs

```typescript
const cometAbi = [
  {
    name: "isLiquidatable",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "absorb",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "absorber", type: "address" },
      { name: "accounts", type: "address[]" },
    ],
    outputs: [],
  },
  {
    name: "buyCollateral",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "minAmount", type: "uint256" },
      { name: "baseAmount", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "quoteCollateral",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "asset", type: "address" },
      { name: "baseAmount", type: "uint256" },
    ],
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
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "priceFeed", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

## Check if Account is Liquidatable

```typescript
async function checkLiquidatable(borrower: Address): Promise<boolean> {
  return publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "isLiquidatable",
    args: [borrower],
  });
}
```

## Get Liquidation Details

```typescript
interface LiquidationOpportunity {
  borrower: Address;
  debtAmount: bigint;
  collaterals: { asset: Address; balance: bigint; valueUsd: bigint }[];
}

async function getLiquidationDetails(
  borrower: Address
): Promise<LiquidationOpportunity> {
  const debtAmount = await publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "borrowBalanceOf",
    args: [borrower],
  });

  const numAssets = await publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "numAssets",
  });

  const collaterals: LiquidationOpportunity["collaterals"] = [];

  for (let i = 0; i < numAssets; i++) {
    const assetInfo = await publicClient.readContract({
      address: COMET_USDC,
      abi: cometAbi,
      functionName: "getAssetInfo",
      args: [i],
    });

    const balance = await publicClient.readContract({
      address: COMET_USDC,
      abi: cometAbi,
      functionName: "collateralBalanceOf",
      args: [borrower, assetInfo.asset],
    });

    if (balance > 0n) {
      const price = await publicClient.readContract({
        address: COMET_USDC,
        abi: cometAbi,
        functionName: "getPrice",
        args: [assetInfo.priceFeed],
      });

      // price is 8-decimal Chainlink format, scale normalizes to base decimals
      const valueUsd = (BigInt(balance) * price) / BigInt(assetInfo.scale);

      collaterals.push({
        asset: assetInfo.asset,
        balance: BigInt(balance),
        valueUsd,
      });
    }
  }

  return { borrower, debtAmount, collaterals };
}
```

## Execute Liquidation

### Step 1: Absorb

```typescript
async function absorbAccount(borrower: Address): Promise<`0x${string}`> {
  const isLiquidatable = await checkLiquidatable(borrower);
  if (!isLiquidatable) {
    throw new Error(`Account ${borrower} is not liquidatable`);
  }

  const { request } = await publicClient.simulateContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "absorb",
    args: [account.address, [borrower]],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Absorb reverted");

  return hash;
}
```

### Step 2: Buy Collateral at Discount

```typescript
async function buyDiscountedCollateral(
  collateralAsset: Address,
  baseAmountToPay: bigint,
  slippageBps: bigint
): Promise<`0x${string}`> {
  // Quote how much collateral we receive
  const collateralOut = await publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "quoteCollateral",
    args: [collateralAsset, baseAmountToPay],
  });

  if (collateralOut === 0n) {
    throw new Error("No collateral available for purchase");
  }

  // Apply slippage protection
  const minCollateralOut = collateralOut - (collateralOut * slippageBps) / 10000n;

  // Approve Comet to pull base asset (USDC)
  const approveHash = await walletClient.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [COMET_USDC, baseAmountToPay],
  });
  const approveReceipt = await publicClient.waitForTransactionReceipt({
    hash: approveHash,
  });
  if (approveReceipt.status !== "success") throw new Error("Approval failed");

  // Buy collateral
  const { request } = await publicClient.simulateContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "buyCollateral",
    args: [collateralAsset, minCollateralOut, baseAmountToPay, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("buyCollateral reverted");

  return hash;
}
```

## Complete Liquidation Flow

```typescript
async function liquidate(borrower: Address) {
  // 1. Verify account is liquidatable
  const details = await getLiquidationDetails(borrower);
  console.log(`Debt: ${formatUnits(details.debtAmount, 6)} USDC`);

  for (const col of details.collaterals) {
    console.log(`Collateral ${col.asset}: ${col.balance} (value: ${formatUnits(col.valueUsd, 6)} USDC)`);
  }

  // 2. Absorb the position
  const absorbHash = await absorbAccount(borrower);
  console.log(`Absorbed: ${absorbHash}`);

  // 3. Buy each collateral type at discount
  for (const col of details.collaterals) {
    // Use the full USDC value as the base amount to buy all available collateral
    // In practice, you may want to buy partial amounts based on your capital
    const buyHash = await buyDiscountedCollateral(
      col.asset,
      col.valueUsd, // base amount in USDC (6 decimals)
      100n // 1% slippage tolerance
    );
    console.log(`Bought ${col.asset} collateral: ${buyHash}`);
  }
}

// Example: liquidate a specific underwater account
const UNDERWATER_ACCOUNT = "0x..." as Address;
liquidate(UNDERWATER_ACCOUNT).catch(console.error);
```

## Profit Calculation

The discount on `buyCollateral()` comes from the `storeFrontPriceFactor` configuration, which is typically set to give buyers a ~5-10% discount versus oracle price. The exact discount depends on governance configuration for each market.

```typescript
async function estimateProfit(
  collateralAsset: Address,
  baseAmount: bigint
): Promise<{ collateralReceived: bigint; marketValue: bigint; profitBps: bigint }> {
  const collateralReceived = await publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "quoteCollateral",
    args: [collateralAsset, baseAmount],
  });

  const assetInfo = await publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "getAssetInfoByAddress",
    args: [collateralAsset],
  });

  const price = await publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "getPrice",
    args: [assetInfo.priceFeed],
  });

  // Market value of the collateral we would receive
  const marketValue = (collateralReceived * price) / BigInt(assetInfo.scale);

  // Profit in basis points: ((marketValue - baseAmount) / baseAmount) * 10000
  const profitBps = marketValue > baseAmount
    ? ((marketValue - baseAmount) * 10000n) / baseAmount
    : 0n;

  return { collateralReceived, marketValue, profitBps };
}
```

## Additional ABI (for profit calculation)

```typescript
const getAssetInfoByAddressAbi = [
  {
    name: "getAssetInfoByAddress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
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
] as const;
```
