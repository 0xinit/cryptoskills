# Scaffold-ETH 2 Hook Reference

All custom hooks provided by SE2. These hooks wrap wagmi hooks and resolve contract name, ABI, and address from `deployedContracts.ts` and `externalContracts.ts` automatically.

## Contract Read Hooks

| Hook | Purpose | Key Parameters | Key Returns |
|------|---------|----------------|-------------|
| `useScaffoldReadContract` | Read a view/pure function | `contractName`, `functionName`, `args?` | `data`, `isLoading`, `error`, `refetch` |
| `useScaffoldEventHistory` | Fetch past events | `contractName`, `eventName`, `fromBlock`, `filters?`, `blockData?` | `data` (event array), `isLoading` |
| `useScaffoldWatchContractEvent` | Subscribe to live events | `contractName`, `eventName`, `onLogs` | Calls `onLogs` callback on each event |

## Contract Write Hooks

| Hook | Purpose | Key Parameters | Key Returns |
|------|---------|----------------|-------------|
| `useScaffoldWriteContract` | Send a transaction | `contractName` (hook arg), then `functionName`, `args?`, `value?` per call | `writeContractAsync()`, `isMining` |
| `useScaffoldMultiWriteContract` | Batch sequential writes | `calls[]` (array of `{ contractName, functionName, args?, value? }`) | `writeContractsAsync()`, `isMining` |

## Contract Info Hooks

| Hook | Purpose | Key Parameters | Key Returns |
|------|---------|----------------|-------------|
| `useDeployedContractInfo` | Get ABI and address for a contract | `contractName` | `data` (`{ address, abi }`), `isLoading` |

## Transaction Hooks

| Hook | Purpose | Key Parameters | Key Returns |
|------|---------|----------------|-------------|
| `useTransactor` | Low-level tx lifecycle manager | None (returns a function) | `writeTx()` function that handles notifications and receipts |

## Network Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `useTargetNetwork` | Get the current target network from scaffold config | `targetNetwork` (chain object) |
| `useGlobalState` | Access SE2 global state (native currency price, target network) | State object |

## useScaffoldReadContract Parameters

```typescript
useScaffoldReadContract({
  contractName: string,       // Must match a key in deployedContracts or externalContracts
  functionName: string,       // Solidity function name
  args?: unknown[],           // Function arguments (positional)
  // Inherits wagmi query options
  watch?: boolean,            // Auto-refresh on new blocks (default: true)
  query?: {
    enabled?: boolean,
    refetchInterval?: number,
  },
});
```

## useScaffoldWriteContract Parameters

```typescript
const { writeContractAsync, isMining } = useScaffoldWriteContract(contractName);

await writeContractAsync({
  functionName: string,       // Solidity function name
  args?: unknown[],           // Function arguments (positional)
  value?: bigint,             // ETH value for payable functions
  gasLimit?: bigint,          // Override gas limit
});
```

## useScaffoldEventHistory Parameters

```typescript
useScaffoldEventHistory({
  contractName: string,       // Contract name
  eventName: string,          // Solidity event name
  fromBlock: bigint,          // Starting block number
  filters?: Record<string, unknown>,  // Filter indexed parameters
  blockData?: boolean,        // Include block timestamp and other metadata
  transactionData?: boolean,  // Include full transaction data
  receiptData?: boolean,      // Include transaction receipt
  watch?: boolean,            // Auto-refresh on new blocks
});
```

## Hook Import Pattern

All SE2 hooks are imported from the `~~/hooks/scaffold-eth` path alias:

```typescript
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useDeployedContractInfo,
  useScaffoldEventHistory,
  useScaffoldWatchContractEvent,
  useScaffoldMultiWriteContract,
  useTransactor,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";
```

## References

- SE2 hooks source: https://github.com/scaffold-eth/scaffold-eth-2/tree/main/packages/nextjs/hooks/scaffold-eth
- SE2 docs: https://docs.scaffoldeth.io

Last verified: February 2026
