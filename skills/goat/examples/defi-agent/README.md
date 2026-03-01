# DeFi Agent with GOAT + Vercel AI SDK

Build an AI agent that can swap tokens on Uniswap, check balances, and transfer ERC-20 tokens on Base — all through natural language.

## Prerequisites

- Node.js 18+
- A wallet private key with funds on Base (or Base Sepolia for testing)
- An OpenAI API key

## Step 1: Install Dependencies

```bash
npm init -y
npm install @goat-sdk/core @goat-sdk/adapter-vercel-ai @goat-sdk/wallet-viem \
  @goat-sdk/plugin-send-eth @goat-sdk/plugin-erc20 @goat-sdk/plugin-uniswap \
  @ai-sdk/openai ai viem dotenv tsx
```

## Step 2: Configure Environment

Create `.env`:

```bash
WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
RPC_URL=https://mainnet.base.org
OPENAI_API_KEY=sk-your-openai-key
```

## Step 3: Define Token Configuration

Create `tokens.ts`:

```typescript
export const USDC = {
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  chains: {
    8453: {
      contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
  },
};

export const WETH = {
  name: "Wrapped Ether",
  symbol: "WETH",
  decimals: 18,
  chains: {
    8453: {
      contractAddress: "0x4200000000000000000000000000000000000006",
    },
  },
};

export const DAI = {
  name: "Dai Stablecoin",
  symbol: "DAI",
  decimals: 18,
  chains: {
    8453: {
      contractAddress: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    },
  },
};
```

## Step 4: Build the Agent

Create `agent.ts`:

```typescript
import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { sendETH } from "@goat-sdk/plugin-send-eth";
import { erc20 } from "@goat-sdk/plugin-erc20";
import { uniswap } from "@goat-sdk/plugin-uniswap";
import { viem } from "@goat-sdk/wallet-viem";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { USDC, WETH, DAI } from "./tokens";

async function main() {
  const account = privateKeyToAccount(
    process.env.WALLET_PRIVATE_KEY as `0x${string}`
  );

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.RPC_URL),
  });

  const tools = await getOnChainTools({
    wallet: viem(walletClient),
    plugins: [
      sendETH(),
      erc20({ tokens: [USDC, WETH, DAI] }),
      uniswap(),
    ],
  });

  const result = await generateText({
    model: openai("gpt-4o"),
    tools,
    maxSteps: 10,
    system: `You are a DeFi assistant operating on Base. You can:
- Check token balances
- Transfer ETH and ERC-20 tokens
- Swap tokens via Uniswap
Always confirm the action you are about to take before executing.
Never send funds without the user specifying the exact amount and recipient.`,
    prompt: "What is my USDC balance? Then swap 10 USDC for WETH on Uniswap.",
  });

  console.log(result.text);

  for (const step of result.steps) {
    for (const toolResult of step.toolResults) {
      console.log(`Tool: ${toolResult.toolName}`);
      console.log(`Result:`, JSON.stringify(toolResult.result, null, 2));
    }
  }
}

main().catch(console.error);
```

## Step 5: Run

```bash
npx tsx agent.ts
```

## Expected Output

```
Your USDC balance is 150.00 USDC.

I'll swap 10 USDC for WETH on Uniswap.

Tool: get_balance
Result: { "value": "150000000", "symbol": "USDC", "decimals": 6 }

Tool: uniswap_swap
Result: { "hash": "0xabc...def", "amountOut": "0.003215" }

Swapped 10 USDC for approximately 0.003215 WETH. Transaction: 0xabc...def
```

## Adding More DeFi Plugins

Extend the agent with additional protocols:

```typescript
import { oneinch } from "@goat-sdk/plugin-1inch";
import { enso } from "@goat-sdk/plugin-enso";

const tools = await getOnChainTools({
  wallet: viem(walletClient),
  plugins: [
    sendETH(),
    erc20({ tokens: [USDC, WETH, DAI] }),
    uniswap(),
    oneinch(),
    enso(),
  ],
});
```

## Testnet Configuration

For testing on Base Sepolia, change the chain and token addresses:

```typescript
import { baseSepolia } from "viem/chains";

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});
```

Last verified: February 2026
