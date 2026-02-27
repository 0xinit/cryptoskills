# AgentKit Action Provider Reference

Complete list of built-in action providers and their actions in `@coinbase/agentkit`.

Last verified: February 2026 against `@coinbase/agentkit` v0.2.x

## Core Providers

### walletActionProvider

General wallet operations. No additional configuration required.

| Action | Description |
|--------|-------------|
| `getBalance` | Get native token balance (ETH, MATIC, etc.) |
| `getWalletDetails` | Return wallet address, network, and provider type |
| `nativeTransfer` | Send native tokens to an address |

### erc20ActionProvider

ERC20 token interactions. No additional configuration required.

| Action | Description |
|--------|-------------|
| `getBalance` | Get ERC20 token balance by contract address |
| `transfer` | Transfer ERC20 tokens to an address |
| `approve` | Approve a spender for a token amount |
| `getAllowance` | Check approved allowance for a spender |

### erc721ActionProvider

ERC721 NFT interactions. No additional configuration required.

| Action | Description |
|--------|-------------|
| `mint` | Mint a new NFT (if contract supports public mint) |
| `transfer` | Transfer an NFT to an address |
| `getBalance` | Get NFT balance for a collection |

### wethActionProvider

Wrap/unwrap ETH. Works on any network with a canonical WETH contract.

| Action | Description |
|--------|-------------|
| `wrapEth` | Convert native ETH to WETH |

## CDP Platform Providers

### cdpApiActionProvider

Requires `apiKeyId` and `apiKeySecret` configuration.

| Action | Description |
|--------|-------------|
| `requestFaucet` | Request testnet tokens (Base Sepolia, Ethereum Sepolia) |
| `tradeTokens` | Swap tokens via CDP routing API with automatic approval |

### cdpWalletActionProvider

CDP-specific wallet features. Available when using `CdpEvmWalletProvider`.

| Action | Description |
|--------|-------------|
| `exportWallet` | Export wallet data for persistence |

### cdpSmartWalletActionProvider

Smart wallet features. Available when using `CdpSmartWalletProvider`.

| Action | Description |
|--------|-------------|
| `setSpendPermission` | Configure spending limits for the smart wallet |

## DeFi Protocol Providers

### compoundActionProvider

Compound V3 protocol interactions on Base and Ethereum.

| Action | Description |
|--------|-------------|
| `supply` | Supply collateral to a Compound market |
| `withdraw` | Withdraw collateral from a Compound market |
| `borrow` | Borrow assets against supplied collateral |
| `repay` | Repay borrowed assets |
| `getPortfolio` | View current positions and health factor |

### morphoActionProvider

Morpho protocol interactions.

| Action | Description |
|--------|-------------|
| `deposit` | Deposit into a Morpho vault |
| `withdraw` | Withdraw from a Morpho vault |

### moonwellActionProvider

Moonwell protocol interactions on Base.

| Action | Description |
|--------|-------------|
| `supply` | Supply assets to Moonwell |
| `withdraw` | Withdraw assets from Moonwell |
| `borrow` | Borrow assets from Moonwell |
| `repay` | Repay borrowed assets |

### superfluidActionProvider

Superfluid streaming payments.

| Action | Description |
|--------|-------------|
| `createFlow` | Start a token stream to a recipient |
| `updateFlow` | Modify the flow rate of an existing stream |
| `deleteFlow` | Stop a token stream |

### fluidActionProvider

Fluid/Instadapp protocol interactions.

| Action | Description |
|--------|-------------|
| `lend` | Lend assets to Fluid |
| `borrow` | Borrow assets from Fluid |

## DEX Aggregator Providers

### zeroXActionProvider

0x swap aggregator.

| Action | Description |
|--------|-------------|
| `getQuote` | Get a swap quote from 0x API |
| `swap` | Execute a token swap via 0x |

### ensoActionProvider

Enso routing engine.

| Action | Description |
|--------|-------------|
| `routeSwap` | Route and execute a token swap via Enso |

### jupiterActionProvider

Jupiter DEX aggregator (Solana only).

| Action | Description |
|--------|-------------|
| `swap` | Swap SPL tokens via Jupiter |

## NFT & Social Providers

### openseaActionProvider

OpenSea NFT marketplace.

| Action | Description |
|--------|-------------|
| `listNft` | List an NFT for sale on OpenSea |
| `getNftBalance` | Check NFT holdings across collections |

### zoraActionProvider

Zora NFT platform.

| Action | Description |
|--------|-------------|
| `createToken` | Create a new NFT collection on Zora |
| `mint` | Mint from a Zora collection |

### farcasterActionProvider

Farcaster social protocol.

| Action | Description |
|--------|-------------|
| `postCast` | Publish a cast on Farcaster |
| `getAccountDetails` | Get Farcaster account info |

### twitterActionProvider

Twitter/X integration.

| Action | Description |
|--------|-------------|
| `postTweet` | Post a tweet |
| `getAccountDetails` | Get Twitter account info |

## Data & Oracle Providers

### pythActionProvider

Pyth Network price oracles.

| Action | Description |
|--------|-------------|
| `fetchPrice` | Get real-time price data for a token pair |

### defiLlamaActionProvider

DefiLlama analytics.

| Action | Description |
|--------|-------------|
| `getProtocolTvl` | Get TVL for a specific protocol |
| `getProtocolList` | List all tracked protocols |

## Identity & Naming Providers

### basenameActionProvider

Base name service (ENS equivalent on Base).

| Action | Description |
|--------|-------------|
| `registerBasename` | Register a .base name |

## Bridge Providers

### acrossActionProvider

Across Protocol cross-chain bridge.

| Action | Description |
|--------|-------------|
| `bridgeTokens` | Bridge tokens between EVM chains |

## Token Launch Providers

### clankerActionProvider

Farcaster token deployment via Clanker.

| Action | Description |
|--------|-------------|
| `deployToken` | Deploy a new token via Clanker |

### wowActionProvider

WOW memecoin platform.

| Action | Description |
|--------|-------------|
| `createMemecoin` | Create a new memecoin |
| `buyMemecoin` | Buy an existing memecoin |
| `sellMemecoin` | Sell a memecoin |

## Registering Providers

```typescript
import {
  AgentKit,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  compoundActionProvider,
} from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider: wallet,
  actionProviders: [
    walletActionProvider(),
    erc20ActionProvider(),
    cdpApiActionProvider({
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    }),
    compoundActionProvider(),
  ],
});
```

Only register the providers your agent needs. More providers means more tools for the LLM, which can increase confusion and reduce accuracy.
