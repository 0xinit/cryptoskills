# Hyperlane Contract Addresses

> **Last verified:** February 2026

Verified deployment addresses for Hyperlane V3 core contracts. All addresses are checksummed.

## Domain IDs

Hyperlane uses `uint32` domain IDs to identify chains. For EVM chains, domain IDs typically match chain IDs.

| Chain | Domain ID | Chain ID |
|-------|-----------|----------|
| Ethereum | `1` | `1` |
| Arbitrum | `42161` | `42161` |
| Optimism | `10` | `10` |
| Base | `8453` | `8453` |
| Polygon | `137` | `137` |

## Core Contracts

| Contract | Ethereum | Arbitrum | Base | Optimism | Polygon |
|----------|----------|----------|------|----------|---------|
| Mailbox | `0xc005dc82818d67AF737725bD4bf75435d065D239` | `0x979Ca5202784112f4738403dBec5D0F3B9daabB9` | `0xeA87ae93Fa0019a82A727bfd3eBd1cFCa8f64f1D` | `0xd4C1905BB739D293F7a14F97241A65a7458291c3` | `0x5d934f4e2f797775e53561bB72aca21ba36B96BB` |
| DefaultISM | `0x6b1bb4ce664Bb4164AEB4d3D2E7DE7450DD8084C` | `0x8105a095368f1a184CceA86cDB98920e74Ffb992` | `0x60448b880c8Aa3fef44dCcc2CaAB4FD178DeE46f` | `0xAa4Fe29e0db0D2891352e2770b400B1e0B0C2D67` | `0x9C2ae13212B89Ced2027c2a7Ef26eb3eEf143867` |
| InterchainGasPaymaster | `0x6cA0B6D22da47f091B7613C7A727eC00ac3486d2` | `0x3b6044acd6767f017e99318AA6Ef93b7B06A5a22` | `0xc3F23848Ed2e04C0c6d41bd7804fa8f89F940B94` | `0xD8A76C4D91fCbB7Cc8eA795DFDF870E48368995C` | `0x0071740Bf129b05C4684abfbBeD248D80971cce2` |
| ValidatorAnnounce | `0x9bBdef63594D5FFc2f370Fe52115DdAAFBA66D76` | `0x9bBdef63594D5FFc2f370Fe52115DdAAFBA66D76` | `0x9bBdef63594D5FFc2f370Fe52115DdAAFBA66D76` | `0x9bBdef63594D5FFc2f370Fe52115DdAAFBA66D76` | `0x9bBdef63594D5FFc2f370Fe52115DdAAFBA66D76` |

## ISM Factory Contracts

These factories deploy ISM instances without requiring custom Solidity.

| Contract | Ethereum | Arbitrum |
|----------|----------|----------|
| StaticMultisigISMFactory | `0x8b83fefd896fAa52057798f6426E9f0B080FCCcE` | `0x8b83fefd896fAa52057798f6426E9f0B080FCCcE` |
| StaticAggregationISMFactory | `0x8F7454AC98228f3504bB91eA3D0281e457E00385` | `0x8F7454AC98228f3504bB91eA3D0281e457E00385` |
| DomainRoutingISMFactory | `0xC2E36cd6e32e194EE11f15D9273B64461A4D694A` | `0xC2E36cd6e32e194EE11f15D9273B64461A4D694A` |

## Hook Contracts

| Contract | Ethereum |
|----------|----------|
| MerkleTreeHook | `0x48e6c30B97748d1e2e03bf3e9FbE3890ca5f8CCA` |
| ProtocolFee | `0x8B05BF30F6247a90006C5837eA63C2007B532E59` |

## Verification

Verify any address on-chain before use:

```bash
# Check contract has code deployed
cast code 0xc005dc82818d67AF737725bD4bf75435d065D239 --rpc-url $RPC_URL

# Check Mailbox default ISM
cast call 0xc005dc82818d67AF737725bD4bf75435d065D239 \
  "defaultIsm()(address)" \
  --rpc-url $RPC_URL

# Check Mailbox default hook
cast call 0xc005dc82818d67AF737725bD4bf75435d065D239 \
  "defaultHook()(address)" \
  --rpc-url $RPC_URL

# Check Mailbox required hook
cast call 0xc005dc82818d67AF737725bD4bf75435d065D239 \
  "requiredHook()(address)" \
  --rpc-url $RPC_URL
```

## Reference

- [Hyperlane Registry (canonical source)](https://github.com/hyperlane-xyz/hyperlane-registry)
- [Hyperlane Explorer](https://explorer.hyperlane.xyz)
- [Hyperlane Docs — Contract Addresses](https://docs.hyperlane.xyz/docs/reference/contract-addresses)
