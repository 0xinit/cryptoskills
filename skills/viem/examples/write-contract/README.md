# Writing to Contracts

Examples for sending transactions with viem's `writeContract`, simulation, gas estimation, and receipt handling.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  maxUint256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
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
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
```

## Simulate Before Writing

Always simulate first. This catches reverts before spending gas.

```typescript
const { request } = await publicClient.simulateContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "transfer",
  args: [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    parseUnits("100", 6), // 100 USDC
  ],
  account: walletClient.account,
});

const hash = await walletClient.writeContract(request);
```

## Wait for Transaction Receipt

```typescript
const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.status === "reverted") {
  throw new Error(`Transaction reverted in block ${receipt.blockNumber}`);
}

console.log(`Confirmed in block ${receipt.blockNumber}`);
console.log(`Gas used: ${receipt.gasUsed}`);
console.log(`Effective gas price: ${receipt.effectiveGasPrice}`);
```

## Gas Estimation and Overrides

```typescript
const gasEstimate = await publicClient.estimateContractGas({
  address: USDC,
  abi: erc20Abi,
  functionName: "transfer",
  args: [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    parseUnits("100", 6),
  ],
  account: walletClient.account,
});

// Add 20% buffer to gas estimate
const gasLimit = (gasEstimate * 120n) / 100n;

const { request } = await publicClient.simulateContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "transfer",
  args: [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    parseUnits("100", 6),
  ],
  account: walletClient.account,
  gas: gasLimit,
});

const hash = await walletClient.writeContract(request);
```

## EIP-1559 Fee Overrides

```typescript
import { parseGwei } from "viem";

const { request } = await publicClient.simulateContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "transfer",
  args: [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    parseUnits("100", 6),
  ],
  account: walletClient.account,
  maxFeePerGas: parseGwei("30"),
  maxPriorityFeePerGas: parseGwei("2"),
});

const hash = await walletClient.writeContract(request);
```

## ERC-20 Approve + Transfer Pattern

Check existing allowance before approving to avoid unnecessary transactions.

```typescript
async function approveIfNeeded(
  token: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint
): Promise<`0x${string}` | null> {
  const currentAllowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [walletClient.account.address, spender],
  });

  if (currentAllowance >= amount) {
    return null;
  }

  const { request } = await publicClient.simulateContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account: walletClient.account,
  });

  const hash = await walletClient.writeContract(request);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error("Approval reverted");
  }

  return hash;
}

// Approve exact amount
const approvalHash = await approveIfNeeded(
  USDC,
  "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap router
  parseUnits("1000", 6)
);

if (approvalHash) {
  console.log("Approved:", approvalHash);
}
```

## Waiting for Multiple Confirmations

```typescript
const receipt = await publicClient.waitForTransactionReceipt({
  hash,
  confirmations: 3,
  timeout: 60_000, // 60 seconds
});

console.log(`Confirmed with ${3} confirmations at block ${receipt.blockNumber}`);
```

## Complete Write Pattern with Error Handling

```typescript
import { BaseError, ContractFunctionRevertedError } from "viem";

async function safeWrite(
  token: `0x${string}`,
  to: `0x${string}`,
  amount: bigint
): Promise<{ hash: `0x${string}`; blockNumber: bigint }> {
  try {
    const { request } = await publicClient.simulateContract({
      address: token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount],
      account: walletClient.account,
    });

    const hash = await walletClient.writeContract(request);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    if (receipt.status === "reverted") {
      throw new Error(`Reverted in block ${receipt.blockNumber}`);
    }

    return { hash, blockNumber: receipt.blockNumber };
  } catch (err) {
    if (err instanceof BaseError) {
      const revertError = err.walk(
        (e) => e instanceof ContractFunctionRevertedError
      );
      if (revertError instanceof ContractFunctionRevertedError) {
        throw new Error(
          `Contract reverted: ${revertError.data?.errorName ?? "unknown"}`
        );
      }
      throw new Error(`Transaction failed: ${err.shortMessage}`);
    }
    throw err;
  }
}
```
