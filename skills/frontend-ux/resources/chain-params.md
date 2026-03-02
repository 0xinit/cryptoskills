# Chain Configuration Parameters

Chain parameters for major EVM networks. Used in wagmi config, `wallet_addEthereumChain`, and manual chain definitions.

Last verified: February 2026.

## Ethereum Mainnet

| Parameter | Value |
|-----------|-------|
| Chain ID | 1 |
| Name | Ethereum |
| Native Currency | ETH (18 decimals) |
| RPC URL | https://eth.llamarpc.com |
| Block Explorer | https://etherscan.io |
| Avg Block Time | 12 seconds |

## Arbitrum One

| Parameter | Value |
|-----------|-------|
| Chain ID | 42161 |
| Name | Arbitrum One |
| Native Currency | ETH (18 decimals) |
| RPC URL | https://arb1.arbitrum.io/rpc |
| Block Explorer | https://arbiscan.io |
| Avg Block Time | 0.25 seconds |

## Base

| Parameter | Value |
|-----------|-------|
| Chain ID | 8453 |
| Name | Base |
| Native Currency | ETH (18 decimals) |
| RPC URL | https://mainnet.base.org |
| Block Explorer | https://basescan.org |
| Avg Block Time | 2 seconds |

## Optimism

| Parameter | Value |
|-----------|-------|
| Chain ID | 10 |
| Name | OP Mainnet |
| Native Currency | ETH (18 decimals) |
| RPC URL | https://mainnet.optimism.io |
| Block Explorer | https://optimistic.etherscan.io |
| Avg Block Time | 2 seconds |

## Polygon

| Parameter | Value |
|-----------|-------|
| Chain ID | 137 |
| Name | Polygon |
| Native Currency | POL (18 decimals) |
| RPC URL | https://polygon-rpc.com |
| Block Explorer | https://polygonscan.com |
| Avg Block Time | 2 seconds |

## zkSync Era

| Parameter | Value |
|-----------|-------|
| Chain ID | 324 |
| Name | zkSync Era |
| Native Currency | ETH (18 decimals) |
| RPC URL | https://mainnet.era.zksync.io |
| Block Explorer | https://explorer.zksync.io |
| Avg Block Time | 1 second |

## wagmi Chain Imports

All chains above are available as pre-configured objects from `wagmi/chains`:

```typescript
import {
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
  zkSync,
} from "wagmi/chains";

// Each chain object includes chainId, name, nativeCurrency,
// rpcUrls, and blockExplorers -- ready for createConfig()
```

## Custom Chain Definition

For chains not included in wagmi's built-in list:

```typescript
import { defineChain } from "viem";

const myChain = defineChain({
  id: 999999,
  name: "My Network",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.mynetwork.com"] },
  },
  blockExplorers: {
    default: {
      name: "MyExplorer",
      url: "https://explorer.mynetwork.com",
    },
  },
});
```

## References

- wagmi chains: https://wagmi.sh/react/api/chains
- Chainlist (community RPC directory): https://chainlist.org
- EIP-3085 (wallet_addEthereumChain): https://eips.ethereum.org/EIPS/eip-3085
