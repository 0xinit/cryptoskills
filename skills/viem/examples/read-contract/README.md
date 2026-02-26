# Reading Contract State

Examples for reading on-chain state with viem's `readContract` and related methods.

## Setup

```typescript
import { createPublicClient, http, formatUnits } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
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
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
```

## Read a Single Value

```typescript
const balance = await client.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
});
// balance is typed as bigint
```

## Read ERC-20 Balance with Formatting

```typescript
async function getTokenBalance(
  token: `0x${string}`,
  wallet: `0x${string}`
): Promise<{ raw: bigint; formatted: string; symbol: string }> {
  const [balance, decimals, symbol] = await Promise.all([
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet],
    }),
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "symbol",
    }),
  ]);

  return {
    raw: balance,
    formatted: formatUnits(balance, decimals),
    symbol,
  };
}

const result = await getTokenBalance(
  USDC,
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
);
console.log(`${result.formatted} ${result.symbol}`);
```

## Read Allowance

```typescript
const allowance = await client.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "allowance",
  args: [
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // owner
    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // spender (Uniswap router)
  ],
});

const decimals = await client.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "decimals",
});

console.log(`Allowance: ${formatUnits(allowance, decimals)} USDC`);
```

## Batch Reads with Multicall

Reading multiple values in a single RPC call saves latency and avoids rate limits.

```typescript
const results = await client.multicall({
  contracts: [
    {
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
    },
    {
      address: USDC,
      abi: erc20Abi,
      functionName: "decimals",
    },
    {
      address: USDC,
      abi: erc20Abi,
      functionName: "symbol",
    },
    {
      address: USDC,
      abi: erc20Abi,
      functionName: "totalSupply",
    },
  ],
});

for (const result of results) {
  if (result.status === "success") {
    console.log("Value:", result.result);
  } else {
    console.error("Call failed:", result.error);
  }
}
```

## Error Handling for Reverts

```typescript
import { BaseError, ContractFunctionRevertedError } from "viem";

try {
  const balance = await client.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
  });
  console.log("Balance:", balance);
} catch (err) {
  if (err instanceof BaseError) {
    const revertError = err.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      console.error("Revert reason:", revertError.data?.errorName);
      console.error("Revert args:", revertError.data?.args);
    } else {
      console.error("Contract call failed:", err.shortMessage);
    }
  } else {
    throw err;
  }
}
```

## Reading at a Specific Block

```typescript
const historicalBalance = await client.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
  blockNumber: 18000000n,
});
```
