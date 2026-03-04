# Marketplace Contract Addresses

> **Last verified:** March 2026

## Seaport 1.6

Seaport 1.6 is deployed at a deterministic address via CREATE2. The same address is valid on every EVM chain.

| Chain | Address | Status |
|-------|---------|--------|
| Ethereum | `0x0000000000000068F116A894984e2DB1123eB395` | Active |
| Arbitrum | `0x0000000000000068F116A894984e2DB1123eB395` | Active |
| Base | `0x0000000000000068F116A894984e2DB1123eB395` | Active |
| Optimism | `0x0000000000000068F116A894984e2DB1123eB395` | Active |
| Polygon | `0x0000000000000068F116A894984e2DB1123eB395` | Active |
| Avalanche | `0x0000000000000068F116A894984e2DB1123eB395` | Active |
| BSC | `0x0000000000000068F116A894984e2DB1123eB395` | Active |
| Sepolia | `0x0000000000000068F116A894984e2DB1123eB395` | Active |

## Seaport Conduit Controller

| Chain | Address | Status |
|-------|---------|--------|
| All EVM | `0x00000000F9490004C11Cef243f5400493c00Ad63` | Active |

## OpenSea API Endpoints

| Network | Base URL |
|---------|----------|
| Ethereum Mainnet | `https://api.opensea.io/api/v2` |
| Polygon | `https://api.opensea.io/api/v2` |
| Arbitrum | `https://api.opensea.io/api/v2` |
| Base | `https://api.opensea.io/api/v2` |
| Optimism | `https://api.opensea.io/api/v2` |
| Sepolia (testnet) | `https://testnets-api.opensea.io/api/v2` |

All mainnet requests use the same base URL with chain specified in the path (e.g., `/chain/ethereum/...`).

### Common API Calls

```bash
# Get NFT metadata
curl "https://api.opensea.io/api/v2/chain/ethereum/contract/$CONTRACT/nfts/$TOKEN_ID" \
  -H "X-API-KEY: $OPENSEA_API_KEY"

# Refresh metadata for a specific token
curl -X POST "https://api.opensea.io/api/v2/chain/ethereum/contract/$CONTRACT/nfts/$TOKEN_ID/refresh" \
  -H "X-API-KEY: $OPENSEA_API_KEY"

# Get collection stats
curl "https://api.opensea.io/api/v2/collections/$COLLECTION_SLUG/stats" \
  -H "X-API-KEY: $OPENSEA_API_KEY"

# List active orders for an NFT
curl "https://api.opensea.io/api/v2/orders/ethereum/seaport/listings?asset_contract_address=$CONTRACT&token_ids=$TOKEN_ID" \
  -H "X-API-KEY: $OPENSEA_API_KEY"
```

## ERC-6551 Registry

| Chain | Address | Status |
|-------|---------|--------|
| All EVM | `0x000000006551c19487814612e58FE06813775758` | Active |

## Deprecated Marketplaces

| Protocol | Status | Migration |
|----------|--------|-----------|
| Reservoir | Shut down October 2025 | Use Seaport/OpenSea API directly |
| LooksRare v1 | Deprecated | LooksRare v2 or Seaport |
| Seaport 1.4 | Superseded | Seaport 1.6 |
| Seaport 1.5 | Superseded | Seaport 1.6 |

## Verification

```bash
# Verify Seaport 1.6 is deployed
cast code 0x0000000000000068F116A894984e2DB1123eB395 --rpc-url $RPC_URL

# Verify ERC-6551 Registry
cast code 0x000000006551c19487814612e58FE06813775758 --rpc-url $RPC_URL

# Query Seaport name
cast call 0x0000000000000068F116A894984e2DB1123eB395 "name()(string)" --rpc-url $RPC_URL
```

## Reference

- [Seaport Protocol (ProjectOpenSea)](https://github.com/ProjectOpenSea/seaport)
- [Seaport 1.6 Deployment](https://github.com/ProjectOpenSea/seaport/releases)
- [OpenSea API Documentation](https://docs.opensea.io/reference/api-overview)
- [ERC-6551 Reference Deployments](https://github.com/erc6551/reference)
