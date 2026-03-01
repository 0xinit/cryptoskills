# Spot Swap on GMX V2

Swap USDC for ETH through the GMX V2 ExchangeRouter on Arbitrum. Uses `OrderType.MarketSwap` with the multicall pattern.

## Prerequisites

```bash
npm install viem
```

Environment variables:
- `ARBITRUM_RPC_URL` — Arbitrum RPC endpoint
- `PRIVATE_KEY` — Wallet private key (never hardcode)

## Step 1: Setup Client

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseEther,
  erc20Abi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});
```

## Step 2: Define Contracts and ABI

```typescript
const EXCHANGE_ROUTER = "0x69C527fC77291722b52649E45c838e41be8Bf5d5" as const;
const ROUTER = "0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6" as const;
const ORDER_VAULT = "0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5" as const;
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as const;
const ETH_USD_MARKET = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336" as const;

const exchangeRouterAbi = [
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    name: "sendWnt",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "sendTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "receiver", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "createOrder",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "addresses",
            type: "tuple",
            components: [
              { name: "receiver", type: "address" },
              { name: "cancellationReceiver", type: "address" },
              { name: "callbackContract", type: "address" },
              { name: "uiFeeReceiver", type: "address" },
              { name: "market", type: "address" },
              { name: "initialCollateralToken", type: "address" },
              { name: "swapPath", type: "address[]" },
            ],
          },
          {
            name: "numbers",
            type: "tuple",
            components: [
              { name: "sizeDeltaUsd", type: "uint256" },
              { name: "initialCollateralDeltaAmount", type: "uint256" },
              { name: "triggerPrice", type: "uint256" },
              { name: "acceptablePrice", type: "uint256" },
              { name: "executionFee", type: "uint256" },
              { name: "callbackGasLimit", type: "uint256" },
              { name: "minOutputAmount", type: "uint256" },
            ],
          },
          { name: "orderType", type: "uint8" },
          { name: "decreasePositionSwapType", type: "uint8" },
          { name: "isLong", type: "bool" },
          { name: "shouldUnwrapNativeToken", type: "bool" },
          { name: "autoCancel", type: "bool" },
          { name: "referralCode", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;
```

## Step 3: Approve USDC to Router

Token approvals go to the Router contract, not ExchangeRouter.

```typescript
const allowance = await publicClient.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "allowance",
  args: [account.address, ROUTER],
});

const swapAmount = 1000_000_000n; // 1000 USDC (6 decimals)

if (allowance < swapAmount) {
  const approvalHash = await walletClient.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [ROUTER, 2n ** 256n - 1n],
  });
  await publicClient.waitForTransactionReceipt({ hash: approvalHash });
}
```

## Step 4: Build and Submit Swap Order

```typescript
const executionFee = parseEther("0.001");

// Minimum output protection — in production, calculate from oracle price minus slippage
const minOutputAmount = 0n;

const sendWntData = encodeFunctionData({
  abi: exchangeRouterAbi,
  functionName: "sendWnt",
  args: [ORDER_VAULT, executionFee],
});

const sendTokensData = encodeFunctionData({
  abi: exchangeRouterAbi,
  functionName: "sendTokens",
  args: [USDC, ORDER_VAULT, swapAmount],
});

const createOrderData = encodeFunctionData({
  abi: exchangeRouterAbi,
  functionName: "createOrder",
  args: [
    {
      addresses: {
        receiver: account.address,
        cancellationReceiver: account.address,
        callbackContract: "0x0000000000000000000000000000000000000000",
        uiFeeReceiver: "0x0000000000000000000000000000000000000000",
        market: ETH_USD_MARKET,
        initialCollateralToken: USDC,
        swapPath: [ETH_USD_MARKET],
      },
      numbers: {
        sizeDeltaUsd: 0n,
        initialCollateralDeltaAmount: 0n,
        triggerPrice: 0n,
        acceptablePrice: 0n,
        executionFee,
        callbackGasLimit: 0n,
        minOutputAmount,
      },
      orderType: 0, // MarketSwap
      decreasePositionSwapType: 0,
      isLong: false,
      shouldUnwrapNativeToken: true, // receive ETH instead of WETH
      autoCancel: false,
      referralCode:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
    },
  ],
});

const hash = await walletClient.writeContract({
  address: EXCHANGE_ROUTER,
  abi: exchangeRouterAbi,
  functionName: "multicall",
  args: [[sendWntData, sendTokensData, createOrderData]],
  value: executionFee,
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("Order created:", receipt.transactionHash);
console.log("Status:", receipt.status);
```

## Key Points

- **Three multicall steps**: `sendWnt` (execution fee to OrderVault) + `sendTokens` (USDC to OrderVault) + `createOrder`
- **`swapPath`** must include the market token address of the pool used for the swap
- **`shouldUnwrapNativeToken: true`** receives native ETH; `false` receives WETH
- **`minOutputAmount`** protects against slippage — set this based on current oracle price in production
- **Execution is asynchronous** — the order is created in this transaction and executed by a keeper in a subsequent transaction
- The returned transaction hash is for order _creation_, not execution
