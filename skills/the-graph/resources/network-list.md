# The Graph Supported Networks

Networks available on The Graph's decentralized network and Subgraph Studio.

Last verified: 2026-02-26

## Decentralized Network (Production)

These networks are fully supported on the decentralized network with indexer incentives.

| Network | `network` value in manifest | Chain ID | Status |
|---------|---------------------------|----------|--------|
| Ethereum Mainnet | `mainnet` | 1 | Active |
| Arbitrum One | `arbitrum-one` | 42161 | Active |
| Optimism | `optimism` | 10 | Active |
| Base | `base` | 8453 | Active |
| Polygon | `matic` | 137 | Active |
| Avalanche C-Chain | `avalanche` | 43114 | Active |
| BSC (BNB Chain) | `bsc` | 56 | Active |
| Celo | `celo` | 42220 | Active |
| Gnosis Chain | `gnosis` | 100 | Active |
| Fantom | `fantom` | 250 | Active |
| Polygon zkEVM | `polygon-zkevm` | 1101 | Active |
| zkSync Era | `zksync-era` | 324 | Active |
| Scroll | `scroll` | 534352 | Active |
| Linea | `linea` | 59144 | Active |
| Blast | `blast-mainnet` | 81457 | Active |
| Mode | `mode-mainnet` | 34443 | Active |
| SEI | `sei-mainnet` | 1329 | Active |

## Subgraph Studio Only (Testing/Development)

These networks are available on Studio but may have limited indexer support on the decentralized network.

| Network | `network` value | Chain ID | Notes |
|---------|----------------|----------|-------|
| Ethereum Goerli | `goerli` | 5 | Deprecated testnet |
| Ethereum Sepolia | `sepolia` | 11155111 | Active testnet |
| Arbitrum Sepolia | `arbitrum-sepolia` | 421614 | Active testnet |
| Optimism Sepolia | `optimism-sepolia` | 11155420 | Active testnet |
| Base Sepolia | `base-sepolia` | 84532 | Active testnet |
| Polygon Amoy | `polygon-amoy` | 80002 | Replaced Mumbai |
| Avalanche Fuji | `fuji` | 43113 | Active testnet |
| BSC Testnet | `chapel` | 97 | Active testnet |

## Network Configuration in Manifest

```yaml
# subgraph.yaml -- set network per data source
dataSources:
  - kind: ethereum
    name: MyContract
    network: arbitrum-one  # Must match a value from the tables above
    source:
      address: "0x..."
      abi: MyContract
      startBlock: 100000000
```

## Multi-Network Deployment

Use `networks.json` to deploy the same subgraph logic to multiple chains.

```json
{
  "mainnet": {
    "MyContract": {
      "address": "0x1111111111111111111111111111111111111111",
      "startBlock": 18000000
    }
  },
  "arbitrum-one": {
    "MyContract": {
      "address": "0x2222222222222222222222222222222222222222",
      "startBlock": 150000000
    }
  },
  "base": {
    "MyContract": {
      "address": "0x3333333333333333333333333333333333333333",
      "startBlock": 5000000
    }
  }
}
```

```bash
# Deploy to specific network
graph deploy --studio my-subgraph-mainnet --network mainnet --network-file networks.json
graph deploy --studio my-subgraph-arbitrum --network arbitrum-one --network-file networks.json
```

## Network-Specific Considerations

| Network | Consideration |
|---------|---------------|
| Ethereum Mainnet | Slowest block times (~12s). Largest state. Most expensive to index. |
| Arbitrum One | Fast blocks (~0.25s). High event volume. Set `startBlock` precisely. |
| Optimism | Bedrock upgrade changed block structure. Use current ABIs. |
| Base | High throughput. Many events per block. Expect longer indexing times. |
| Polygon | Frequent reorgs (up to 64 blocks). Subgraph handles this automatically. |
| BSC | 3-second blocks. Very high volume. Pruning strongly recommended. |
| Gnosis Chain | 5-second blocks. Lower gas costs mean more transactions per block. |
| zkSync Era | Different EVM opcodes. Some contract patterns may not emit expected events. |

## Checking Network Support

```bash
# Verify a network is supported by checking graph-cli
graph init --help
# Look at the --network flag options

# Or check the official list
# https://thegraph.com/docs/en/developing/supported-networks/
```

## Deprecated Networks

| Network | Status | Migration |
|---------|--------|-----------|
| Ethereum Rinkeby | Shut down | Migrate to Sepolia |
| Ethereum Ropsten | Shut down | Migrate to Sepolia |
| Polygon Mumbai | Shut down | Migrate to Amoy |
| Ethereum Goerli | Deprecated | Migrate to Sepolia |
