# Bridge Tokens via Brian API

End-to-end example: bridge tokens across chains using a natural language prompt. Demonstrates both same-token bridging and cross-chain swaps.

## Prerequisites

```bash
npm install @brian-ai/sdk viem
```

Environment variables:

```bash
export BRIAN_API_KEY="brian_..."
export PRIVATE_KEY="0x..."
export ETH_RPC_URL="https://eth.llamarpc.com"
export BASE_RPC_URL="https://mainnet.base.org"
```

## Step 1: Bridge ETH from Ethereum to Base

```typescript
import { BrianSDK } from "@brian-ai/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { mainnet, base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const brian = new BrianSDK({
  apiKey: process.env.BRIAN_API_KEY!,
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const response = await brian.transact({
  prompt: "Bridge 0.1 ETH from Ethereum to Base",
  address: account.address,
  chainId: "1",
});

console.log(`Action: ${response[0].action}`);
console.log(`Solver: ${response[0].solver}`);
console.log(`Steps on source chain: ${response[0].data.steps.length}`);
```

### Expected Output

```
Action: bridge
Solver: LI.FI
Steps on source chain: 1
```

Bridge transactions execute on the source chain. The bridge protocol handles delivery to the destination chain asynchronously.

## Step 2: Execute the Bridge Transaction

```typescript
const sourceClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const sourcePublicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const step = response[0].data.steps[0];

const hash = await sourceClient.sendTransaction({
  to: step.to as `0x${string}`,
  data: step.data as `0x${string}`,
  value: BigInt(step.value),
  gas: step.gasLimit ? BigInt(step.gasLimit) : undefined,
});

const receipt = await sourcePublicClient.waitForTransactionReceipt({ hash });

if (receipt.status !== "success") {
  throw new Error(`Bridge transaction failed: ${hash}`);
}

console.log(`Bridge initiated: ${hash}`);
console.log("Funds will arrive on Base in ~2-10 minutes depending on the bridge protocol");
```

## Step 3: Monitor Destination Chain

```typescript
const destPublicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
});

async function waitForBridgeCompletion(
  address: `0x${string}`,
  initialBalance: bigint,
  timeoutMs: number = 600_000,
) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const currentBalance = await destPublicClient.getBalance({ address });

    if (currentBalance > initialBalance) {
      const received = currentBalance - initialBalance;
      console.log(`Bridge complete. Received ${received} wei on Base`);
      return received;
    }

    await new Promise((r) => setTimeout(r, 15_000));
  }

  throw new Error("Bridge timed out. Check the bridge explorer for status.");
}

const initialBalance = await destPublicClient.getBalance({
  address: account.address,
});

await waitForBridgeCompletion(account.address, initialBalance);
```

## Cross-Chain Swap (Bridge + Swap)

Bridge ETH from Ethereum and receive USDC on Base in a single intent:

```typescript
const crossChainResponse = await brian.transact({
  prompt: "Swap 0.1 ETH on Ethereum for USDC on Base",
  address: account.address,
  chainId: "1",
});

const result = crossChainResponse[0];
console.log(`Action: ${result.action}`);
console.log(`From: ${result.data.fromToken.symbol} on chain ${result.data.fromToken.chainId}`);
console.log(`To: ${result.data.toToken.symbol} on chain ${result.data.toToken.chainId}`);
console.log(`Steps: ${result.data.steps.length}`);

for (let i = 0; i < result.data.steps.length; i++) {
  const step = result.data.steps[i];

  const hash = await sourceClient.sendTransaction({
    to: step.to as `0x${string}`,
    data: step.data as `0x${string}`,
    value: BigInt(step.value),
    gas: step.gasLimit ? BigInt(step.gasLimit) : undefined,
  });

  const receipt = await sourcePublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Step ${i} failed: ${hash}`);
  }
  console.log(`Step ${i} confirmed: ${hash}`);
}
```

## Bridge ERC-20 Tokens

Bridging ERC-20s requires an approval step before the bridge:

```typescript
const usdcBridge = await brian.transact({
  prompt: "Bridge 500 USDC from Ethereum to Arbitrum",
  address: account.address,
  chainId: "1",
});

const bridgeResult = usdcBridge[0];
console.log(`Steps: ${bridgeResult.data.steps.length}`);

// Step 0: approve USDC spending
// Step 1: bridge transaction
for (let i = 0; i < bridgeResult.data.steps.length; i++) {
  const step = bridgeResult.data.steps[i];

  const hash = await sourceClient.sendTransaction({
    to: step.to as `0x${string}`,
    data: step.data as `0x${string}`,
    value: BigInt(step.value),
    gas: step.gasLimit ? BigInt(step.gasLimit) : undefined,
  });

  const receipt = await sourcePublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Step ${i} reverted: ${hash}`);
  }
  console.log(`Step ${i} confirmed: ${hash}`);
}
```

## Error Handling for Bridge Operations

```typescript
async function safeBridge(prompt: string, address: string, chainId: string) {
  try {
    const response = await brian.transact({ prompt, address, chainId });

    if (!response || response.length === 0) {
      throw new Error(
        "No bridge route found. The token pair or chain combination may not be supported.",
      );
    }

    const result = response[0];

    if (result.action !== "bridge" && result.action !== "cross-chain swap") {
      console.warn(`Expected bridge action, got: ${result.action}`);
    }

    return result;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("insufficient")) {
        throw new Error("Insufficient balance for bridge amount plus gas fees.");
      }
      if (error.message.includes("not supported")) {
        throw new Error(
          "This bridge route is not supported. Try a different chain pair or token.",
        );
      }
    }
    throw error;
  }
}
```

Last verified: February 2026
