# Supply & Borrow Examples

Working TypeScript examples for Aave V3 supply, borrow, repay, and withdraw using viem.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  parseEther,
  maxUint256,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const POOL: Address = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const WETH_GATEWAY: Address = "0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C";
const WETH: Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC: Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

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
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    name: "borrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "referralCode", type: "uint16" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
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

const wethGatewayAbi = [
  {
    name: "depositETH",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "pool", type: "address" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    name: "withdrawETH",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pool", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [],
  },
] as const;
```

## Supply ETH via WETH Gateway

The WETH Gateway wraps ETH into WETH and supplies it to Aave in a single transaction.

```typescript
async function supplyETH(amountEther: string) {
  const hash = await walletClient.writeContract({
    address: WETH_GATEWAY,
    abi: wethGatewayAbi,
    functionName: "depositETH",
    args: [POOL, account.address, 0],
    value: parseEther(amountEther),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Supply ETH transaction reverted");
  }

  return receipt;
}

await supplyETH("1.0");
```

## Supply ERC20 Token

Two steps: approve the Pool to spend your tokens, then call `supply`.

```typescript
async function supplyERC20(asset: Address, amount: bigint) {
  const approveHash = await walletClient.writeContract({
    address: asset,
    abi: erc20Abi,
    functionName: "approve",
    args: [POOL, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const supplyHash = await walletClient.writeContract({
    address: POOL,
    abi: poolAbi,
    functionName: "supply",
    args: [asset, amount, account.address, 0],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: supplyHash });
  if (receipt.status !== "success") {
    throw new Error("Supply transaction reverted");
  }

  return receipt;
}

await supplyERC20(USDC, parseUnits("5000", 6));
```

## Borrow Tokens (Variable Rate)

Stable rate (1) is deprecated on most V3 markets. Always use variable rate (2).

```typescript
async function borrowVariable(asset: Address, amount: bigint) {
  const VARIABLE_RATE = 2n;

  const hash = await walletClient.writeContract({
    address: POOL,
    abi: poolAbi,
    functionName: "borrow",
    args: [asset, amount, VARIABLE_RATE, 0, account.address],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Borrow transaction reverted");
  }

  return receipt;
}

await borrowVariable(USDC, parseUnits("2000", 6));
```

## Repay Loan

Pass `maxUint256` as amount to repay the entire outstanding debt.

```typescript
async function repayDebt(asset: Address, amount: bigint) {
  const approveHash = await walletClient.writeContract({
    address: asset,
    abi: erc20Abi,
    functionName: "approve",
    args: [POOL, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const repayHash = await walletClient.writeContract({
    address: POOL,
    abi: poolAbi,
    functionName: "repay",
    args: [asset, amount, 2n, account.address],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: repayHash });
  if (receipt.status !== "success") {
    throw new Error("Repay transaction reverted");
  }

  return receipt;
}

// Repay exact amount
await repayDebt(USDC, parseUnits("2000", 6));

// Repay entire debt
await repayDebt(USDC, maxUint256);
```

## Withdraw Collateral

Pass `maxUint256` to withdraw entire supplied balance including accrued interest.

```typescript
async function withdraw(asset: Address, amount: bigint) {
  const hash = await walletClient.writeContract({
    address: POOL,
    abi: poolAbi,
    functionName: "withdraw",
    args: [asset, amount, account.address],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Withdraw transaction reverted");
  }

  return receipt;
}

await withdraw(USDC, maxUint256);
```

## Check Health Factor Before Borrowing

Always verify the position will remain safe after a new borrow. A health factor below 1.0 means liquidation.

```typescript
async function safeBorrow(asset: Address, amount: bigint, minHealthFactor = 1.5) {
  const [, , , , , healthFactor] = await publicClient.readContract({
    address: POOL,
    abi: poolAbi,
    functionName: "getUserAccountData",
    args: [account.address],
  });

  const currentHF = Number(healthFactor) / 1e18;
  console.log(`Current health factor: ${currentHF.toFixed(4)}`);

  if (currentHF < minHealthFactor) {
    throw new Error(
      `Health factor ${currentHF.toFixed(4)} is below minimum ${minHealthFactor}. ` +
      `Add collateral before borrowing.`
    );
  }

  // Simulate to catch reverts before spending gas
  await publicClient.simulateContract({
    address: POOL,
    abi: poolAbi,
    functionName: "borrow",
    args: [asset, amount, 2n, 0, account.address],
    account: account.address,
  });

  return borrowVariable(asset, amount);
}

await safeBorrow(USDC, parseUnits("1000", 6), 1.8);
```
