# Tenderly Supported Networks

> **Last verified:** February 2026

Network IDs used in the `network_id` field of Tenderly API requests. Pass as **strings**, not numbers.

## Mainnet Networks

| Network | Network ID | Chain ID | Currency |
|---------|-----------|----------|----------|
| Ethereum | `"1"` | 1 | ETH |
| Polygon | `"137"` | 137 | MATIC |
| Arbitrum One | `"42161"` | 42161 | ETH |
| Optimism | `"10"` | 10 | ETH |
| Base | `"8453"` | 8453 | ETH |
| Avalanche C-Chain | `"43114"` | 43114 | AVAX |
| BNB Smart Chain | `"56"` | 56 | BNB |
| Fantom | `"250"` | 250 | FTM |
| Gnosis (xDai) | `"100"` | 100 | xDAI |
| Cronos | `"25"` | 25 | CRO |
| Moonbeam | `"1284"` | 1284 | GLMR |
| Moonriver | `"1285"` | 1285 | MOVR |
| Boba Network | `"288"` | 288 | ETH |
| RSK | `"30"` | 30 | RBTC |
| Linea | `"59144"` | 59144 | ETH |
| Scroll | `"534352"` | 534352 | ETH |
| zkSync Era | `"324"` | 324 | ETH |
| Polygon zkEVM | `"1101"` | 1101 | ETH |
| Mantle | `"5000"` | 5000 | MNT |
| Blast | `"81457"` | 81457 | ETH |

## Testnet Networks

| Network | Network ID | Chain ID | Currency |
|---------|-----------|----------|----------|
| Ethereum Sepolia | `"11155111"` | 11155111 | ETH |
| Ethereum Holesky | `"17000"` | 17000 | ETH |
| Polygon Amoy | `"80002"` | 80002 | MATIC |
| Arbitrum Sepolia | `"421614"` | 421614 | ETH |
| Optimism Sepolia | `"11155420"` | 11155420 | ETH |
| Base Sepolia | `"84532"` | 84532 | ETH |
| Avalanche Fuji | `"43113"` | 43113 | AVAX |
| BNB Testnet | `"97"` | 97 | BNB |
| Fantom Testnet | `"4002"` | 4002 | FTM |
| Linea Goerli | `"59140"` | 59140 | ETH |
| Scroll Sepolia | `"534351"` | 534351 | ETH |
| Blast Sepolia | `"168587773"` | 168587773 | ETH |

## Feature Availability by Network

Not all features are available on every network.

| Feature | Ethereum | L2s | Alt-L1s | Testnets |
|---------|----------|-----|---------|----------|
| Transaction Simulation | Yes | Yes | Yes | Yes |
| Bundle Simulation | Yes | Yes | Yes | Yes |
| Virtual TestNets (Forks) | Yes | Yes | Yes | Yes |
| Transaction Debugging | Yes | Yes | Most | Yes |
| Gas Profiling | Yes | Yes | Most | Yes |
| Alerts | Yes | Yes | Yes | Yes |
| Web3 Actions | Yes | Yes | Yes | Yes |
| Contract Verification | Yes | Yes | Yes | Yes |
| State Overrides | Yes | Yes | Yes | Yes |

## Notes

- Network IDs correspond to chain IDs for most networks
- Some older networks may have network IDs that differ from chain IDs — always use the value from this table
- Tenderly adds support for new networks regularly — check the dashboard for the latest list
- Virtual TestNet `fork_config.network_id` takes a **number** (e.g., `1`), while simulation `network_id` takes a **string** (e.g., `"1"`) — this inconsistency exists in the API
- L2 simulations may take longer than L1 simulations due to additional data availability verification
- Testnets may have intermittent indexing delays compared to mainnets

## Using Network ID in Code

```typescript
// Simulation endpoint: network_id is a STRING
const simRequest = {
  network_id: "1", // correct
  from: "0x...",
  to: "0x...",
  input: "0x...",
  value: "0",
  gas: 100_000,
  gas_price: "0",
  save: false,
  save_if_fails: false,
  simulation_type: "quick" as const,
};

// VNet creation: network_id is a NUMBER
const vnetRequest = {
  slug: "my-fork",
  display_name: "My Fork",
  fork_config: {
    network_id: 1, // correct (number, not string)
  },
  virtual_network_config: {
    chain_config: {
      chain_id: 73571,
    },
  },
  sync_state_config: { enabled: false },
  explorer_page_config: {
    enabled: true,
    verification_visibility: "src" as const,
  },
};
```
