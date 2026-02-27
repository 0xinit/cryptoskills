# DeFi Actions via Brian API

End-to-end examples for deposit, withdraw, borrow, and repay operations through Brian API. These actions interact with DeFi protocols (primarily Aave) via the Enso solver.

## Prerequisites

```bash
npm install @brian-ai/sdk viem
```

Environment variables:

```bash
export BRIAN_API_KEY="brian_..."
export PRIVATE_KEY="0x..."
export RPC_URL="https://eth.llamarpc.com"
```

## Important: DeFi Action Chain Support

DeFi actions (deposit, withdraw, borrow, repay) are only available on:
- Ethereum (chainId: 1)
- Arbitrum (chainId: 42161)
- Optimism (chainId: 10)
- Polygon (chainId: 137)
- Base (chainId: 8453)
- Avalanche (chainId: 43114)

Other chains only support swap, bridge, and transfer.

## Setup

```typescript
import { BrianSDK } from "@brian-ai/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const brian = new BrianSDK({
  apiKey: process.env.BRIAN_API_KEY!,
});

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

async function executeSteps(steps: Array<{ to: string; data: string; value: string; gasLimit?: string }>) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
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
}
```

## Deposit into Aave

```typescript
async function depositToAave() {
  const response = await brian.transact({
    prompt: "Deposit 1000 USDC into Aave on Ethereum",
    address: account.address,
    chainId: "1",
  });

  const result = response[0];
  console.log(`Action: ${result.action}`);
  console.log(`Solver: ${result.solver}`);
  console.log(`Steps: ${result.data.steps.length}`);

  // Step 0: approve USDC
  // Step 1: deposit into Aave lending pool
  await executeSteps(result.data.steps);

  console.log("Deposit complete. You now hold aUSDC.");
}
```

## Withdraw from Aave

```typescript
async function withdrawFromAave() {
  const response = await brian.transact({
    prompt: "Withdraw 500 USDC from Aave on Ethereum",
    address: account.address,
    chainId: "1",
  });

  const result = response[0];
  console.log(`Action: ${result.action}`);
  console.log(`Steps: ${result.data.steps.length}`);

  // Withdrawal burns aTokens and returns underlying
  await executeSteps(result.data.steps);

  console.log("Withdrawal complete. USDC returned to wallet.");
}
```

## Borrow from Aave

Borrowing requires existing collateral in the protocol. Deposit first, then borrow against it.

```typescript
async function borrowFromAave() {
  // Deposit collateral first
  const depositResponse = await brian.transact({
    prompt: "Deposit 1 ETH into Aave on Ethereum",
    address: account.address,
    chainId: "1",
  });

  await executeSteps(depositResponse[0].data.steps);
  console.log("Collateral deposited");

  // Borrow against collateral
  const borrowResponse = await brian.transact({
    prompt: "Borrow 500 USDC from Aave on Ethereum",
    address: account.address,
    chainId: "1",
  });

  const result = borrowResponse[0];
  console.log(`Action: ${result.action}`);
  console.log(`Steps: ${result.data.steps.length}`);

  await executeSteps(result.data.steps);

  console.log("Borrow complete. USDC received in wallet.");
}
```

## Repay a Loan

```typescript
async function repayAaveLoan() {
  const response = await brian.transact({
    prompt: "Repay 500 USDC to Aave on Ethereum",
    address: account.address,
    chainId: "1",
  });

  const result = response[0];
  console.log(`Action: ${result.action}`);
  console.log(`Steps: ${result.data.steps.length}`);

  // Step 0: approve USDC for repayment
  // Step 1: repay the loan
  await executeSteps(result.data.steps);

  console.log("Repayment complete. Debt reduced.");
}
```

## Full Lending Cycle

Complete flow: deposit collateral, borrow, repay, and withdraw.

```typescript
async function fullLendingCycle() {
  console.log("=== 1. Deposit 2 ETH as collateral ===");
  const deposit = await brian.transact({
    prompt: "Deposit 2 ETH into Aave on Ethereum",
    address: account.address,
    chainId: "1",
  });
  await executeSteps(deposit[0].data.steps);

  console.log("=== 2. Borrow 1000 USDC ===");
  const borrow = await brian.transact({
    prompt: "Borrow 1000 USDC from Aave on Ethereum",
    address: account.address,
    chainId: "1",
  });
  await executeSteps(borrow[0].data.steps);

  // ... use the borrowed USDC ...

  console.log("=== 3. Repay 1000 USDC ===");
  const repay = await brian.transact({
    prompt: "Repay 1000 USDC to Aave on Ethereum",
    address: account.address,
    chainId: "1",
  });
  await executeSteps(repay[0].data.steps);

  console.log("=== 4. Withdraw 2 ETH collateral ===");
  const withdraw = await brian.transact({
    prompt: "Withdraw 2 ETH from Aave on Ethereum",
    address: account.address,
    chainId: "1",
  });
  await executeSteps(withdraw[0].data.steps);

  console.log("Full cycle complete");
}

fullLendingCycle().catch(console.error);
```

## Deposit on L2 (Arbitrum)

```typescript
import { arbitrum } from "viem/chains";

const arbPublicClient = createPublicClient({
  chain: arbitrum,
  transport: http("https://arb1.arbitrum.io/rpc"),
});

const arbWalletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http("https://arb1.arbitrum.io/rpc"),
});

async function depositOnArbitrum() {
  const response = await brian.transact({
    prompt: "Deposit 500 USDC into Aave on Arbitrum",
    address: account.address,
    chainId: "42161",
  });

  const result = response[0];

  for (const step of result.data.steps) {
    const hash = await arbWalletClient.sendTransaction({
      to: step.to as `0x${string}`,
      data: step.data as `0x${string}`,
      value: BigInt(step.value),
      gas: step.gasLimit ? BigInt(step.gasLimit) : undefined,
    });

    const receipt = await arbPublicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Transaction reverted: ${hash}`);
    }
    console.log(`Confirmed: ${hash}`);
  }
}
```

Last verified: February 2026
