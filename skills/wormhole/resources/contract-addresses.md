# Wormhole Contract Addresses

> **Last verified:** February 2026

Verified mainnet deployment addresses for Wormhole protocol contracts. All EVM addresses are checksummed.

## Core Bridge

The Core Bridge is the fundamental Wormhole contract that handles message publishing, VAA verification, and guardian set management.

| Chain | Address |
|-------|---------|
| Ethereum | `0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B` |
| Arbitrum | `0xa5f208e072434bC67592E4C49C1B991BA79BCA46` |
| Base | `0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8ac6` |
| Optimism | `0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722` |
| Solana | `worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth` |

## Token Bridge

The legacy Token Bridge handles lock/mint wrapped token transfers.

| Chain | Address |
|-------|---------|
| Ethereum | `0x3ee18B2214AFF97000D974cf647E7C347E8fa585` |
| Arbitrum | `0x0b2402144Bb366A632D14B83F244D2e0e21bD39c` |
| Base | `0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627` |
| Optimism | `0x1D68124e65faFC907325e3EDbF8c4d84499DAa8b` |
| Solana | `wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb` |

## Standard Relayer (Automatic Relayer)

Handles automatic VAA delivery to the destination chain.

| Chain | Address |
|-------|---------|
| Ethereum | `0x27428DD2d3DD32A4D7f7C497eAaa23130d894911` |
| Arbitrum | `0x27428DD2d3DD32A4D7f7C497eAaa23130d894911` |
| Base | `0x706F82e9bb5b0813f02e75c3e0a2ead1b0F4E9Cb` |
| Optimism | `0x27428DD2d3DD32A4D7f7C497eAaa23130d894911` |
| Solana | N/A (Standard Relayer is EVM-only) |

## NFT Bridge

| Chain | Address |
|-------|---------|
| Ethereum | `0x6FFd7EdE62328b3Af38FCD61461Bbfc52F5651fE` |
| Arbitrum | `0x3dD14D553cFD986EAC8e3bddF629d82073e188c8` |
| Base | N/A |
| Optimism | `0xfE8cD454b4A1CA468B57D79c0cc77Ef5B6f64585` |
| Solana | `WnFt12ZrnzZrFZkt2xsNsaNWoQribnuQ5B5FrDbwDhD` |

## Wormhole Chain IDs (Quick Reference)

| Chain | Wormhole Chain ID | EVM Chain ID |
|-------|-------------------|-------------|
| Solana | 1 | N/A |
| Ethereum | 2 | 1 |
| BSC | 4 | 56 |
| Polygon | 5 | 137 |
| Avalanche | 6 | 43114 |
| Fantom | 10 | 250 |
| Sui | 21 | N/A |
| Aptos | 22 | N/A |
| Arbitrum | 23 | 42161 |
| Optimism | 24 | 10 |
| Base | 30 | 8453 |

## Guardian RPC / API Endpoints

| Service | URL |
|---------|-----|
| Wormholescan API | `https://api.wormholescan.io/api/v1` |
| Wormhole Query API | `https://query.wormhole.com/v1/query` |
| Guardian RPC (mainnet) | `https://wormhole-v2-mainnet-api.mcf.rocks` |
| Wormholescan Explorer | `https://wormholescan.io` |

## Verification

Verify any contract address on-chain before use:

```bash
# Ethereum Core Bridge
cast code 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B --rpc-url $ETH_RPC_URL

# Arbitrum Token Bridge
cast code 0x0b2402144Bb366A632D14B83F244D2e0e21bD39c --rpc-url $ARB_RPC_URL

# Check current guardian set index
cast call 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B "getCurrentGuardianSetIndex()(uint32)" --rpc-url $ETH_RPC_URL

# Check message fee
cast call 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B "messageFee()(uint256)" --rpc-url $ETH_RPC_URL
```

## Reference

- [Official Contract Addresses](https://docs.wormhole.com/docs/build/reference/contract-addresses/)
- [Wormhole Chain IDs](https://docs.wormhole.com/docs/build/reference/chain-ids/)
