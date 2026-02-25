# Supply & Borrow Example

Supply USDC as the base asset to earn interest, supply WETH as collateral, and borrow USDC against it on Compound V3 (Comet).

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
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

// Ethereum mainnet USDC market
const COMET_USDC = "0xc3d688B66703497DAA19211EEdff47f25384cdc3" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
```

## ABIs

```typescript
const cometAbi = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
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

## Token Approval Helper

```typescript
async function approveToken(
  token: Address,
  spender: Address,
  amount: bigint
): Promise<void> {
  const { request } = await publicClient.simulateContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Approval failed for ${token}`);
}
```

## Supply Base Asset (Earn Interest)

Supplying the base asset (USDC) to the Comet earns interest. This is the lending side.

```typescript
async function supplyBaseAsset(amount: bigint): Promise<`0x${string}`> {
  // Approve Comet to pull USDC
  await approveToken(USDC, COMET_USDC, amount);

  // Simulate before executing
  const { request } = await publicClient.simulateContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "supply",
    args: [USDC, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Supply base asset reverted");

  return hash;
}
```

## Supply Collateral (No Interest)

Supplying a non-base asset (e.g., WETH) posts it as collateral. Collateral does NOT earn interest.

```typescript
async function supplyCollateral(
  collateralAsset: Address,
  amount: bigint
): Promise<`0x${string}`> {
  await approveToken(collateralAsset, COMET_USDC, amount);

  const { request } = await publicClient.simulateContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "supply",
    args: [collateralAsset, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Supply collateral reverted");

  return hash;
}
```

## Borrow Base Asset

Borrow the base asset (USDC) by calling `withdraw()` when you have collateral but no base supply. The withdraw creates a negative base balance (i.e., a borrow).

```typescript
async function borrowBaseAsset(amount: bigint): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "withdraw",
    args: [USDC, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Borrow reverted");

  return hash;
}
```

## Complete Usage

```typescript
async function main() {
  // Step 1: Supply 10,000 USDC as base asset (earns interest)
  const supplyBaseHash = await supplyBaseAsset(parseUnits("10000", 6));
  console.log(`Supplied 10,000 USDC: ${supplyBaseHash}`);

  // Check base balance
  const baseBalance = await publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`Base balance: ${Number(baseBalance) / 1e6} USDC`);

  // Step 2: Supply 5 WETH as collateral (no interest)
  const supplyCollateralHash = await supplyCollateral(WETH, parseUnits("5", 18));
  console.log(`Supplied 5 WETH collateral: ${supplyCollateralHash}`);

  // Check collateral balance
  const collateralBalance = await publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "collateralBalanceOf",
    args: [account.address, WETH],
  });
  console.log(`WETH collateral: ${Number(collateralBalance) / 1e18}`);

  // Step 3: Borrow 3,000 USDC against WETH collateral
  const borrowHash = await borrowBaseAsset(parseUnits("3000", 6));
  console.log(`Borrowed 3,000 USDC: ${borrowHash}`);

  // Check borrow balance
  const borrowBalance = await publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "borrowBalanceOf",
    args: [account.address],
  });
  console.log(`Borrow balance: ${Number(borrowBalance) / 1e6} USDC`);

  // Check liquidation status
  const liquidatable = await publicClient.readContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "isLiquidatable",
    args: [account.address],
  });
  console.log(`Liquidatable: ${liquidatable}`);
}

main().catch(console.error);
```
