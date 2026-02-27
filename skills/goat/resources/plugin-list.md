# GOAT Plugin List

Complete reference of protocol plugins available in the GOAT SDK. Install individually with `npm install @goat-sdk/plugin-<name>`.

Last verified: February 2026

## Core Plugins (Token Operations)

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| Send ETH | `@goat-sdk/plugin-send-eth` | EVM | Transfer native ETH to any address |
| Send SOL | `@goat-sdk/plugin-send-solana` | Solana | Transfer native SOL to any address |
| ERC-20 | `@goat-sdk/plugin-erc20` | EVM | Transfer, approve, and check balances of ERC-20 tokens |
| ERC-721 | `@goat-sdk/plugin-erc721` | EVM | Transfer, approve, and query NFTs |
| SPL Token | `@goat-sdk/plugin-spl-token` | Solana | Transfer and check SPL token balances |
| Cosmos Bank | `@goat-sdk/plugin-cosmosbank` | Cosmos | Transfer native Cosmos tokens |
| SNS | `@goat-sdk/plugin-sns` | Solana | Resolve Solana Name Service domains |

## DeFi — DEX / Swaps

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| Uniswap | `@goat-sdk/plugin-uniswap` | EVM | Token swaps on Uniswap V3 |
| Jupiter | `@goat-sdk/plugin-jupiter` | Solana | Token swaps via Jupiter aggregator |
| 1inch | `@goat-sdk/plugin-1inch` | EVM | DEX aggregation across 400+ sources |
| 0x | `@goat-sdk/plugin-0x` | EVM | Swap tokens via 0x API |
| Orca | `@goat-sdk/plugin-orca` | Solana | Concentrated liquidity swaps on Orca |
| Meteora | `@goat-sdk/plugin-meteora` | Solana | Dynamic AMM swaps on Meteora |
| Balancer | `@goat-sdk/plugin-balancer` | EVM | Weighted pool swaps on Balancer |
| Velodrome | `@goat-sdk/plugin-velodrome` | Optimism | Swaps on Velodrome (Optimism DEX) |
| KIM | `@goat-sdk/plugin-kim` | EVM | KIM protocol swaps |
| Enso | `@goat-sdk/plugin-enso` | EVM | DeFi meta-aggregator |

## DeFi — Lending / Yield

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| Lulo | `@goat-sdk/plugin-lulo` | Solana | Yield optimization on Solana |
| Ionic | `@goat-sdk/plugin-ionic` | EVM | Lending/borrowing on Ionic |
| Ironclad | `@goat-sdk/plugin-ironclad` | EVM | Lending protocol interactions |
| Renzo | `@goat-sdk/plugin-renzo` | EVM | Liquid restaking via Renzo |
| Superfluid | `@goat-sdk/plugin-superfluid` | EVM | Token streaming (per-second payments) |

## DeFi — Prediction Markets

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| Polymarket | `@goat-sdk/plugin-polymarket` | EVM | Create and trade prediction market positions |
| BetSwirl | `@goat-sdk/plugin-betswirl` | EVM | Onchain gaming and betting |

## Cross-Chain / Bridging

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| deBridge | `@goat-sdk/plugin-debridge` | EVM | Cross-chain token transfers via deBridge DLN |
| Mayan | `@goat-sdk/plugin-mayan` | EVM + Solana | Cross-chain swaps via Mayan Finance |
| Crossmint Checkout | `@goat-sdk/plugin-crossmint-headless-checkout` | EVM + Solana | Fiat-to-crypto checkout |

## Market Data / Analytics

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| CoinGecko | `@goat-sdk/plugin-coingecko` | Any | Token prices, market data, trending |
| CoinMarketCap | `@goat-sdk/plugin-coinmarketcap` | Any | Token prices and market cap data |
| DexScreener | `@goat-sdk/plugin-dexscreener` | Any | DEX pair data, volume, price charts |
| BirdEye | `@goat-sdk/plugin-birdeye` | Solana | Solana token analytics |
| Nansen | `@goat-sdk/plugin-nansen` | EVM | Wallet labels and smart money tracking |
| Rugcheck | `@goat-sdk/plugin-rugcheck` | Solana | Token safety and rug pull checks |

## Infrastructure / Utilities

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| ENS | `@goat-sdk/plugin-ens` | Ethereum | Resolve and register ENS names |
| Etherscan | `@goat-sdk/plugin-etherscan` | EVM | Read verified contract source, ABI lookup |
| JSON RPC | `@goat-sdk/plugin-json-rpc` | Any | Raw JSON-RPC calls to any endpoint |
| Faucet | `@goat-sdk/plugin-faucet` | EVM (testnet) | Request testnet tokens |

## Social / Messaging

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| Farcaster | `@goat-sdk/plugin-farcaster` | Any | Post casts, read feeds, interact on Farcaster |

## NFT / Token Launch

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| Pump.fun | `@goat-sdk/plugin-pump-fun` | Solana | Launch and trade tokens on Pump.fun |
| Tensor | `@goat-sdk/plugin-tensor` | Solana | NFT marketplace interactions |
| OpenSea | `@goat-sdk/plugin-opensea` | EVM | NFT listings, bids, and sales on OpenSea |

## Governance

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| Mode Governance | `@goat-sdk/plugin-mode-governance` | Mode | Governance voting on Mode |
| Mode Voting | `@goat-sdk/plugin-mode-voting` | Mode | Snapshot-style voting |
| Mode Spray | `@goat-sdk/plugin-mode-spray` | Mode | Token distribution tool |

## Specialized

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| Irys | `@goat-sdk/plugin-irys` | Any | Permanent data storage on Irys datachain |
| Hedgey | `@goat-sdk/plugin-hedgey` | EVM | Token vesting and lockups |
| Worldstore | `@goat-sdk/plugin-worldstore` | Any | Purchase physical goods onchain |

## Python-Only Plugins

These plugins are available in the Python SDK but not yet in TypeScript:

| Plugin | Package | Chain | Description |
|--------|---------|-------|-------------|
| MultiversX | `goat-sdk-plugin-multiversx` | MultiversX | Token operations on MultiversX |

## Installing Multiple Plugins

```bash
npm install @goat-sdk/plugin-send-eth \
  @goat-sdk/plugin-erc20 \
  @goat-sdk/plugin-uniswap \
  @goat-sdk/plugin-coingecko \
  @goat-sdk/plugin-debridge
```

## Plugin Compatibility

Plugins declare chain support internally. If you pass a Solana wallet to an EVM-only plugin, the plugin will not register any tools. No runtime error — the tools simply do not appear. Check the chain column above to match plugins to wallets.
