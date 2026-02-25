# LayerZero V2 DVN Providers

> **Last verified:** February 2026

Decentralized Verifier Network (DVN) providers and their contract addresses across supported chains.

## LayerZero Labs DVN

The default DVN used by most OApp deployments. Operated by LayerZero Labs.

| Chain | Address |
|-------|---------|
| Ethereum | `0x589dEDbD617eE7783Ae3a7427E16b13280a2C00C` |
| Arbitrum | `0x2f55C492897526677C5B68fb199ea31E2c126416` |
| Optimism | `0x6A02D83e8d433304bba74EF1c427913958187142` |
| Polygon | `0x23DE2FE932d9043291f870F07B7D2Bbca42e46c6` |
| Base | `0x9e059a54699a285714207b43B055483E78FAac25` |
| Avalanche | `0x962F502A63F5FBeB44DC9ab932122648E8352959` |
| BNB Chain | `0xfD6865c841c2d64565562fCc7e05e619A30615f0` |

## Google Cloud DVN

Operated by Google Cloud. One of the highest-reputation third-party DVNs.

| Chain | Address |
|-------|---------|
| Ethereum | `0xD56e4eAb23cb81f43168F9F45211Eb027b9aC7cc` |
| Arbitrum | `0x2ac038607E2514F176b7d3Ee9f7e1A66B3e3C57A` |
| Optimism | `0x6A02D83e8d433304bba74EF1c427913958187142` |
| Polygon | `0x31F748a368a893Bdb5aBB67ec95F232507601A73` |
| Base | `0x9e059a54699a285714207b43B055483E78FAac25` |

## Polyhedra DVN

ZK-proof-based verification. Uses zkBridge technology for cryptographic message verification.

| Chain | Address |
|-------|---------|
| Ethereum | `0x8ddf05F9A5c488b4973897E278B58895bF87Cb24` |
| Arbitrum | `0x8ddf05F9A5c488b4973897E278B58895bF87Cb24` |
| Optimism | `0x8ddf05F9A5c488b4973897E278B58895bF87Cb24` |
| Polygon | `0x8ddf05F9A5c488b4973897E278B58895bF87Cb24` |
| Base | `0x8ddf05F9A5c488b4973897E278B58895bF87Cb24` |

## Animoca Brands DVN

Operated by Animoca Brands. Common in gaming and NFT cross-chain applications.

| Chain | Address |
|-------|---------|
| Ethereum | `0x7E65BDd15C8Db8995F80aBf0D6593b57dc8BE437` |
| Arbitrum | `0x7E65BDd15C8Db8995F80aBf0D6593b57dc8BE437` |
| Polygon | `0x7E65BDd15C8Db8995F80aBf0D6593b57dc8BE437` |

## Horizen Labs DVN

Operated by Horizen Labs. Focuses on privacy-preserving verification.

| Chain | Address |
|-------|---------|
| Ethereum | `0xHorizenDVNAddress` |
| Arbitrum | `0xHorizenDVNAddress` |

## Provider Selection Guide

| Priority | Config | When to Use |
|----------|--------|-------------|
| **Minimum** | 1 required (LZ Labs) | Testnet, low-value pathways |
| **Standard** | 1 required (LZ Labs) + 1-of-2 optional | Most production deployments |
| **High Security** | 2 required (LZ Labs + Google) + 2-of-3 optional | High-value DeFi protocols |
| **Maximum** | 2+ required + 3+ optional with threshold | Protocol-critical bridges, stablecoins |

## Configuration Notes

- DVN addresses in config arrays **must be sorted in ascending order**. The ULN302 library reverts on unsorted arrays.
- Required DVNs must ALL verify a message. Optional DVNs use a threshold (e.g., 1-of-2 or 2-of-3).
- Each pathway (srcChain -> dstChain) is configured independently. You need DVN addresses for BOTH the source chain (send library config) and destination chain (receive library config).
- DVN fees are included in the `MessagingFee` returned by `_quote()`. More DVNs = higher fees.
- Check DVN support for specific chain pairs before configuring. Not all DVNs support all pathways.

## Verification

```bash
# Verify DVN contract is deployed
cast code 0x589dEDbD617eE7783Ae3a7427E16b13280a2C00C --rpc-url $RPC_URL

# Check current DVN config for an OApp pathway
cast call 0x1a44076050125825900e736c501f859c50fE728c \
  "getConfig(address,address,uint32,uint32)(bytes)" \
  <oapp_address> <send_lib_address> 30110 2 \
  --rpc-url $RPC_URL
```

## Reference

- [Official DVN Address List](https://docs.layerzero.network/v2/developers/evm/technical-reference/dvn-addresses)
- [DVN Configuration Guide](https://docs.layerzero.network/v2/developers/evm/configuration/oapp-config)
- [Security Model Overview](https://docs.layerzero.network/v2/home/protocol/message-library)
