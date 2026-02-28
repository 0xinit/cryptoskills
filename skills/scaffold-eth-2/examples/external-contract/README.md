# External Contract Integration

Interact with already-deployed contracts (Uniswap, Aave, ENS, any protocol) using SE2 hooks via `externalContracts.ts`. No redeployment needed -- add the ABI and address, and SE2 treats them like your own contracts.

## Configure externalContracts.ts

```typescript
// packages/nextjs/contracts/externalContracts.ts
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const externalContracts = {
  1: {
    WETH: {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      abi: [
        {
          name: "deposit",
          type: "function",
          stateMutability: "payable",
          inputs: [],
          outputs: [],
        },
        {
          name: "withdraw",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [{ name: "wad", type: "uint256" }],
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
          name: "approve",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "guy", type: "address" },
            { name: "wad", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
        {
          name: "totalSupply",
          type: "function",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "uint256" }],
        },
      ] as const,
    },
  },
} as const;

export default externalContracts;
```

## Reading External Contract State

SE2 hooks work identically for external contracts. Pass the contract name as defined in `externalContracts.ts`.

```tsx
// packages/nextjs/app/weth/page.tsx
"use client";

import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export default function WethDashboard() {
  const { address } = useAccount();

  const { data: totalSupply } = useScaffoldReadContract({
    contractName: "WETH",
    functionName: "totalSupply",
  });

  const { data: balance } = useScaffoldReadContract({
    contractName: "WETH",
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">WETH Dashboard</h1>
      <p>Total Supply: {totalSupply ? formatEther(totalSupply) : "..."} WETH</p>
      <p>Your Balance: {balance ? formatEther(balance) : "0"} WETH</p>
    </div>
  );
}
```

## Writing to External Contracts

```tsx
"use client";

import { parseEther } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { EtherInput } from "~~/components/scaffold-eth";
import { useState } from "react";

function WrapEth() {
  const [amount, setAmount] = useState("");
  const { writeContractAsync, isMining } = useScaffoldWriteContract("WETH");

  async function handleWrap() {
    await writeContractAsync({
      functionName: "deposit",
      value: parseEther(amount),
    });
  }

  async function handleUnwrap() {
    await writeContractAsync({
      functionName: "withdraw",
      args: [parseEther(amount)],
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <EtherInput value={amount} onChange={setAmount} placeholder="ETH amount" />
      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          onClick={handleWrap}
          disabled={isMining || !amount}
        >
          {isMining ? "Wrapping..." : "Wrap ETH"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleUnwrap}
          disabled={isMining || !amount}
        >
          {isMining ? "Unwrapping..." : "Unwrap WETH"}
        </button>
      </div>
    </div>
  );
}
```

## ABI Import Patterns

### Full ABI from JSON File

For contracts with large ABIs, import from a JSON file rather than inlining.

```typescript
// packages/nextjs/contracts/abis/uniswapV3Router.ts
export const uniswapV3RouterAbi = [
  // Paste the full ABI from Etherscan "Contract" tab -> "ABI" section
  // Always add `as const` at the end for type inference
] as const;
```

```typescript
// packages/nextjs/contracts/externalContracts.ts
import { uniswapV3RouterAbi } from "./abis/uniswapV3Router";

const externalContracts = {
  1: {
    UniswapV3Router: {
      address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      abi: uniswapV3RouterAbi,
    },
  },
} as const;

export default externalContracts;
```

### Partial ABI (Only Functions You Need)

You do not need the full ABI. Include only the functions you will call. This keeps the bundle small and types simple.

```typescript
const externalContracts = {
  1: {
    UniswapV3Router: {
      address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      abi: [
        {
          name: "exactInputSingle",
          type: "function",
          stateMutability: "payable",
          inputs: [
            {
              name: "params",
              type: "tuple",
              components: [
                { name: "tokenIn", type: "address" },
                { name: "tokenOut", type: "address" },
                { name: "fee", type: "uint24" },
                { name: "recipient", type: "address" },
                { name: "deadline", type: "uint256" },
                { name: "amountIn", type: "uint256" },
                { name: "amountOutMinimum", type: "uint256" },
                { name: "sqrtPriceLimitX96", type: "uint160" },
              ],
            },
          ],
          outputs: [{ name: "amountOut", type: "uint256" }],
        },
      ] as const,
    },
  },
} as const;
```

## Multi-Chain External Contracts

Define the same contract name with different addresses per chain. SE2 resolves the correct address based on the connected chain.

```typescript
const externalContracts = {
  1: {
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      abi: erc20Abi,
    },
  },
  10: {
    USDC: {
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      abi: erc20Abi,
    },
  },
  42161: {
    USDC: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      abi: erc20Abi,
    },
  },
} as const;
```

The debug page shows external contracts alongside your deployed contracts. You can read and write to them directly from the browser.

Last verified: February 2026
