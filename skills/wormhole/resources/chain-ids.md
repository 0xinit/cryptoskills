# Wormhole Chain ID Mapping

> **Last verified:** February 2026

Wormhole uses its own chain ID scheme that is **separate from EVM chain IDs**. Using EVM chain IDs in Wormhole functions will route messages to the wrong chain or cause reverts.

## EVM Chains

| Chain | Wormhole Chain ID | EVM Chain ID | Network |
|-------|-------------------|-------------|---------|
| Ethereum | 2 | 1 | Mainnet |
| BSC | 4 | 56 | Mainnet |
| Polygon | 5 | 137 | Mainnet |
| Avalanche | 6 | 43114 | C-Chain |
| Fantom | 10 | 250 | Opera |
| Klaytn | 13 | 8217 | Mainnet |
| Celo | 14 | 42220 | Mainnet |
| Moonbeam | 16 | 1284 | Mainnet |
| Arbitrum | 23 | 42161 | One |
| Optimism | 24 | 10 | Mainnet |
| Gnosis | 25 | 100 | Mainnet |
| Base | 30 | 8453 | Mainnet |
| Scroll | 34 | 534352 | Mainnet |
| Mantle | 35 | 5000 | Mainnet |
| Blast | 36 | 81457 | Mainnet |
| Linea | 38 | 59144 | Mainnet |

## Non-EVM Chains

| Chain | Wormhole Chain ID | Network |
|-------|-------------------|---------|
| Solana | 1 | Mainnet |
| Terra Classic | 3 | Columbus-5 |
| Terra 2 | 18 | Phoenix-1 |
| Algorand | 8 | Mainnet |
| Near | 15 | Mainnet |
| Sui | 21 | Mainnet |
| Aptos | 22 | Mainnet |
| Sei | 32 | Pacific-1 |
| Cosmos Hub | 4000 | Cosmoshub-4 |
| Osmosis | 20 | Osmosis-1 |
| Injective | 19 | Mainnet |

## Testnet Chain IDs

Testnet chain IDs match mainnet Wormhole IDs but target testnet networks.

| Chain | Wormhole Chain ID | Testnet Network | Testnet EVM Chain ID |
|-------|-------------------|----------------|---------------------|
| Ethereum | 2 | Sepolia | 11155111 |
| Arbitrum | 23 | Sepolia | 421614 |
| Optimism | 24 | Sepolia | 11155420 |
| Base | 30 | Sepolia | 84532 |
| Solana | 1 | Devnet | N/A |
| BSC | 4 | Testnet | 97 |
| Polygon | 5 | Amoy | 80002 |
| Avalanche | 6 | Fuji | 43113 |

## Conversion Helpers

### TypeScript

```typescript
const WORMHOLE_CHAIN_IDS: Record<number, number> = {
  // EVM Chain ID -> Wormhole Chain ID
  1: 2,       // Ethereum
  56: 4,      // BSC
  137: 5,     // Polygon
  43114: 6,   // Avalanche
  250: 10,    // Fantom
  42161: 23,  // Arbitrum
  10: 24,     // Optimism
  8453: 30,   // Base
  534352: 34, // Scroll
  5000: 35,   // Mantle
  81457: 36,  // Blast
  59144: 38,  // Linea
};

const EVM_CHAIN_IDS: Record<number, number> = {
  // Wormhole Chain ID -> EVM Chain ID
  2: 1,       // Ethereum
  4: 56,      // BSC
  5: 137,     // Polygon
  6: 43114,   // Avalanche
  10: 250,    // Fantom
  23: 42161,  // Arbitrum
  24: 10,     // Optimism
  30: 8453,   // Base
  34: 534352, // Scroll
  35: 5000,   // Mantle
  36: 81457,  // Blast
  38: 59144,  // Linea
};

function evmToWormholeChainId(evmChainId: number): number {
  const wormholeId = WORMHOLE_CHAIN_IDS[evmChainId];
  if (wormholeId === undefined) {
    throw new Error(`No Wormhole chain ID mapping for EVM chain ${evmChainId}`);
  }
  return wormholeId;
}

function wormholeToEvmChainId(wormholeChainId: number): number {
  const evmId = EVM_CHAIN_IDS[wormholeChainId];
  if (evmId === undefined) {
    throw new Error(`Wormhole chain ${wormholeChainId} is not an EVM chain or has no mapping`);
  }
  return evmId;
}
```

### Solidity

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @dev Wormhole chain ID constants for type-safe cross-chain targeting
library WormholeChainIds {
    uint16 internal constant SOLANA = 1;
    uint16 internal constant ETHEREUM = 2;
    uint16 internal constant BSC = 4;
    uint16 internal constant POLYGON = 5;
    uint16 internal constant AVALANCHE = 6;
    uint16 internal constant FANTOM = 10;
    uint16 internal constant SUI = 21;
    uint16 internal constant APTOS = 22;
    uint16 internal constant ARBITRUM = 23;
    uint16 internal constant OPTIMISM = 24;
    uint16 internal constant BASE = 30;
    uint16 internal constant SCROLL = 34;
    uint16 internal constant MANTLE = 35;
    uint16 internal constant BLAST = 36;
}
```

## Common Mistakes

| Mistake | What Happens | Correct Usage |
|---------|-------------|--------------|
| Using EVM chain ID 1 for Ethereum | Routes to Solana (Wormhole ID 1) | Use Wormhole ID 2 for Ethereum |
| Using EVM chain ID 10 for Optimism | Routes to Fantom (Wormhole ID 10) | Use Wormhole ID 24 for Optimism |
| Using EVM chain ID 42161 for Arbitrum | Reverts -- no chain with that Wormhole ID | Use Wormhole ID 23 for Arbitrum |
| Assuming Wormhole ID = EVM ID | Sends to wrong chain or reverts | Always use the mapping table |

## Reference

- [Official Chain ID Reference](https://docs.wormhole.com/docs/build/reference/chain-ids/)
