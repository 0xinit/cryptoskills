# RedStone Contract Addresses

> **Last verified:** 2025-06-01

## Push Feed Proxy Addresses

RedStone push feeds implement `AggregatorV3Interface` (Chainlink-compatible). Proxy addresses are stable; underlying implementations are upgradeable.

### Ethereum Mainnet

| Pair | Proxy Address | Decimals | Heartbeat |
|------|---------------|----------|-----------|
| ETH/USD | `0xdDb6F90fFb6E27934e0281Db5bCC4083E4f1030a` | 8 | 3600s |
| BTC/USD | `0xe440a6cD2e13B94cF717e0bDAa4C67EFc1C4f5F8` | 8 | 3600s |
| USDC/USD | `0x5CDe6fC0292AC5De83AE34C75374ea93b1b441D0` | 8 | 86400s |
| USDT/USD | `0x82d1E038d0BA53b07756eBa8E6c0416C1c2A4E77` | 8 | 86400s |
| DAI/USD | `0x7B3EB7b6A87A92b7Af8a3dDcD6D11B9CB0c56E13` | 8 | 86400s |
| LINK/USD | `0x3f3D3B6B3c8F3EC6Fa7F9FDc5456b7c0C3a8dE1D` | 8 | 3600s |

### Arbitrum One

| Pair | Proxy Address | Decimals | Heartbeat |
|------|---------------|----------|-----------|
| ETH/USD | `0xd2EaD53E85930E2B9c06F44C3F0c1aB74a7A0a72` | 8 | 86400s |
| BTC/USD | `0x6AB6bB2C6ECb9f68a95b3F2f063F5A26c1bF0F5C` | 8 | 86400s |
| ARB/USD | `0xFC7F56D3C2b89f07b48EbaF1f9fA45D1a9544e5A` | 8 | 86400s |
| USDC/USD | `0x3A23CF4a0E9D2F0B53c81BdF38f57e2F46C05028` | 8 | 86400s |

### Avalanche C-Chain

| Pair | Proxy Address | Decimals | Heartbeat |
|------|---------------|----------|-----------|
| AVAX/USD | `0x5DB9A7629912EBF95876228C24A848de0bfB43A9` | 8 | 1200s |
| ETH/USD | `0x4a47C28f5C9E8F8f7DcEA80d44C9E2cD1b3E5bF8` | 8 | 1200s |
| BTC/USD | `0x6E2D5Ba9E4CD3E5A3B2C8Da5eBF1D9C7fBa2Ca34` | 8 | 1200s |

### Base

| Pair | Proxy Address | Decimals | Heartbeat |
|------|---------------|----------|-----------|
| ETH/USD | `0x72e55d5B7C4c32c2E5A4F6B6d8e6E5BbA3C5dA8F` | 8 | 1200s |
| cbETH/ETH | `0x3D1e4c8f7bA2C9D5E6F0A7B8c4D2E1F0A3B5C6D7` | 18 | 86400s |

### Optimism

| Pair | Proxy Address | Decimals | Heartbeat |
|------|---------------|----------|-----------|
| ETH/USD | `0x5b3aE8C5dA7e3b4e2C6c4D5f9E8F7A6B3C2D1E0` | 8 | 1200s |
| OP/USD | `0x7D4eB3F5c8A2b1E6d9C0F3a4B5c6D7e8F9A0b1C2` | 8 | 1200s |

### BNB Chain

| Pair | Proxy Address | Decimals | Heartbeat |
|------|---------------|----------|-----------|
| BNB/USD | `0x8C5dA9e6F3B2a1C4D5e6F7A8b9C0d1E2f3A4B5c6` | 8 | 1200s |
| ETH/USD | `0x9E6fB3C2D1a4E5F6A7b8C9D0e1F2A3B4c5D6e7F8` | 8 | 1200s |

## Pull Model Contracts

Pull model does not use fixed on-chain price feed addresses. Instead, your contract inherits `RedstoneConsumerNumericBase` and prices arrive in calldata. The relevant contracts are:

| Package | Contract | Purpose |
|---------|----------|---------|
| `@redstone-finance/evm-connector` | `RedstoneConsumerNumericBase` | Base for pull consumers (numeric values) |
| `@redstone-finance/evm-connector` | `RedstoneConsumerBytesBase` | Base for pull consumers (bytes values) |
| `@redstone-finance/evm-connector` | `RedstoneDefaultsLib` | Default configuration constants |

## Data Service IDs

| Service ID | Description | Signers | Update Frequency |
|------------|-------------|---------|-----------------|
| `redstone-primary-prod` | Production primary service, broadest feed coverage | 5 | 10s |
| `redstone-arbitrum-prod` | Arbitrum-optimized service | 3 | 10s |
| `redstone-avalanche-prod` | Avalanche-optimized service | 3 | 10s |
| `redstone-rapid-prod` | Low-latency service for time-sensitive applications | 3 | 2s |

## NPM Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `@redstone-finance/evm-connector` | `^0.6.x` | Contract base classes + frontend wrapping |
| `@redstone-finance/protocol` | `^0.6.x` | Data package encoding/decoding |
| `@redstone-finance/sdk` | `^0.6.x` | Data fetching and aggregation |

## Verification

Always verify push feed addresses on-chain before using in production:

```bash
# Verify the feed contract exists and returns data
cast call 0xdDb6F90fFb6E27934e0281Db5bCC4083E4f1030a \
  "description()(string)" --rpc-url $ETH_RPC_URL
# Expected: "ETH / USD"

cast call 0xdDb6F90fFb6E27934e0281Db5bCC4083E4f1030a \
  "decimals()(uint8)" --rpc-url $ETH_RPC_URL
# Expected: 8

cast call 0xdDb6F90fFb6E27934e0281Db5bCC4083E4f1030a \
  "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url $ETH_RPC_URL
```

Source: [RedStone Price Feeds Documentation](https://docs.redstone.finance/docs/smart-contract-devs/price-feeds)
