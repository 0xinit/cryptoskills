# Axelar Contract Addresses

> **Last verified:** 2025-05-01

Verified mainnet deployment addresses for Axelar protocol contracts. All EVM addresses are checksummed.

## Gateway

The Gateway is the on-chain entry point for GMP messages. One per chain. Handles `callContract()`, `callContractWithToken()`, and validates incoming messages before invoking `_execute()`.

| Chain | Address |
|-------|---------|
| Ethereum | `0x4F4495243837681061C4743b74B3eEdf548D56A5` |
| Arbitrum | `0xe432150cce91c13a887f7D836923d5597adD8E31` |
| Base | `0xe432150cce91c13a887f7D836923d5597adD8E31` |
| Optimism | `0xe432150cce91c13a887f7D836923d5597adD8E31` |
| Polygon | `0xe432150cce91c13a887f7D836923d5597adD8E31` |
| Avalanche | `0x5029C0EFf6C34351a0CEc334542cDb22c7928f78` |
| BNB Chain | `0x304acf330bbE08d1e512eefaa92F6a57871fD895` |
| Fantom | `0x304acf330bbE08d1e512eefaa92F6a57871fD895` |

## GasService

Handles gas prepayment for destination-chain execution. Same address on most chains.

| Chain | Address |
|-------|---------|
| Ethereum | `0x2d5d7d31F671F86C782533cc367F14109a082712` |
| Arbitrum | `0x2d5d7d31F671F86C782533cc367F14109a082712` |
| Base | `0x2d5d7d31F671F86C782533cc367F14109a082712` |
| Optimism | `0x2d5d7d31F671F86C782533cc367F14109a082712` |
| Polygon | `0x2d5d7d31F671F86C782533cc367F14109a082712` |
| Avalanche | `0x2d5d7d31F671F86C782533cc367F14109a082712` |
| BNB Chain | `0x2d5d7d31F671F86C782533cc367F14109a082712` |

## Interchain Token Service (ITS)

Manages interchain token deployments and cross-chain token transfers.

| Chain | Address |
|-------|---------|
| Ethereum | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |
| Arbitrum | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |
| Base | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |
| Optimism | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |
| Polygon | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |
| Avalanche | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |
| BNB Chain | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |

## Interchain Token Factory

Convenience contract for deploying interchain tokens. Creates tokens via ITS.

| Chain | Address |
|-------|---------|
| Ethereum | `0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D12` |
| Arbitrum | `0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D12` |
| Base | `0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D12` |
| Optimism | `0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D12` |
| Polygon | `0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D12` |
| Avalanche | `0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D12` |
| BNB Chain | `0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D12` |

## Testnet Addresses

| Contract | Chain | Address |
|----------|-------|---------|
| Gateway | Ethereum Sepolia | `0xe432150cce91c13a887f7D836923d5597adD8E31` |
| Gateway | Arbitrum Sepolia | `0xe432150cce91c13a887f7D836923d5597adD8E31` |
| Gateway | Base Sepolia | `0xe432150cce91c13a887f7D836923d5597adD8E31` |
| GasService | Ethereum Sepolia | `0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6` |
| GasService | Arbitrum Sepolia | `0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6` |
| GasService | Base Sepolia | `0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6` |
| ITS | Ethereum Sepolia | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |
| ITS | Arbitrum Sepolia | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |

## API Endpoints

| Service | URL |
|---------|-----|
| Axelarscan Explorer | `https://axelarscan.io` |
| Axelarscan API | `https://api.axelarscan.io` |
| GMP Status API | `https://api.axelarscan.io/cross-chain/search-gmp` |
| Gas Estimation API | `https://api.axelarscan.io/cross-chain/transfer-fee` |

## Verification

Verify any contract address on-chain before use:

```bash
# Check Gateway has code
cast code 0x4F4495243837681061C4743b74B3eEdf548D56A5 --rpc-url $ETH_RPC_URL

# Check GasService has code
cast code 0x2d5d7d31F671F86C782533cc367F14109a082712 --rpc-url $ETH_RPC_URL

# Check token address for a symbol
cast call 0x4F4495243837681061C4743b74B3eEdf548D56A5 \
  "tokenAddresses(string)(address)" "axlUSDC" --rpc-url $ETH_RPC_URL

# Check if a command has been executed
cast call 0x4F4495243837681061C4743b74B3eEdf548D56A5 \
  "isCommandExecuted(bytes32)(bool)" <commandId> --rpc-url $ETH_RPC_URL
```

## Reference

- [Official Contract Addresses](https://docs.axelar.dev/resources/contract-addresses/mainnet)
- [Testnet Contract Addresses](https://docs.axelar.dev/resources/contract-addresses/testnet)
