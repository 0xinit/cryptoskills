# Viem Troubleshooting Guide

Common issues and solutions when working with viem.

## "Cannot read properties of undefined" -- Missing Chain Config

**Symptoms:**
- `TypeError: Cannot read properties of undefined (reading 'id')`
- Happens when creating a client

**Cause:** The `chain` parameter was omitted from `createPublicClient` or `createWalletClient`.

**Fix:**
```typescript
// Wrong -- no chain
const client = createPublicClient({
  transport: http("https://eth.llamarpc.com"),
});

// Correct
import { mainnet } from "viem/chains";

const client = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});
```

## ABI Encoding Errors -- Wrong Types

**Symptoms:**
- `AbiEncodingLengthMismatchError`
- `InvalidAbiEncodingTypeError`
- Arguments don't match expected types

**Cause:** Arguments passed to `readContract`/`writeContract` don't match the ABI parameter types.

**Fix:**
```typescript
// Wrong -- passing string instead of bigint for uint256
await client.readContract({
  address: token,
  abi,
  functionName: "transfer",
  args: [to, "1000000"], // string, not bigint
});

// Correct
await client.readContract({
  address: token,
  abi,
  functionName: "transfer",
  args: [to, 1000000n], // bigint
});
```

Also verify the ABI has `as const`:
```typescript
// Wrong -- no type inference without as const
const abi = [{ name: "transfer", ... }];

// Correct
const abi = [{ name: "transfer", ... }] as const;
```

## Gas Estimation Fails -- Simulation Revert

**Symptoms:**
- `EstimateGasExecutionError`
- `ContractFunctionExecutionError` during `simulateContract`

**Cause:** The transaction would revert on-chain. Common reasons: insufficient token balance, missing approval, wrong function args.

**Fix:**
```typescript
import { BaseError, ContractFunctionRevertedError } from "viem";

try {
  const { request } = await client.simulateContract({
    address: token,
    abi,
    functionName: "transfer",
    args: [to, amount],
    account,
  });
} catch (err) {
  if (err instanceof BaseError) {
    const revert = err.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revert instanceof ContractFunctionRevertedError) {
      // Read the actual revert reason
      console.error("Revert:", revert.data?.errorName, revert.data?.args);
    }
  }
}
```

## "No transport configured" -- Client Not Set Up

**Symptoms:**
- `Error: No transport configured`

**Cause:** `createPublicClient` or `createWalletClient` was called without a `transport`.

**Fix:**
```typescript
// Wrong
const client = createPublicClient({ chain: mainnet });

// Correct
const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});
```

## WebSocket Connection Drops

**Symptoms:**
- Event watchers stop firing
- `WebSocketRequestError`

**Cause:** WebSocket connections are inherently unstable. RPC providers close idle connections.

**Fix:** Use `fallback` transport or implement reconnection logic:
```typescript
import { http, webSocket, fallback } from "viem";

const client = createPublicClient({
  chain: mainnet,
  transport: fallback([
    webSocket(process.env.WS_URL),
    http(process.env.RPC_URL), // HTTP fallback
  ]),
});
```

For long-running watchers, wrap with reconnection:
```typescript
function watchWithReconnect(setupWatcher: () => () => void): () => void {
  let unwatch = setupWatcher();
  let stopped = false;

  const interval = setInterval(() => {
    if (stopped) return;
    unwatch();
    unwatch = setupWatcher();
  }, 60_000); // Reconnect every 60s

  return () => {
    stopped = true;
    clearInterval(interval);
    unwatch();
  };
}
```

## BigInt Serialization in JSON

**Symptoms:**
- `TypeError: Do not know how to serialize a BigInt`

**Cause:** `JSON.stringify` does not support `bigint` natively.

**Fix:**
```typescript
// Use a replacer function
const json = JSON.stringify(data, (_, value) =>
  typeof value === "bigint" ? value.toString() : value
);

// Or convert before serializing
const serializable = {
  balance: balance.toString(),
  blockNumber: Number(blockNumber),
};
```

## "Chain not configured" Errors

**Symptoms:**
- `ChainNotFoundError`
- `Chain "X" not configured`

**Cause:** Using a chain that viem doesn't ship by default, or the chain wasn't passed to the client.

**Fix:** Define a custom chain:
```typescript
import { defineChain } from "viem";

const customChain = defineChain({
  id: 999,
  name: "My L2",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.my-l2.io"] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: "https://scan.my-l2.io" },
  },
});

const client = createPublicClient({
  chain: customChain,
  transport: http(),
});
```

## Type Narrowing for Error Handling

**Symptoms:**
- TypeScript won't let you access `.data` or `.errorName` on caught errors

**Cause:** Caught errors are `unknown` by default. viem errors need type narrowing.

**Fix:**
```typescript
import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from "viem";

try {
  await walletClient.writeContract(request);
} catch (err) {
  if (!(err instanceof BaseError)) {
    throw err;
  }

  const revert = err.walk(
    (e) => e instanceof ContractFunctionRevertedError
  );
  if (revert instanceof ContractFunctionRevertedError) {
    // Now TypeScript knows the shape
    console.error(revert.data?.errorName);
    return;
  }

  const funds = err.walk((e) => e instanceof InsufficientFundsError);
  if (funds instanceof InsufficientFundsError) {
    console.error("Not enough ETH");
    return;
  }

  const rejected = err.walk((e) => e instanceof UserRejectedRequestError);
  if (rejected instanceof UserRejectedRequestError) {
    console.error("User rejected");
    return;
  }

  console.error(err.shortMessage);
}
```

## Multicall Fails on Chain Without Multicall3

**Symptoms:**
- `ContractFunctionExecutionError` when using `client.multicall()`

**Cause:** The chain does not have a Multicall3 contract deployed, or viem doesn't know its address.

**Fix:** Deploy or specify the Multicall3 address in your chain definition:
```typescript
import { defineChain } from "viem";

const myChain = defineChain({
  id: 12345,
  name: "My Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mychain.io"] } },
  contracts: {
    multicall3: {
      // Multicall3 is deployed at the same address on most EVM chains
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 1,
    },
  },
});
```

## Debug Checklist

- [ ] Chain is explicitly set on the client
- [ ] Transport is provided (`http()`, `webSocket()`, or `fallback()`)
- [ ] ABI has `as const` assertion for type safety
- [ ] Token amounts use `bigint`, not `number` or `string`
- [ ] Addresses are valid `0x`-prefixed hex strings
- [ ] `simulateContract` is called before `writeContract`
- [ ] Transaction receipt `status` is checked after confirmation
- [ ] Error handling uses `BaseError` + `err.walk()` pattern
