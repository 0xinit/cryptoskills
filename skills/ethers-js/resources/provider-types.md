# ethers.js v6 Provider Types

Reference for all Provider classes in ethers.js v6, their use cases, constructor signatures, and configuration options.

## Provider Hierarchy

```
AbstractProvider (base class)
  |-- JsonRpcApiProvider
  |     |-- JsonRpcProvider (HTTP/HTTPS)
  |     |-- BrowserProvider (EIP-1193 wallet)
  |-- WebSocketProvider (WS/WSS)
  |-- FallbackProvider (multi-backend with quorum)
  |-- EtherscanProvider
  |-- InfuraProvider
  |-- AlchemyProvider
  |-- CloudflareProvider
  |-- AnkrProvider
  |-- PocketProvider
```

## JsonRpcProvider

Direct HTTP connection to any JSON-RPC endpoint. The most common provider for server-side scripts.

```typescript
import { JsonRpcProvider } from "ethers";

// Basic
const provider = new JsonRpcProvider("https://eth-mainnet.g.alchemy.com/v2/KEY");

// With explicit network (skips network detection call)
const provider = new JsonRpcProvider("https://rpc.example.com", 1);

// With options
const provider = new JsonRpcProvider("https://rpc.example.com", undefined, {
  staticNetwork: true,    // skip initial network detection
  batchMaxCount: 10,      // max requests per batch
  batchMaxSize: 1 << 20,  // max batch payload size (1MB)
  polling: true,           // use polling instead of filters
  pollingInterval: 4000,   // polling interval in ms
});
```

**When to use:** Backend scripts, bots, CLIs, any server-side code. Most common choice.

**Limitations:** No persistent connection. Each call is an HTTP request. Not suitable for real-time event subscriptions (use WebSocketProvider for that).

## BrowserProvider

Wraps an EIP-1193 provider (the `window.ethereum` object injected by browser wallets like MetaMask, Coinbase Wallet, Rabby).

```typescript
import { BrowserProvider } from "ethers";

if (!window.ethereum) throw new Error("No wallet detected");

const provider = new BrowserProvider(window.ethereum);

// Get the connected signer (triggers wallet popup for account access)
const signer = await provider.getSigner();
const address = await signer.getAddress();

// Reading chain data
const balance = await provider.getBalance(address);
const network = await provider.getNetwork();
```

**When to use:** Frontend dApps that interact with user wallets.

**Limitations:** Only available in browser environments. Relies on the wallet extension being installed.

### Handling Chain Switching

```typescript
// Listen for chain changes
window.ethereum.on("chainChanged", (chainId: string) => {
  // BrowserProvider caches the network; recreate it on chain switch
  const newProvider = new BrowserProvider(window.ethereum);
  console.log(`Switched to chain ${parseInt(chainId, 16)}`);
});

// Listen for account changes
window.ethereum.on("accountsChanged", (accounts: string[]) => {
  if (accounts.length === 0) {
    console.log("Wallet disconnected");
  } else {
    console.log(`Active account: ${accounts[0]}`);
  }
});
```

## WebSocketProvider

Persistent WebSocket connection. Required for real-time subscriptions (`on("block", ...)`, `on("pending", ...)`, contract events).

```typescript
import { WebSocketProvider } from "ethers";

const provider = new WebSocketProvider("wss://eth-mainnet.g.alchemy.com/v2/KEY");

// Real-time block subscription
provider.on("block", (blockNumber: number) => {
  console.log(`New block: ${blockNumber}`);
});

// Cleanup
async function shutdown() {
  provider.removeAllListeners();
  await provider.destroy();
}
```

**When to use:** Real-time monitoring, event-driven bots, live dashboards.

**Limitations:** Connection can drop. Implement reconnection logic for production use.

### Reconnection Pattern

```typescript
function createReconnectingProvider(
  wsUrl: string,
  onBlock: (blockNumber: number) => void
): { destroy: () => Promise<void> } {
  let provider: WebSocketProvider | null = null;
  let destroyed = false;

  function connect() {
    if (destroyed) return;

    provider = new WebSocketProvider(wsUrl);

    provider.on("block", onBlock);

    provider.websocket.on("close", () => {
      if (destroyed) return;
      console.log("WebSocket closed. Reconnecting in 3s...");
      setTimeout(connect, 3000);
    });

    provider.websocket.on("error", (error: Error) => {
      console.error(`WebSocket error: ${error.message}`);
    });
  }

  connect();

  return {
    destroy: async () => {
      destroyed = true;
      if (provider) {
        provider.removeAllListeners();
        await provider.destroy();
      }
    },
  };
}
```

## FallbackProvider

Uses multiple backends with quorum voting. If one RPC endpoint goes down or returns stale data, the others provide redundancy.

```typescript
import { FallbackProvider, JsonRpcProvider } from "ethers";

const providers = [
  new JsonRpcProvider("https://rpc1.example.com"),
  new JsonRpcProvider("https://rpc2.example.com"),
  new JsonRpcProvider("https://rpc3.example.com"),
];

// quorum: 2 = at least 2 providers must agree
const provider = new FallbackProvider(providers, undefined, {
  quorum: 2,
});
```

**When to use:** Production systems where RPC reliability is critical.

**Limitations:** Slower than single-provider (waits for quorum). Higher RPC usage.

### Weighted FallbackProvider

```typescript
import { FallbackProvider, JsonRpcProvider } from "ethers";

const provider = new FallbackProvider([
  {
    provider: new JsonRpcProvider("https://primary.example.com"),
    priority: 1,    // lower = preferred
    stallTimeout: 2000,
    weight: 2,       // counts as 2 votes toward quorum
  },
  {
    provider: new JsonRpcProvider("https://secondary.example.com"),
    priority: 2,
    stallTimeout: 3000,
    weight: 1,
  },
]);
```

## Third-Party Providers

Convenience classes for popular RPC services. These handle endpoint construction from API keys.

```typescript
import {
  InfuraProvider,
  AlchemyProvider,
  EtherscanProvider,
  CloudflareProvider,
  AnkrProvider,
} from "ethers";

// Infura
const infura = new InfuraProvider("mainnet", "YOUR_INFURA_KEY");

// Alchemy
const alchemy = new AlchemyProvider("mainnet", "YOUR_ALCHEMY_KEY");

// Etherscan (read-only, rate-limited)
const etherscan = new EtherscanProvider("mainnet", "YOUR_ETHERSCAN_KEY");

// Cloudflare (no API key, public gateway)
const cloudflare = new CloudflareProvider();

// Ankr
const ankr = new AnkrProvider("mainnet", "YOUR_ANKR_KEY");
```

## Provider Methods Reference

### Read Methods (Available on All Providers)

| Method | Return Type | Description |
|--------|-------------|-------------|
| `getBlockNumber()` | `Promise<number>` | Current block number |
| `getBlock(blockTag)` | `Promise<Block \| null>` | Block by number or tag |
| `getBalance(address)` | `Promise<bigint>` | ETH balance in wei |
| `getTransactionCount(address)` | `Promise<number>` | Nonce (pending or latest) |
| `getCode(address)` | `Promise<string>` | Contract bytecode |
| `getStorage(address, slot)` | `Promise<string>` | Raw storage value |
| `getTransaction(hash)` | `Promise<TransactionResponse \| null>` | Transaction by hash |
| `getTransactionReceipt(hash)` | `Promise<TransactionReceipt \| null>` | Receipt by hash |
| `call(tx)` | `Promise<string>` | Execute call (no state change) |
| `estimateGas(tx)` | `Promise<bigint>` | Gas estimate |
| `getFeeData()` | `Promise<FeeData>` | Current gas prices |
| `getNetwork()` | `Promise<Network>` | Chain ID and name |
| `getLogs(filter)` | `Promise<Log[]>` | Raw logs matching filter |
| `resolveName(name)` | `Promise<string \| null>` | ENS forward resolution |
| `lookupAddress(address)` | `Promise<string \| null>` | ENS reverse resolution |
| `waitForTransaction(hash, confirms)` | `Promise<TransactionReceipt \| null>` | Wait for confirmation |

### Subscription Methods (WebSocketProvider or Polling)

| Method | Event | Description |
|--------|-------|-------------|
| `on("block", fn)` | New block | Block number callback |
| `on("pending", fn)` | Pending TX | Transaction hash callback |
| `on(filter, fn)` | Log event | Raw log callback |
| `off(event, fn)` | -- | Remove listener |
| `removeAllListeners()` | -- | Remove all listeners |

## Choosing a Provider

| Use Case | Provider | Notes |
|----------|----------|-------|
| Backend scripts | `JsonRpcProvider` | Simple, reliable |
| Frontend dApps | `BrowserProvider` | Wraps wallet |
| Real-time events | `WebSocketProvider` | Persistent connection |
| High availability | `FallbackProvider` | Multi-backend quorum |
| Quick prototyping | `getDefaultProvider()` | Rate-limited, not for production |
| No infra needed | `CloudflareProvider` | Free, public, limited |
