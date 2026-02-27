# zkSync Era Contract Addresses

Last verified: 2025-05-01

## L2 System Contracts (zkSync Era Mainnet & Testnet)

System contracts are deployed at the same addresses on all zkSync Era networks.

| Contract | Address | Purpose |
|----------|---------|---------|
| Bootloader | `0x0000000000000000000000000000000000008001` | Transaction processing entry point |
| AccountCodeStorage | `0x0000000000000000000000000000000000008002` | Stores account bytecode hashes |
| NonceHolder | `0x0000000000000000000000000000000000008003` | Transaction and deployment nonce management |
| KnownCodesStorage | `0x0000000000000000000000000000000000008004` | Registry of known bytecode hashes |
| ImmutableSimulator | `0x0000000000000000000000000000000000008005` | Simulates Solidity immutable variables |
| ContractDeployer | `0x0000000000000000000000000000000000008006` | All contract and account deployments |
| L1Messenger | `0x0000000000000000000000000000000000008008` | L2 to L1 message sending |
| MsgValueSimulator | `0x0000000000000000000000000000000000008009` | Simulates `msg.value` in calls |
| L2BaseToken | `0x000000000000000000000000000000000000800a` | ETH balance tracking on L2 |
| SystemContext | `0x000000000000000000000000000000000000800b` | Block/tx context variables |
| BootloaderUtilities | `0x000000000000000000000000000000000000800c` | Transaction hashing utilities |
| EventWriter | `0x000000000000000000000000000000000000800d` | Low-level event emission |
| Compressor | `0x000000000000000000000000000000000000800e` | Bytecode and state diff compression |
| ComplexUpgrader | `0x000000000000000000000000000000000000800f` | Protocol upgrade logic |
| PubdataChunkPublisher | `0x0000000000000000000000000000000000008011` | Publishes pubdata chunks to L1 |

## L1 Contracts (Ethereum Mainnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| DiamondProxy | `0x32400084C286CF3E17e7B677ea9583e60a000324` | Main zkSync Era entry point on L1 |
| Mailbox Facet | Part of DiamondProxy | L1<>L2 messaging |
| Executor Facet | Part of DiamondProxy | Batch commitment and proof verification |
| Governance | `0x0b622A2061EaccAE1c664eBC3E868b8438e03F61` | Protocol governance |
| ValidatorTimelock | `0x5D8ba173Dc6C3c90C8f7C04C9288BeF5FDbAd06E` | Delays batch execution for security |
| L1ERC20Bridge | `0x57891966931Eb4Bb6FB81430E6cE0A03AAbDe063` | Legacy ERC-20 bridge |
| L1SharedBridge | `0xD7f9f54194C633F36CCD5F3da84ad4a1c38cB2cB` | Shared bridge for all ZK chains |

## L1 Contracts (Ethereum Sepolia — Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| DiamondProxy | `0x9A6DE0f62Aa270A8bCB8e98e44Da02dD96AA7C4c` | zkSync Sepolia entry point on L1 |
| L1SharedBridge | `0x3E8b2fe58675126ed30d0d12dea2A9bda72D18Ae` | Shared bridge for testnet |

## Token Addresses (zkSync Era Mainnet)

| Token | L2 Address | L1 Address |
|-------|-----------|-----------|
| WETH | `0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91` | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | `0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| USDT | `0x493257fD37EDB34451f62EDf8D2a0C418852bA4C` | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| WBTC | `0xBBeB516fb02a01611cBBE0453Fe3c580D7281011` | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` |
| DAI | `0x4B9eb6c0b6ea15176BBF62841C6B2A8a398cb656` | `0x6B175474E89094C44Da98b954EedeAC495271d0F` |

## Token Addresses (zkSync Era Sepolia Testnet)

| Token | L2 Address |
|-------|-----------|
| ETH | Native (no contract address) |

Testnet tokens can be obtained from the [zkSync faucet](https://faucet.zksync.io) or by bridging Sepolia ETH.

## Network Configuration

### Mainnet

```typescript
const ZKSYNC_MAINNET = {
  chainId: 324,
  name: "zkSync Era Mainnet",
  rpcUrl: "https://mainnet.era.zksync.io",
  wsUrl: "wss://mainnet.era.zksync.io/ws",
  explorerUrl: "https://explorer.zksync.io",
  bridgeUrl: "https://bridge.zksync.io",
} as const;
```

### Sepolia Testnet

```typescript
const ZKSYNC_SEPOLIA = {
  chainId: 300,
  name: "zkSync Era Sepolia",
  rpcUrl: "https://sepolia.era.zksync.dev",
  wsUrl: "wss://sepolia.era.zksync.dev/ws",
  explorerUrl: "https://sepolia.explorer.zksync.io",
  bridgeUrl: "https://bridge.zksync.io",
  faucetUrl: "https://faucet.zksync.io",
} as const;
```

## Verification

Verify system contract presence:

```bash
# Check ContractDeployer exists at the expected address
cast code 0x0000000000000000000000000000000000008006 --rpc-url https://mainnet.era.zksync.io

# Check DiamondProxy on L1
cast code 0x32400084C286CF3E17e7B677ea9583e60a000324 --rpc-url https://eth.llamarpc.com
```
