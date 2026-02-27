# wagmi v2 Hook Reference

Quick reference for all commonly used wagmi v2 React hooks. All hooks require the component tree to be wrapped in `WagmiProvider` and `QueryClientProvider`.

## Connection Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `useAccount` | Current wallet state | `address`, `isConnected`, `chain`, `connector`, `isConnecting`, `isReconnecting` |
| `useConnect` | Initiate wallet connection | `connect()`, `connectors`, `isPending`, `error` |
| `useDisconnect` | Disconnect wallet | `disconnect()`, `isPending` |
| `useConnectorClient` | Get underlying viem WalletClient | `data` (WalletClient) |
| `useReconnect` | Reconnect on page load | `reconnect()`, `isPending` |

## Chain Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `useChainId` | Current chain ID | `number` (chain ID) |
| `useSwitchChain` | Switch wallet chain | `switchChain()`, `chains`, `isPending`, `error` |
| `useChains` | List of configured chains | `Chain[]` |

## Balance & Token Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `useBalance` | Native or ERC-20 balance | `data.value` (bigint), `data.formatted`, `data.symbol` |

## Contract Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `useReadContract` | Single contract read | `data`, `isLoading`, `error`, `refetch` |
| `useReadContracts` | Batched reads (multicall) | `data[]` with per-call status |
| `useWriteContract` | Send a write transaction | `writeContract()`, `data` (hash), `isPending`, `error`, `reset` |
| `useSimulateContract` | Simulate before writing | `data.request`, `error` |
| `useWatchContractEvent` | Subscribe to contract events | Calls `onLogs` callback |

## Transaction Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `useSendTransaction` | Send native ETH | `sendTransaction()`, `data` (hash), `isPending` |
| `useWaitForTransactionReceipt` | Wait for tx confirmation | `data` (receipt), `isLoading`, `isSuccess` |
| `useTransactionReceipt` | Fetch existing receipt | `data` (receipt) |

## ENS Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `useEnsName` | Resolve address to ENS name | `data` (string or null) |
| `useEnsAddress` | Resolve ENS name to address | `data` (address or null) |
| `useEnsAvatar` | Get ENS avatar URL | `data` (string or null) |
| `useEnsResolver` | Get ENS resolver address | `data` (address) |

## Block Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `useBlockNumber` | Current block number | `data` (bigint) |
| `useBlock` | Full block data | `data` (Block) |
| `useGasPrice` | Current gas price | `data` (bigint) |
| `useFeeHistory` | Historical fee data | `data` |

## Signature Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `useSignMessage` | Sign a text message (EIP-191) | `signMessage()`, `data` (signature) |
| `useSignTypedData` | Sign typed data (EIP-712) | `signTypedData()`, `data` (signature) |
| `useVerifyMessage` | Verify a message signature | `data` (boolean) |
| `useVerifyTypedData` | Verify typed data signature | `data` (boolean) |

## Config Hooks

| Hook | Purpose | Key Returns |
|------|---------|-------------|
| `useConfig` | Access wagmi config | `Config` object |
| `useClient` | Get viem PublicClient for a chain | `data` (PublicClient) |

## v1 to v2 Name Changes

| v1 Name (removed) | v2 Name |
|--------------------|---------|
| `useContractRead` | `useReadContract` |
| `useContractReads` | `useReadContracts` |
| `useContractWrite` | `useWriteContract` |
| `usePrepareContractWrite` | `useSimulateContract` |
| `useWaitForTransaction` | `useWaitForTransactionReceipt` |
| `useNetwork` | `useChainId` + `useSwitchChain` |
| `useSwitchNetwork` | `useSwitchChain` |
| `useContractEvent` | `useWatchContractEvent` |

## TanStack Query Options

All data-fetching hooks accept a `query` parameter for TanStack Query configuration:

```typescript
useReadContract({
  // ... contract params
  query: {
    enabled: boolean,           // conditionally enable/disable
    refetchInterval: number,    // polling interval in ms
    staleTime: number,          // time before data is stale (ms)
    gcTime: number,             // garbage collection time (ms)
    retry: number | boolean,    // retry count on failure
    refetchOnWindowFocus: boolean,
    refetchIntervalInBackground: boolean,
    placeholderData: (prev) => prev, // keep previous data while refetching
  },
});
```

## References

- Full hook API docs: https://wagmi.sh/react/api/hooks
- Migration guide: https://wagmi.sh/react/guides/migrate-from-v1-to-v2
