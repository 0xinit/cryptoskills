# elizaOS Plugin Registry

Reference of official and community plugins available for elizaOS agents. Install via `bun add <package>` and add to the character's `plugins` array.

Last verified: February 2026

## Blockchain Plugins

| Package | Description | Chain | Key Actions |
|---------|-------------|-------|-------------|
| `@elizaos/plugin-solana` | Wallet management, token ops, Jupiter swaps, trust scoring | Solana | `SEND_TOKEN`, `SWAP_TOKEN`, `STAKE_SOL`, `CHECK_BALANCE` |
| `@elizaos/plugin-solana-v2` | Solana integration using @solana/web3.js v2, liquidity position mgmt | Solana | `MANAGE_POSITION`, `SEND_TOKEN` |
| `@elizaos/plugin-solana-agent-kit` | Solana Agent Kit integration for advanced DeFi ops | Solana | `DEPLOY_TOKEN`, `LEND`, `BORROW` |
| `@elizaos/plugin-evm` | Multi-chain EVM support (Ethereum, Base, Arbitrum, etc.) | EVM | `TRANSFER`, `SWAP`, `BRIDGE` |
| `@elizaos/plugin-starknet` | StarkNet wallet and transaction support | StarkNet | `TRANSFER`, `DEPLOY` |
| `@elizaos/plugin-sui` | Sui blockchain integration | Sui | `TRANSFER`, `STAKE` |
| `@elizaos/plugin-ton` | TON blockchain integration | TON | `TRANSFER`, `JETTON_TRANSFER` |
| `@elizaos/plugin-near` | NEAR Protocol integration | NEAR | `TRANSFER`, `STAKE` |
| `@elizaos/plugin-aptos` | Aptos blockchain integration | Aptos | `TRANSFER`, `STAKE` |
| `@elizaos/plugin-cosmos` | Cosmos/IBC chain support | Cosmos | `TRANSFER`, `DELEGATE` |
| `@elizaos/plugin-cronos` | Cronos chain integration | Cronos | `TRANSFER`, `SWAP` |
| `@elizaos/plugin-multiversx` | MultiversX (Elrond) integration | MultiversX | `TRANSFER` |
| `@elizaos/plugin-flow` | Flow blockchain integration | Flow | `TRANSFER` |
| `@elizaos/plugin-zksync-era` | zkSync Era integration | zkSync | `TRANSFER`, `SWAP` |
| `@elizaos/plugin-icp` | Internet Computer integration | ICP | `TRANSFER` |
| `@elizaos/plugin-avalanche` | Avalanche C-Chain integration | Avalanche | `TRANSFER`, `SWAP` |

## Platform Client Plugins

| Package | Description | Platform |
|---------|-------------|----------|
| `@elizaos/client-discord` | Discord bot with channel/DM support | Discord |
| `@elizaos/client-telegram` | Telegram bot with group/DM support | Telegram |
| `@elizaos/client-twitter` | Twitter posting, replies, and mentions | Twitter/X |
| `@elizaos/client-farcaster` | Farcaster casts and replies | Farcaster |
| `@elizaos/client-direct` | REST API for custom integrations | HTTP |
| `@elizaos/client-slack` | Slack workspace bot | Slack |
| `@elizaos/client-lens` | Lens Protocol social integration | Lens |
| `@elizaos/client-auto` | Autonomous posting and engagement | Multi |

## Database Adapters

| Package | Description | Use Case |
|---------|-------------|----------|
| `@elizaos/adapter-sqlite` | SQLite with vector search via sqlite-vec | Development, single-agent |
| `@elizaos/adapter-postgres` | PostgreSQL with pgvector for embeddings | Production, multi-agent |
| `@elizaos/adapter-supabase` | Supabase (managed PostgreSQL) adapter | Hosted production |

## AI / Model Plugins

| Package | Description |
|---------|-------------|
| `@elizaos/plugin-openai` | OpenAI GPT model integration |
| `@elizaos/plugin-anthropic` | Anthropic Claude model integration |
| `@elizaos/plugin-groq` | Groq inference integration |
| `@elizaos/plugin-ollama` | Local Ollama model support |
| `@elizaos/plugin-image-generation` | Image generation (DALL-E, Stable Diffusion) |
| `@elizaos/plugin-tts` | Text-to-speech generation |
| `@elizaos/plugin-node` | Node.js runtime utilities |

## DeFi / Data Plugins

| Package | Description |
|---------|-------------|
| `@elizaos/plugin-coinbase` | Coinbase Commerce and wallet integration |
| `@elizaos/plugin-coingecko` | CoinGecko price feeds and market data |
| `@elizaos/plugin-birdeye` | Birdeye Solana token analytics |
| `@elizaos/plugin-goat` | GOAT SDK for onchain tool usage |
| `@elizaos/plugin-0x` | 0x swap aggregation |
| `@elizaos/plugin-moralis` | Moralis onchain data API |
| `@elizaos/plugin-the-graph` | The Graph subgraph queries |

## Utility Plugins

| Package | Description |
|---------|-------------|
| `@elizaos/plugin-bootstrap` | Default bootstrapper — loads core actions and providers |
| `@elizaos/plugin-web-search` | Web search capability |
| `@elizaos/plugin-pdf` | PDF document ingestion for knowledge |
| `@elizaos/plugin-video-understanding` | Video content analysis |
| `@elizaos/plugin-story` | Story Protocol IP management |

## Plugin Sources

| Source | URL |
|--------|-----|
| Official plugins org | https://github.com/elizaos-plugins |
| Plugin registry docs | https://docs.elizaos.ai/plugin-registry/overview |
| Plugin starter template | https://github.com/elizaOS/eliza-plugin-starter |
| npm scope | https://www.npmjs.com/org/elizaos |

## Installing a Plugin

```bash
bun add @elizaos/plugin-solana
```

Add to character file:

```json
{
  "plugins": ["@elizaos/plugin-solana"]
}
```

Or register programmatically:

```typescript
import solanaPlugin from "@elizaos/plugin-solana";

const runtime = new AgentRuntime({
  character,
  plugins: [solanaPlugin],
});
```
