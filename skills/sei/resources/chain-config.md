# Sei Chain Configuration

## Network Summary

| Network | Cosmos Chain ID | EVM Chain ID | Status |
|---------|----------------|--------------|--------|
| Mainnet | `pacific-1` | **1329** | Production |
| Testnet | `atlantic-2` | **1328** | Testing |
| Devnet | `arctic-1` | **713715** | Development |

## Mainnet (pacific-1)

### EVM Configuration

| Parameter | Value |
|-----------|-------|
| Chain ID | 1329 |
| Currency Symbol | SEI |
| EVM Decimals | 18 |
| EVM Version | `paris` (no PUSH0) |
| Block Time | ~390ms |
| Finality | ~390ms (single-slot) |
| Contract Size Limit | 24.576 KB |

### RPC Endpoints

| Type | URL |
|------|-----|
| EVM JSON-RPC | `https://evm-rpc.sei-apis.com` |
| EVM WebSocket | `wss://evm-ws.sei-apis.com` |
| Cosmos REST (LCD) | `https://rest.sei-apis.com` |
| Cosmos Tendermint RPC | `https://rpc.sei-apis.com` |
| Cosmos gRPC | `https://grpc.sei-apis.com` |

### Block Explorers

| Explorer | URL | Type |
|----------|-----|------|
| Seitrace | https://seitrace.com | EVM + Cosmos |
| Seistream | https://seistream.app | EVM focused |
| Seiscan | https://seiscan.app | Cosmos focused |

## Testnet (atlantic-2)

### EVM Configuration

| Parameter | Value |
|-----------|-------|
| Chain ID | 1328 |
| Currency Symbol | SEI |
| Faucet | https://atlantic-2.app.sei.io/faucet |

### RPC Endpoints

| Type | URL |
|------|-----|
| EVM JSON-RPC | `https://evm-rpc-testnet.sei-apis.com` |
| EVM WebSocket | `wss://evm-ws-testnet.sei-apis.com` |
| Cosmos REST | `https://rest-testnet.sei-apis.com` |
| Cosmos RPC | `https://rpc-testnet.sei-apis.com` |

### Block Explorers

| Explorer | URL |
|----------|-----|
| Seitrace (testnet) | https://seitrace.com/?chain=atlantic-2 |

## Devnet (arctic-1)

### EVM Configuration

| Parameter | Value |
|-----------|-------|
| Chain ID | 713715 |
| Currency Symbol | SEI |

### RPC Endpoints

| Type | URL |
|------|-----|
| EVM JSON-RPC | `https://evm-rpc-arctic-1.sei-apis.com` |

### Block Explorers

| Explorer | URL |
|----------|-----|
| Seitrace (devnet) | https://seitrace.com/?chain=arctic-1 |

## Foundry Configuration

```toml
# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
evm_version = "paris"

[rpc_endpoints]
sei = "https://evm-rpc.sei-apis.com"
sei_testnet = "https://evm-rpc-testnet.sei-apis.com"
sei_devnet = "https://evm-rpc-arctic-1.sei-apis.com"

[etherscan]
sei = { key = "${SEITRACE_API_KEY}", chain = 1329, url = "https://seitrace.com/api" }
sei_testnet = { key = "${SEITRACE_API_KEY}", chain = 1328, url = "https://seitrace.com/api?chain=atlantic-2" }
```

## Hardhat Configuration

```typescript
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { evmVersion: "paris" },
  },
  networks: {
    sei: {
      url: "https://evm-rpc.sei-apis.com",
      chainId: 1329,
      accounts: [process.env.PRIVATE_KEY!],
    },
    seiTestnet: {
      url: "https://evm-rpc-testnet.sei-apis.com",
      chainId: 1328,
      accounts: [process.env.PRIVATE_KEY!],
    },
    seiDevnet: {
      url: "https://evm-rpc-arctic-1.sei-apis.com",
      chainId: 713715,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
};
```

## viem Chain Definitions

```typescript
import { defineChain } from "viem";

export const sei = defineChain({
  id: 1329,
  name: "Sei",
  nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://evm-rpc.sei-apis.com"],
      webSocket: ["wss://evm-ws.sei-apis.com"],
    },
  },
  blockExplorers: {
    default: { name: "Seitrace", url: "https://seitrace.com" },
  },
});

export const seiTestnet = defineChain({
  id: 1328,
  name: "Sei Testnet",
  nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://evm-rpc-testnet.sei-apis.com"],
      webSocket: ["wss://evm-ws-testnet.sei-apis.com"],
    },
  },
  blockExplorers: {
    default: { name: "Seitrace", url: "https://seitrace.com/?chain=atlantic-2" },
  },
  testnet: true,
});

export const seiDevnet = defineChain({
  id: 713715,
  name: "Sei Devnet",
  nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://evm-rpc-arctic-1.sei-apis.com"],
    },
  },
  blockExplorers: {
    default: { name: "Seitrace", url: "https://seitrace.com/?chain=arctic-1" },
  },
  testnet: true,
});
```

## SEI Token Decimals

| Context | Denom | Decimals | 1 SEI Represented As |
|---------|-------|----------|---------------------|
| EVM (msg.value, balanceOf) | wei | 18 | 1_000_000_000_000_000_000 |
| Cosmos (bank module) | usei | 6 | 1_000_000 |
| Display | SEI | 0 | 1 |

The chain handles conversion automatically across EVM and Cosmos boundaries. When using precompiles that accept Cosmos denoms, amounts are in the Cosmos representation (6 decimals for usei).

## Consensus

| Parameter | Value |
|-----------|-------|
| Consensus | Twin-Turbo (optimistic block processing) |
| Block Time | ~390ms |
| Finality | Single-slot (~390ms) |
| Execution Model | Parallel optimistic (SeiDB) |
| Validator Set | Tendermint BFT |
