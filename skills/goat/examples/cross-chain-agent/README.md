# Cross-Chain Bridge Agent with GOAT + deBridge

Build an AI agent that can bridge tokens between EVM chains using the deBridge plugin. The agent accepts natural language instructions like "Bridge 50 USDC from Base to Arbitrum."

## Prerequisites

- Node.js 18+
- Wallet private key funded on the source chain
- OpenAI API key

## Step 1: Install Dependencies

```bash
npm init -y
npm install @goat-sdk/core @goat-sdk/adapter-vercel-ai @goat-sdk/wallet-viem \
  @goat-sdk/plugin-send-eth @goat-sdk/plugin-erc20 @goat-sdk/plugin-debridge \
  @ai-sdk/openai ai viem dotenv tsx
```

## Step 2: Configure Environment

Create `.env`:

```bash
WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPENAI_API_KEY=sk-your-openai-key
```

## Step 3: Build the Cross-Chain Agent

Create `bridge-agent.ts`:

```typescript
import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { sendETH } from "@goat-sdk/plugin-send-eth";
import { erc20 } from "@goat-sdk/plugin-erc20";
import { debridge } from "@goat-sdk/plugin-debridge";
import { viem } from "@goat-sdk/wallet-viem";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const USDC = {
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  chains: {
    8453: { contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    42161: { contractAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  },
};

async function main() {
  const account = privateKeyToAccount(
    process.env.WALLET_PRIVATE_KEY as `0x${string}`
  );

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL),
  });

  const tools = await getOnChainTools({
    wallet: viem(walletClient),
    plugins: [
      sendETH(),
      erc20({ tokens: [USDC] }),
      debridge(),
    ],
  });

  const result = await generateText({
    model: openai("gpt-4o"),
    tools,
    maxSteps: 15,
    system: `You are a cross-chain bridge assistant. You help users move tokens between EVM chains using deBridge.
Supported chains: Ethereum (1), Base (8453), Arbitrum (42161), Optimism (10), Polygon (137).
Always check the user's balance before initiating a bridge.
Explain the estimated fees and time before executing.`,
    prompt: "Bridge 50 USDC from Base to Arbitrum",
  });

  console.log(result.text);
}

main().catch(console.error);
```

## Step 4: Run

```bash
npx tsx bridge-agent.ts
```

## Expected Output

```
Checking your USDC balance on Base... You have 200 USDC.

I'll bridge 50 USDC from Base (chain 8453) to Arbitrum (chain 42161) via deBridge.

Estimated fees: ~0.30 USDC
Estimated time: 1-3 minutes

Initiating bridge transaction...

Bridge transaction submitted: 0xabc...def
Your 50 USDC will arrive on Arbitrum within a few minutes.
```

## How deBridge Plugin Works

The deBridge plugin exposes several tools to the agent:

| Tool | Description |
|------|-------------|
| `debridge_get_supported_chains` | Lists chains supported by deBridge |
| `debridge_get_quote` | Gets a quote for a cross-chain transfer |
| `debridge_create_order` | Creates and executes a bridge order |
| `debridge_get_order_status` | Checks the status of a pending bridge |

The agent uses these tools in sequence: check balance, get a quote, confirm with the user (via the system prompt), then execute.

## Multi-Chain Wallet Setup

For agents that operate on multiple chains simultaneously, create separate wallet clients:

```typescript
import { base, arbitrum } from "viem/chains";

const baseWallet = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
});

const arbitrumWallet = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const baseTools = await getOnChainTools({
  wallet: viem(baseWallet),
  plugins: [sendETH(), erc20({ tokens: [USDC] }), debridge()],
});

const arbitrumTools = await getOnChainTools({
  wallet: viem(arbitrumWallet),
  plugins: [sendETH(), erc20({ tokens: [USDC] })],
});

const allTools = { ...baseTools, ...arbitrumTools };
```

## Adding Mayan Finance (Solana Bridge)

For bridging between EVM and Solana, add the Mayan plugin:

```typescript
import { mayan } from "@goat-sdk/plugin-mayan";

const tools = await getOnChainTools({
  wallet: viem(walletClient),
  plugins: [debridge(), mayan()],
});
```

Last verified: February 2026
