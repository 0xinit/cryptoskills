# Read Contract

Reading on-chain state with wagmi v2's `useReadContract` and `useReadContracts` (multicall). Covers single reads, batched reads, conditional execution, and polling strategies.

## Dependencies

```bash
npm install wagmi viem @tanstack/react-query
```

## ABI Setup

ABIs must use `as const` for type inference to work.

```typescript
// abis/erc20.ts
export const erc20Abi = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
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
] as const;
```

## Single Contract Read

```tsx
// token-balance.tsx
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { erc20Abi } from "./abis/erc20";

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

function UsdcBalance({ account }: { account: `0x${string}` }) {
  const { data: balance, isLoading, error, refetch } = useReadContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });

  if (isLoading) return <p>Loading balance...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (balance === undefined) return null;

  // USDC has 6 decimals -- balance is bigint
  const formatted = formatUnits(balance, 6);

  return (
    <div>
      <p>USDC Balance: {formatted}</p>
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

## Conditional Read (Wait for Wallet)

```tsx
import { useReadContract, useAccount } from "wagmi";
import { erc20Abi } from "./abis/erc20";

function ConditionalBalance({ token }: { token: `0x${string}` }) {
  const { address } = useAccount();

  const { data: balance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    // Pass undefined args to skip the query when wallet is not connected
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  if (!address) return <p>Connect wallet to see balance</p>;

  return <p>Balance: {balance?.toString() ?? "Loading..."}</p>;
}
```

## Batched Reads with useReadContracts

`useReadContracts` sends all calls in a single multicall RPC request.

```tsx
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { erc20Abi } from "./abis/erc20";

interface TokenInfo {
  address: `0x${string}`;
  decimals: number;
}

const TOKENS: TokenInfo[] = [
  { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },   // USDC
  { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },   // USDT
  { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },  // DAI
];

function Portfolio({ account }: { account: `0x${string}` }) {
  const contracts = TOKENS.map((t) => ({
    address: t.address,
    abi: erc20Abi,
    functionName: "balanceOf" as const,
    args: [account] as const,
  }));

  const { data, isLoading, error } = useReadContracts({ contracts });

  if (isLoading) return <p>Loading portfolio...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!data) return null;

  return (
    <table>
      <thead>
        <tr>
          <th>Token</th>
          <th>Balance</th>
        </tr>
      </thead>
      <tbody>
        {TOKENS.map((token, i) => {
          const result = data[i];
          const balance =
            result.status === "success"
              ? formatUnits(result.result as bigint, token.decimals)
              : "Error";

          return (
            <tr key={token.address}>
              <td>{token.address.slice(0, 8)}...</td>
              <td>{balance}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

## Polling / Refetch Strategies

```tsx
import { useReadContract } from "wagmi";
import { erc20Abi } from "./abis/erc20";

function PollingBalance({
  token,
  account,
}: {
  token: `0x${string}`;
  account: `0x${string}`;
}) {
  const { data } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
    query: {
      // Poll every 15 seconds
      refetchInterval: 15_000,
      // Pause polling when tab is not visible
      refetchIntervalInBackground: false,
      // Consider data fresh for 10 seconds
      staleTime: 10_000,
    },
  });

  return <span>{data?.toString() ?? "..."}</span>;
}
```

## Reading at a Specific Block

```tsx
import { useReadContract } from "wagmi";
import { erc20Abi } from "./abis/erc20";

function HistoricalBalance({
  token,
  account,
  blockNumber,
}: {
  token: `0x${string}`;
  account: `0x${string}`;
  blockNumber: bigint;
}) {
  const { data } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
    blockNumber,
  });

  return (
    <p>
      Balance at block {blockNumber.toString()}: {data?.toString() ?? "Loading..."}
    </p>
  );
}
```

## Return Value Types

`useReadContract` return values match the Solidity return type:

| Solidity Type | TypeScript Type | Notes |
|---------------|----------------|-------|
| `uint256` | `bigint` | Never use `number` |
| `int256` | `bigint` | Can be negative |
| `address` | `` `0x${string}` `` | 42-char hex string |
| `bool` | `boolean` | |
| `string` | `string` | |
| `bytes` | `` `0x${string}` `` | Hex-encoded |
| `uint256[]` | `readonly bigint[]` | Read-only array |
| `tuple` | Named object | Keys match ABI output names |

## Error Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `ContractFunctionExecutionError` | Call reverted on-chain | Check args, account state, or contract state |
| `AbiFunctionNotFoundError` | `functionName` not in ABI | Verify ABI includes the function |
| `AbiEncodingLengthMismatchError` | Wrong number of args | Match args count to ABI inputs |
