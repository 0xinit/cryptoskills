# Open a Perpetual Position on GMX V2

Open a leveraged long ETH position on Arbitrum using the ExchangeRouter multicall pattern. Uses `OrderType.MarketIncrease`.

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

## Step 2: Define Constants

```typescript
const EXCHANGE_ROUTER = "0x69C527fC77291722b52649E45c838e41be8Bf5d5" as const;
const ORDER_VAULT = "0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5" as const;
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as const;
const ETH_USD_MARKET = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336" as const;

// GMX uses 30-decimal precision for USD values
const USD_DECIMALS = 30n;
const toUsd30 = (usd: number) => BigInt(Math.round(usd * 1e6)) * 10n ** 24n;

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

## Step 3: Open Long Position with ETH Collateral

This opens a 10x long ETH/USD position using 0.5 ETH as collateral.

```typescript
const collateral = parseEther("0.5");
const executionFee = parseEther("0.001");
const positionSizeUsd = toUsd30(5000); // $5,000 position

// sendWnt sends both collateral AND execution fee in one call
const sendWntData = encodeFunctionData({
  abi: exchangeRouterAbi,
  functionName: "sendWnt",
  args: [ORDER_VAULT, collateral + executionFee],
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
        initialCollateralToken: WETH,
        swapPath: [],
      },
      numbers: {
        sizeDeltaUsd: positionSizeUsd,
        initialCollateralDeltaAmount: 0n,
        triggerPrice: 0n,
        // Max acceptable price for longs — protection against adverse execution
        acceptablePrice: BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
        executionFee,
        callbackGasLimit: 0n,
        minOutputAmount: 0n,
      },
      orderType: 2, // MarketIncrease
      decreasePositionSwapType: 0,
      isLong: true,
      shouldUnwrapNativeToken: false,
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
  args: [[sendWntData, createOrderData]],
  value: collateral + executionFee,
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("Long position order created:", receipt.transactionHash);
```

## Step 4: Open Short Position with USDC Collateral

Short positions use the market's short collateral token (typically USDC).

```typescript
import { erc20Abi } from "viem";

const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const ROUTER = "0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6" as const;

const shortCollateral = 2000_000_000n; // 2000 USDC (6 decimals)
const shortSizeUsd = toUsd30(20000); // $20,000 position (10x on $2000 collateral)

// Approve USDC to Router (one-time)
await walletClient.writeContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "approve",
  args: [ROUTER, 2n ** 256n - 1n],
});

const sendWntShort = encodeFunctionData({
  abi: exchangeRouterAbi,
  functionName: "sendWnt",
  args: [ORDER_VAULT, executionFee],
});

const sendUsdcData = encodeFunctionData({
  abi: [
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
  ],
  functionName: "sendTokens",
  args: [USDC, ORDER_VAULT, shortCollateral],
});

const shortOrderData = encodeFunctionData({
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
        swapPath: [],
      },
      numbers: {
        sizeDeltaUsd: shortSizeUsd,
        initialCollateralDeltaAmount: 0n,
        triggerPrice: 0n,
        // Min acceptable price for shorts — 0 means accept any price
        acceptablePrice: 0n,
        executionFee,
        callbackGasLimit: 0n,
        minOutputAmount: 0n,
      },
      orderType: 2, // MarketIncrease
      decreasePositionSwapType: 0,
      isLong: false,
      shouldUnwrapNativeToken: false,
      autoCancel: false,
      referralCode:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
    },
  ],
});

const shortHash = await walletClient.writeContract({
  address: EXCHANGE_ROUTER,
  abi: exchangeRouterAbi,
  functionName: "multicall",
  args: [[sendWntShort, sendUsdcData, shortOrderData]],
  value: executionFee,
});

const shortReceipt = await publicClient.waitForTransactionReceipt({
  hash: shortHash,
});
console.log("Short position order created:", shortReceipt.transactionHash);
```

## Key Points

- **Leverage is derived, not set**: leverage = `sizeDeltaUsd / (collateralValue in USD)`. There is no leverage parameter.
- **For ETH collateral longs**: send ETH via `sendWnt` to OrderVault — covers both collateral and execution fee in one call
- **For ERC-20 collateral (shorts)**: use `sendTokens` for collateral + separate `sendWnt` for execution fee
- **`acceptablePrice`**: for longs, set to a very high number (max price you accept). For shorts, set to 0 or a very low number (min price you accept). This is slippage protection.
- **`swapPath: []`** when collateral token matches the market's long/short token. Use a swap path if the collateral needs to be converted.
- **Max leverage varies by market**: ETH/USD supports up to 100x. Check market config for limits.
