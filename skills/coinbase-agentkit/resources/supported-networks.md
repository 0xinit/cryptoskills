# AgentKit Supported Networks

Chain and network support for `@coinbase/agentkit` wallet providers and action providers.

Last verified: February 2026 against `@coinbase/agentkit` v0.2.x

## EVM Networks

### CdpEvmWalletProvider

| Network | Network ID | Faucet | Swap API | Deep Protocol Support |
|---------|-----------|--------|----------|-----------------------|
| Base Mainnet | `base-mainnet` | No | Yes | Compound, Morpho, Moonwell, Basename, Clanker, WOW |
| Base Sepolia | `base-sepolia` | Yes | Yes | Compound, Morpho, Moonwell, Basename |
| Ethereum Mainnet | `ethereum-mainnet` | No | Yes | ERC20, ERC721, WETH, Compound, Morpho |
| Ethereum Sepolia | `ethereum-sepolia` | Yes | Yes | ERC20, ERC721, WETH |
| Arbitrum Mainnet | `arbitrum-mainnet` | No | Yes | ERC20, ERC721, WETH |
| Polygon Mainnet | `polygon-mainnet` | No | Yes | ERC20, ERC721 |
| Optimism Mainnet | `optimism-mainnet` | No | Yes | ERC20, ERC721 |

### CdpSmartWalletProvider

Smart wallets are available on a subset of networks. Paymaster support varies.

| Network | Network ID | Paymaster Support |
|---------|-----------|-------------------|
| Base Mainnet | `base-mainnet` | Yes |
| Base Sepolia | `base-sepolia` | Yes |
| Ethereum Mainnet | `ethereum-mainnet` | Limited |
| Ethereum Sepolia | `ethereum-sepolia` | Yes |

### ViemWalletProvider

Works on any EVM chain that viem supports. Configure via chain definition:

```typescript
import { mainnet, base, arbitrum, optimism, polygon, avalanche } from "viem/chains";
```

No CDP dependency — limited to wallet operations and generic ERC20/ERC721 actions. CDP-specific actions (faucet, swap API) are not available.

### PrivyWalletProvider

| Network | Support |
|---------|---------|
| Base | Full |
| Ethereum | Full |
| Arbitrum | Full |
| Polygon | Full |
| Optimism | Full |
| Any EVM | Via custom chain config |

## Solana Networks

### CdpV2SolanaWalletProvider

| Network | RPC Endpoint | Faucet |
|---------|-------------|--------|
| Solana Mainnet | `solana-mainnet` | No |
| Solana Devnet | `solana-devnet` | Yes |
| Solana Testnet | `solana-testnet` | Yes |

### SolanaKeypairWalletProvider

Works on any Solana cluster. Configure via RPC URL:

```typescript
const wallet = await SolanaKeypairWalletProvider.fromPrivateKey(
  process.env.SOLANA_PRIVATE_KEY!,
  { rpcUrl: "https://api.mainnet-beta.solana.com" }
);
```

## Solana Action Providers

| Provider | Supported Clusters |
|----------|--------------------|
| `jupiterActionProvider` | Mainnet only (Jupiter aggregator) |
| `splTokenActionProvider` | All clusters |

## Protocol-Specific Network Requirements

Some action providers only work on specific networks:

| Action Provider | Required Network(s) |
|----------------|---------------------|
| `basenameActionProvider` | Base Mainnet, Base Sepolia |
| `compoundActionProvider` | Base, Ethereum (where Compound V3 is deployed) |
| `morphoActionProvider` | Base, Ethereum (where Morpho vaults exist) |
| `moonwellActionProvider` | Base (where Moonwell is deployed) |
| `clankerActionProvider` | Base Mainnet |
| `wowActionProvider` | Base Mainnet |
| `jupiterActionProvider` | Solana Mainnet |
| `openseaActionProvider` | Ethereum, Base, Arbitrum, Polygon |
| `acrossActionProvider` | Any EVM chain supported by Across |
| `superfluidActionProvider` | Networks with Superfluid deployments |

## Network Configuration

### Set at Wallet Level

The network is configured when creating the wallet provider. All actions inherit the wallet's network.

```typescript
const wallet = await CdpEvmWalletProvider.configureWithWallet({
  apiKeyId: process.env.CDP_API_KEY_ID!,
  apiKeySecret: process.env.CDP_API_KEY_SECRET!,
  networkId: "base-mainnet",
});
```

### Custom RPC Endpoints

For ViemWalletProvider, specify any RPC:

```typescript
import { createWalletClient, http } from "viem";
import { defineChain } from "viem";

const customNetwork = defineChain({
  id: 8453,
  name: "Base",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://your-custom-rpc.com"] },
  },
});

const client = createWalletClient({
  account,
  chain: customNetwork,
  transport: http("https://your-custom-rpc.com"),
});
```

## Network ID Quick Reference

| Chain | Mainnet ID | Testnet ID |
|-------|-----------|------------|
| Base | `base-mainnet` | `base-sepolia` |
| Ethereum | `ethereum-mainnet` | `ethereum-sepolia` |
| Arbitrum | `arbitrum-mainnet` | `arbitrum-sepolia` |
| Polygon | `polygon-mainnet` | `polygon-amoy` |
| Optimism | `optimism-mainnet` | `optimism-sepolia` |
| Solana | `solana-mainnet` | `solana-devnet` |
