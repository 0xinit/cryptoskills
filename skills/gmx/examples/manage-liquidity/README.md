# Manage GM Token Liquidity on GMX V2

Add and remove liquidity from GMX V2 pools by buying and selling GM tokens on Arbitrum.

## Prerequisites

```bash
npm install viem
```

Environment variables:
- `ARBITRUM_RPC_URL` — Arbitrum RPC endpoint
- `PRIVATE_KEY` — Wallet private key (never hardcode)

## Background

Each GMX V2 market has its own GM (market) token representing a share of the pool's assets. The ETH/USD pool's GM token is different from the BTC/USD pool's GM token. LPs earn trading fees, borrowing fees, and funding fees paid by traders in the market.

## Step 1: Setup

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

const EXCHANGE_ROUTER = "0x69C527fC77291722b52649E45c838e41be8Bf5d5" as const;
const ROUTER = "0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6" as const;
const DEPOSIT_VAULT = "0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55" as const;
const WITHDRAWAL_VAULT = "0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701c55" as const;
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as const;
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const ETH_USD_MARKET = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336" as const;

const multicallAbi = [
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
] as const;

const createDepositAbi = [
  {
    name: "createDeposit",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "receiver", type: "address" },
          { name: "callbackContract", type: "address" },
          { name: "uiFeeReceiver", type: "address" },
          { name: "market", type: "address" },
          { name: "initialLongToken", type: "address" },
          { name: "initialShortToken", type: "address" },
          { name: "longTokenSwapPath", type: "address[]" },
          { name: "shortTokenSwapPath", type: "address[]" },
          { name: "minMarketTokens", type: "uint256" },
          { name: "shouldUnwrapNativeToken", type: "bool" },
          { name: "executionFee", type: "uint256" },
          { name: "callbackGasLimit", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const createWithdrawalAbi = [
  {
    name: "createWithdrawal",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "receiver", type: "address" },
          { name: "callbackContract", type: "address" },
          { name: "uiFeeReceiver", type: "address" },
          { name: "market", type: "address" },
          { name: "longTokenSwapPath", type: "address[]" },
          { name: "shortTokenSwapPath", type: "address[]" },
          { name: "minLongTokenAmount", type: "uint256" },
          { name: "minShortTokenAmount", type: "uint256" },
          { name: "shouldUnwrapNativeToken", type: "bool" },
          { name: "executionFee", type: "uint256" },
          { name: "callbackGasLimit", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const executionFee = parseEther("0.001");
```

## Step 2: Buy GM Tokens with ETH (Single-sided Deposit)

Deposit ETH as the long token into the ETH/USD pool.

```typescript
const depositAmount = parseEther("1");

const sendWntDeposit = encodeFunctionData({
  abi: multicallAbi,
  functionName: "sendWnt",
  args: [DEPOSIT_VAULT, depositAmount + executionFee],
});

const createDepositData = encodeFunctionData({
  abi: createDepositAbi,
  functionName: "createDeposit",
  args: [
    {
      receiver: account.address,
      callbackContract: "0x0000000000000000000000000000000000000000",
      uiFeeReceiver: "0x0000000000000000000000000000000000000000",
      market: ETH_USD_MARKET,
      initialLongToken: WETH,
      initialShortToken: "0x0000000000000000000000000000000000000000",
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
      minMarketTokens: 0n, // set to expected GM amount minus slippage in production
      shouldUnwrapNativeToken: false,
      executionFee,
      callbackGasLimit: 0n,
    },
  ],
});

const depositHash = await walletClient.writeContract({
  address: EXCHANGE_ROUTER,
  abi: multicallAbi,
  functionName: "multicall",
  args: [[sendWntDeposit, createDepositData]],
  value: depositAmount + executionFee,
});

const depositReceipt = await publicClient.waitForTransactionReceipt({
  hash: depositHash,
});
console.log("Deposit order created:", depositReceipt.transactionHash);
```

## Step 3: Buy GM Tokens with USDC (Single-sided Deposit)

```typescript
const usdcDepositAmount = 5000_000_000n; // 5000 USDC (6 decimals)

// Approve USDC to Router (one-time)
const approvalHash = await walletClient.writeContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "approve",
  args: [ROUTER, 2n ** 256n - 1n],
});
await publicClient.waitForTransactionReceipt({ hash: approvalHash });

const sendWntFee = encodeFunctionData({
  abi: multicallAbi,
  functionName: "sendWnt",
  args: [DEPOSIT_VAULT, executionFee],
});

const sendUsdcDeposit = encodeFunctionData({
  abi: multicallAbi,
  functionName: "sendTokens",
  args: [USDC, DEPOSIT_VAULT, usdcDepositAmount],
});

const createUsdcDepositData = encodeFunctionData({
  abi: createDepositAbi,
  functionName: "createDeposit",
  args: [
    {
      receiver: account.address,
      callbackContract: "0x0000000000000000000000000000000000000000",
      uiFeeReceiver: "0x0000000000000000000000000000000000000000",
      market: ETH_USD_MARKET,
      initialLongToken: "0x0000000000000000000000000000000000000000",
      initialShortToken: USDC,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
      minMarketTokens: 0n,
      shouldUnwrapNativeToken: false,
      executionFee,
      callbackGasLimit: 0n,
    },
  ],
});

const usdcDepositHash = await walletClient.writeContract({
  address: EXCHANGE_ROUTER,
  abi: multicallAbi,
  functionName: "multicall",
  args: [[sendWntFee, sendUsdcDeposit, createUsdcDepositData]],
  value: executionFee,
});

console.log("USDC deposit order created:", usdcDepositHash);
```

## Step 4: Sell GM Tokens (Remove Liquidity)

Redeem GM tokens to receive the underlying long and short tokens.

```typescript
const gmTokenAmount = parseEther("100"); // amount of GM tokens to redeem

// Approve GM token spending to Router
const gmApproval = await walletClient.writeContract({
  address: ETH_USD_MARKET,
  abi: erc20Abi,
  functionName: "approve",
  args: [ROUTER, 2n ** 256n - 1n],
});
await publicClient.waitForTransactionReceipt({ hash: gmApproval });

const sendWntWithdraw = encodeFunctionData({
  abi: multicallAbi,
  functionName: "sendWnt",
  args: [WITHDRAWAL_VAULT, executionFee],
});

const sendGmTokens = encodeFunctionData({
  abi: multicallAbi,
  functionName: "sendTokens",
  args: [ETH_USD_MARKET, WITHDRAWAL_VAULT, gmTokenAmount],
});

const createWithdrawalData = encodeFunctionData({
  abi: createWithdrawalAbi,
  functionName: "createWithdrawal",
  args: [
    {
      receiver: account.address,
      callbackContract: "0x0000000000000000000000000000000000000000",
      uiFeeReceiver: "0x0000000000000000000000000000000000000000",
      market: ETH_USD_MARKET,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
      minLongTokenAmount: 0n, // set slippage protection in production
      minShortTokenAmount: 0n,
      shouldUnwrapNativeToken: true, // receive ETH instead of WETH
      executionFee,
      callbackGasLimit: 0n,
    },
  ],
});

const withdrawHash = await walletClient.writeContract({
  address: EXCHANGE_ROUTER,
  abi: multicallAbi,
  functionName: "multicall",
  args: [[sendWntWithdraw, sendGmTokens, createWithdrawalData]],
  value: executionFee,
});

const withdrawReceipt = await publicClient.waitForTransactionReceipt({
  hash: withdrawHash,
});
console.log("Withdrawal order created:", withdrawReceipt.transactionHash);
```

## Step 5: Check GM Token Balance

```typescript
const gmBalance = await publicClient.readContract({
  address: ETH_USD_MARKET,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account.address],
});

console.log("GM token balance:", gmBalance);
```

## Key Points

- **Deposits and withdrawals are asynchronous** — like trading orders, they are created and executed by keepers in separate transactions
- **Single-sided deposits** use only the long token OR short token. Set the unused token address to `address(0)`.
- **Dual-sided deposits** provide both long and short tokens simultaneously — this reduces price impact
- **`minMarketTokens`** for deposits and `minLongTokenAmount`/`minShortTokenAmount` for withdrawals provide slippage protection
- **GM tokens are ERC-20** — each market's GM token is a standard ERC-20 at the market token address
- **Approve to Router, not ExchangeRouter** — the Router contract handles token transfers via `sendTokens`
- **Price impact** applies to deposits/withdrawals that shift the pool's long/short token ratio away from the target
