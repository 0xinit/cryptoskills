# Chain Configuration Reference

Built-in chain definitions shipped with `viem/chains`. Each chain object includes chain ID, native currency, block explorer, and default RPC URLs.

## Import

```typescript
import { mainnet, sepolia, arbitrum, optimism, base, polygon } from "viem/chains";
```

## Ethereum

| Chain | Import | Chain ID | Native Currency | Block Explorer |
|-------|--------|----------|----------------|----------------|
| Mainnet | `mainnet` | 1 | ETH (18) | https://etherscan.io |
| Sepolia | `sepolia` | 11155111 | ETH (18) | https://sepolia.etherscan.io |
| Holesky | `holesky` | 17000 | ETH (18) | https://holesky.etherscan.io |

## Arbitrum

| Chain | Import | Chain ID | Native Currency | Block Explorer |
|-------|--------|----------|----------------|----------------|
| Arbitrum One | `arbitrum` | 42161 | ETH (18) | https://arbiscan.io |
| Arbitrum Sepolia | `arbitrumSepolia` | 421614 | ETH (18) | https://sepolia.arbiscan.io |

## Optimism

| Chain | Import | Chain ID | Native Currency | Block Explorer |
|-------|--------|----------|----------------|----------------|
| OP Mainnet | `optimism` | 10 | ETH (18) | https://optimistic.etherscan.io |
| OP Sepolia | `optimismSepolia` | 11155420 | ETH (18) | https://sepolia-optimism.etherscan.io |

## Base

| Chain | Import | Chain ID | Native Currency | Block Explorer |
|-------|--------|----------|----------------|----------------|
| Base | `base` | 8453 | ETH (18) | https://basescan.org |
| Base Sepolia | `baseSepolia` | 84532 | ETH (18) | https://sepolia.basescan.org |

## Polygon

| Chain | Import | Chain ID | Native Currency | Block Explorer |
|-------|--------|----------|----------------|----------------|
| Polygon PoS | `polygon` | 137 | POL (18) | https://polygonscan.com |
| Polygon Amoy | `polygonAmoy` | 80002 | POL (18) | https://amoy.polygonscan.com |

## Other L2s

| Chain | Import | Chain ID | Native Currency | Block Explorer |
|-------|--------|----------|----------------|----------------|
| zkSync Era | `zksync` | 324 | ETH (18) | https://explorer.zksync.io |
| Scroll | `scroll` | 534352 | ETH (18) | https://scrollscan.com |
| Linea | `linea` | 59144 | ETH (18) | https://lineascan.build |
| Avalanche C-Chain | `avalanche` | 43114 | AVAX (18) | https://snowtrace.io |
| BNB Smart Chain | `bsc` | 56 | BNB (18) | https://bscscan.com |
| Gnosis | `gnosis` | 100 | xDAI (18) | https://gnosisscan.io |

## Custom Chain Definition

```typescript
import { defineChain } from "viem";

const myChain = defineChain({
  id: 12345,
  name: "My Chain",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.mychain.io"],
      webSocket: ["wss://rpc.mychain.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "MyChainScan",
      url: "https://scan.mychain.io",
    },
  },
});
```

## Using a Chain with a Client

```typescript
import { createPublicClient, http } from "viem";
import { arbitrum } from "viem/chains";

const client = createPublicClient({
  chain: arbitrum,
  transport: http(), // uses chain's default RPC
});
```

Override the default RPC with your own provider:

```typescript
const client = createPublicClient({
  chain: arbitrum,
  transport: http("https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY"),
});
```

## Chain Object Shape

Every chain object follows this structure:

```typescript
{
  id: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: { default: { http: string[]; webSocket?: string[] } };
  blockExplorers: { default: { name: string; url: string } };
  contracts?: {
    multicall3?: { address: `0x${string}`; blockCreated?: number };
    ensRegistry?: { address: `0x${string}` };
    ensUniversalResolver?: { address: `0x${string}` };
  };
}
```
