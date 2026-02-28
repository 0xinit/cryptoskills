# Axelar Chain Name Registry

> **Last verified:** 2025-05-01

Axelar uses **string-based chain names**, NOT numeric chain IDs. These are case-sensitive. Using an incorrect chain name will cause the message to be routed to a nonexistent chain or silently fail.

## EVM Chains (Mainnet)

| Axelar Chain Name | EVM Chain ID | Network |
|-------------------|-------------|---------|
| `ethereum` | 1 | Mainnet |
| `arbitrum` | 42161 | One |
| `optimism` | 10 | Mainnet |
| `base` | 8453 | Mainnet |
| `polygon` | 137 | Mainnet |
| `avalanche` | 43114 | C-Chain |
| `binance` | 56 | BNB Chain |
| `fantom` | 250 | Opera |
| `celo` | 42220 | Mainnet |
| `moonbeam` | 1284 | Mainnet |
| `kava` | 2222 | EVM |
| `filecoin` | 314 | Mainnet |
| `linea` | 59144 | Mainnet |
| `mantle` | 5000 | Mainnet |
| `scroll` | 534352 | Mainnet |
| `blast` | 81457 | Mainnet |

## Non-EVM Chains

| Axelar Chain Name | Network |
|-------------------|---------|
| `osmosis` | Osmosis-1 |
| `cosmoshub` | Cosmoshub-4 |
| `sei` | Pacific-1 |
| `neutron` | Neutron-1 |
| `juno` | Juno-1 |
| `terra-2` | Phoenix-1 |
| `stargaze` | Stargaze-1 |
| `secret-snip` | Secret-4 |
| `axelar` | Axelar-dojo-1 |

## Testnet Chain Names

| Axelar Chain Name | EVM Chain ID | Testnet Network |
|-------------------|-------------|----------------|
| `ethereum-sepolia` | 11155111 | Sepolia |
| `arbitrum-sepolia` | 421614 | Arbitrum Sepolia |
| `base-sepolia` | 84532 | Base Sepolia |
| `optimism-sepolia` | 11155420 | Optimism Sepolia |
| `polygon-amoy` | 80002 | Polygon Amoy |
| `avalanche-fuji` | 43113 | Fuji C-Chain |
| `binance-testnet` | 97 | BSC Testnet |
| `fantom-testnet` | 4002 | Fantom Testnet |

## Conversion Helpers

### TypeScript

```typescript
// EVM Chain ID -> Axelar Chain Name
const AXELAR_CHAIN_NAMES: Record<number, string> = {
  1: "ethereum",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  137: "polygon",
  43114: "avalanche",
  56: "binance",
  250: "fantom",
  42220: "celo",
  1284: "moonbeam",
  2222: "kava",
  314: "filecoin",
  59144: "linea",
  5000: "mantle",
  534352: "scroll",
  81457: "blast",
};

// Axelar Chain Name -> EVM Chain ID
const EVM_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
  avalanche: 43114,
  binance: 56,
  fantom: 250,
  celo: 42220,
  moonbeam: 1284,
  kava: 2222,
  filecoin: 314,
  linea: 59144,
  mantle: 5000,
  scroll: 534352,
  blast: 81457,
};

function evmChainIdToAxelar(chainId: number): string {
  const name = AXELAR_CHAIN_NAMES[chainId];
  if (!name) {
    throw new Error(`No Axelar chain name for EVM chain ${chainId}`);
  }
  return name;
}

function axelarToEvmChainId(chainName: string): number {
  const id = EVM_CHAIN_IDS[chainName];
  if (id === undefined) {
    throw new Error(`No EVM chain ID for Axelar chain "${chainName}"`);
  }
  return id;
}
```

### Solidity

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

/// @dev Axelar chain name constants for type-safe cross-chain targeting
library AxelarChainNames {
    string internal constant ETHEREUM = "ethereum";
    string internal constant ARBITRUM = "arbitrum";
    string internal constant OPTIMISM = "optimism";
    string internal constant BASE = "base";
    string internal constant POLYGON = "polygon";
    string internal constant AVALANCHE = "avalanche";
    string internal constant BINANCE = "binance";
    string internal constant FANTOM = "fantom";
    string internal constant CELO = "celo";
    string internal constant MOONBEAM = "moonbeam";
    string internal constant LINEA = "linea";
    string internal constant MANTLE = "mantle";
    string internal constant SCROLL = "scroll";
    string internal constant BLAST = "blast";
}
```

## Common Mistakes

| Mistake | What Happens | Correct Usage |
|---------|-------------|---------------|
| Using `"Ethereum"` (capital E) | Message routes to nonexistent chain | Use `"ethereum"` (lowercase) |
| Using EVM chain ID `1` | Invalid -- Axelar uses strings | Use `"ethereum"` |
| Using `"bnb"` or `"bsc"` | Not the registered name | Use `"binance"` |
| Using `"avax"` | Not the registered name | Use `"avalanche"` |
| Using `"polygon-pos"` | Not the registered name | Use `"polygon"` |
| Using `"arb"` or `"arbitrum-one"` | Not the registered name | Use `"arbitrum"` |
| Using `"op"` or `"op-mainnet"` | Not the registered name | Use `"optimism"` |
| Using testnet name on mainnet | Routes to nonexistent chain on mainnet | `"ethereum"` for mainnet, `"ethereum-sepolia"` for testnet |

## Validating Chain Names

```bash
# Query Axelar API for supported chains
curl -s "https://api.axelarscan.io/api/getChains" | jq '.[].id'

# Check if a chain name is valid
curl -s "https://api.axelarscan.io/api/getChains" | jq '.[] | select(.id == "arbitrum")'
```

## Reference

- [Supported Chains](https://docs.axelar.dev/resources/contract-addresses/mainnet)
- [Chain Configuration](https://docs.axelar.dev/dev/reference/mainnet-chain-names)
