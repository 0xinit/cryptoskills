# Monad Ecosystem Reference

## Canonical Contracts

| Contract | Address |
|----------|---------|
| Wrapped MON (WMON) | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` |
| Staking Precompile | `0x0000000000000000000000000000000000001000` |
| ERC-4337 EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| ERC-4337 EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| Safe | `0x69f4D1788e39c87893C980c06EdF4b7f686e2938` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

## Stablecoins

| Token | Address |
|-------|---------|
| USDC | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
| USDT0 | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` |
| AUSD | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` |
| USD1 | `0x111111d2bf19e43C34263401e0CAd979eD1cdb61` |

## Bridged Assets

### ETH-Related

| Token | Address |
|-------|---------|
| WETH | `0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242` |
| ezETH | — |
| wstETH | — |
| weETH | — |
| pufETH | — |

### BTC-Related

| Token | Address |
|-------|---------|
| WBTC | `0x0555E30da8f98308EdB960aa94C0Db47230d2B9c` |
| LBTC | — |
| BTC.b | — |
| SolvBTC | — |

### Other

| Token | Address |
|-------|---------|
| WSOL | — |
| mEDGE | `0x1c8eE940B654bFCeD403f2A44C1603d5be0F50Fa` |

## MON on Other Chains

| Chain | Address/Mint |
|-------|-------------|
| Solana | `CrAr4RRJMBVwRsZtT62pEhfA9H5utymC2mVx8e7FreP2` |
| Ethereum | `0x6917037f8944201b2648198a89906edf863b9517` (2/2 NTT) |

## Bridge Mechanisms

Assets are bridged to Monad via four primary methods:

| Bridge Protocol | Type |
|-----------------|------|
| **LayerZero OFT** | Token standard for omnichain fungible tokens |
| **Chainlink CCIP** | Cross-chain interoperability protocol |
| **Hyperlane** | Permissionless interoperability — message passing + asset transfers |
| **2/2 NTT Bridge** | Native Token Transfer bridge |

Additional cross-chain solutions:
- **LI.FI** — Multi-chain payments and swaps, aggregates DEXs + bridges + solvers
- **Relay** — 50M+ transactions, $5B+ volume across 85+ networks

## Oracles

| Provider | Type | Notes |
|----------|------|-------|
| **Pyth Network** | Pull oracle | Data pushed every 400ms; users pull aggregated prices from Pythnet |
| **Stork** | Pull oracle | Ultra-low latency price feeds for DeFi |

## Block Explorers

| Explorer | URL | Features |
|----------|-----|----------|
| MonadVision | monadvision.com | Sourcify verification, Blockvision-powered |
| Monadscan | monadscan.com | Etherscan-powered |
| Socialscan | monad.socialscan.io | Additional verification |
| gmonads | gmonads.com | Network visualization |
| Phalcon | — | Detailed traces |
| Tenderly | — | Debugging, traces, simulation |
| Jiffyscan | — | ERC-4337 UserOps |

## RPC Providers

### Public (Rate-Limited)

| Provider | Mainnet URL | Limits |
|----------|-------------|--------|
| QuickNode | rpc.monad.xyz | 25 rps |
| Alchemy | rpc1.monad.xyz | 15 rps |
| Goldsky Edge | rpc2.monad.xyz | 300/10s |
| Ankr | rpc3.monad.xyz | 300/10s |
| MF | rpc-mainnet.monadinfra.com | 20 rps |

### Premium (Higher Limits)

For production dApps, use dedicated RPC from providers like QuickNode, Alchemy, Ankr, Goldsky, Chainstack, dRPC.

## Indexers

Smart contract indexers for off-chain data processing:
- **GhostGraph** — Index transfers
- **Envio** — Index transfers for Telegram bots
- **QuickNode Streams** — Index transfers with stream processing

## Wallets

| Wallet | Type |
|--------|------|
| **MetaMask** | Browser extension (add Monad network) |
| **Phantom** | Multi-chain wallet |
| **Safe** | Multi-sig |

### Embedded Wallets / Wallet Infrastructure

| Provider | Features |
|----------|----------|
| **Privy** | Auth SDK, embedded wallets, social login |
| **Turnkey** | Scalable wallet infrastructure, millions of embedded wallets |
| **Reown AppKit** | Wallet connection for dApps |

## Toolkits

| Tool | Status | Notes |
|------|--------|-------|
| **Foundry** (Monad fork) | Recommended | `foundryup --network monad` |
| **Hardhat** 2/3 | Supported | Use `evmVersion: "prague"` |
| **Remix** | Supported | Via Injected Provider |
| **viem** | 2.40.0+ | Native Monad chain support |
| **alloy-chains** | 0.2.20+ | Rust chain definitions |
| **Tenderly** | Supported | Dashboard, simulation, debugging |
| **Safe** | Supported | Multi-sig infrastructure |
| **Scaffold-ETH** | Supported | dApp templates |

## Account Abstraction

| Component | Address/Status |
|-----------|---------------|
| ERC-4337 EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| ERC-4337 EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| EIP-7702 | Supported (type 4 transactions) |
| EIP-7951 (P256) | Precompile at `0x0100` — enables passkey/WebAuthn signing |

## Community Resources

| Resource | URL |
|----------|-----|
| Developer Discord | discord.gg/monaddev |
| Protocols repo | github.com/monad-crypto/protocols |
| Token list repo | github.com/monad-crypto/token-list |
| Documentation | docs.monad.xyz |
