# Swap Tokens via Brian API

End-to-end example: convert a natural language swap intent into an executed on-chain transaction using Brian API and viem.

## Prerequisites

```bash
npm install @brian-ai/sdk viem
```

Environment variables:

```bash
export BRIAN_API_KEY="brian_..."
export PRIVATE_KEY="0x..."
export RPC_URL="https://mainnet.base.org"
```

## Step 1: Initialize Brian SDK and Wallet

```typescript
import { BrianSDK } from "@brian-ai/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const brian = new BrianSDK({
  apiKey: process.env.BRIAN_API_KEY!,
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.RPC_URL),
});
```

## Step 2: Get Transaction Calldata from Brian

```typescript
const prompt = "Swap 10 USDC for ETH on Base";

const response = await brian.transact({
  prompt,
  address: account.address,
  chainId: "8453",
});

console.log(`Brian returned ${response.length} result(s)`);
console.log(`Action: ${response[0].action}`);
console.log(`Solver: ${response[0].solver}`);
console.log(`Steps: ${response[0].data.steps.length}`);
```

### Expected Output

```
Brian returned 1 result(s)
Action: swap
Solver: Enso
Steps: 2
```

Step 0 is the USDC approval, step 1 is the swap itself.

## Step 3: Execute All Steps

```typescript
for (let i = 0; i < response[0].data.steps.length; i++) {
  const step = response[0].data.steps[i];

  console.log(`Executing step ${i}: ${step.to}`);

  const hash = await walletClient.sendTransaction({
    to: step.to as `0x${string}`,
    data: step.data as `0x${string}`,
    value: BigInt(step.value),
    gas: step.gasLimit ? BigInt(step.gasLimit) : undefined,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`Step ${i} failed: ${hash}`);
  }

  console.log(`Step ${i} confirmed: ${hash}`);
}
```

## Step 4: Verify the Swap

```typescript
import { erc20Abi } from "viem";

const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const usdcBalance = await publicClient.readContract({
  address: usdcAddress,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account.address],
});

const ethBalance = await publicClient.getBalance({
  address: account.address,
});

console.log(`USDC balance: ${usdcBalance}`);
console.log(`ETH balance: ${ethBalance}`);
```

## Full Script

```typescript
import { BrianSDK } from "@brian-ai/sdk";
import { createPublicClient, createWalletClient, http, erc20Abi } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function swapWithBrian() {
  const brian = new BrianSDK({
    apiKey: process.env.BRIAN_API_KEY!,
  });

  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.RPC_URL),
  });

  const response = await brian.transact({
    prompt: "Swap 10 USDC for ETH on Base",
    address: account.address,
    chainId: "8453",
  });

  if (!response || response.length === 0) {
    throw new Error("Brian returned no results");
  }

  const result = response[0];
  console.log(`Action: ${result.action} via ${result.solver}`);
  console.log(`From: ${result.data.fromAmount} ${result.data.fromToken.symbol}`);
  console.log(`To: ~${result.data.toAmount} ${result.data.toToken.symbol}`);

  for (let i = 0; i < result.data.steps.length; i++) {
    const step = result.data.steps[i];
    const hash = await walletClient.sendTransaction({
      to: step.to as `0x${string}`,
      data: step.data as `0x${string}`,
      value: BigInt(step.value),
      gas: step.gasLimit ? BigInt(step.gasLimit) : undefined,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Step ${i} reverted: ${hash}`);
    }
    console.log(`Step ${i} confirmed: ${hash}`);
  }

  console.log("Swap complete");
}

swapWithBrian().catch(console.error);
```

## Common Variations

### Swap with slippage consideration

Brian handles slippage via solver defaults. If you need tighter control, inspect `result.data.toAmount` before executing:

```typescript
const result = response[0];
const expectedOut = BigInt(result.data.toAmount);
// 1% slippage tolerance — abort if output seems unreasonable
const minAcceptable = (expectedOut * 99n) / 100n;

console.log(`Expected output: ${expectedOut}`);
console.log(`Minimum acceptable: ${minAcceptable}`);
```

### Swap native ETH for an ERC-20

When swapping from native ETH, the `value` field in the step will be non-zero and there is no approval step:

```typescript
const response = await brian.transact({
  prompt: "Swap 0.1 ETH for USDC on Base",
  address: account.address,
  chainId: "8453",
});

// Typically 1 step (no approval needed for native ETH)
console.log(`Steps: ${response[0].data.steps.length}`);
```

Last verified: February 2026
