# LangChain Conversational Agent

Build a full-featured conversational AI agent with LangChain, LangGraph, and AgentKit. The agent has access to wallet operations, token transfers, swaps, DeFi actions, and price feeds.

## Prerequisites

```bash
npm install @coinbase/agentkit @coinbase/agentkit-langchain @langchain/langgraph @langchain/openai dotenv
```

Environment variables:

```
CDP_API_KEY_ID=your-key-id
CDP_API_KEY_SECRET=your-key-secret
OPENAI_API_KEY=your-openai-key
```

## Full Agent

```typescript
import { config } from "dotenv";
config();

import {
  AgentKit,
  walletActionProvider,
  erc20ActionProvider,
  erc721ActionProvider,
  wethActionProvider,
  cdpApiActionProvider,
  pythActionProvider,
  CdpEvmWalletProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import * as fs from "fs";
import * as readline from "readline";

const WALLET_FILE = "./wallet-data.json";

const SYSTEM_PROMPT = `You are a helpful onchain AI assistant with access to a crypto wallet on Base Sepolia.

You can:
- Check wallet balances (ETH and ERC20 tokens)
- Send ETH and ERC20 token transfers
- Wrap ETH to WETH
- Swap tokens using the CDP trade API
- Check token prices via Pyth oracles
- Request testnet funds from the faucet

Always confirm the action and amounts before executing transactions.
When showing balances, format numbers with appropriate decimals.
If a transaction fails, explain the likely cause and suggest a fix.`;

async function initializeWallet(): Promise<CdpEvmWalletProvider> {
  let walletData: string | undefined;
  if (fs.existsSync(WALLET_FILE)) {
    walletData = fs.readFileSync(WALLET_FILE, "utf-8");
  }

  const wallet = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    networkId: "base-sepolia",
    cdpWalletData: walletData ? JSON.parse(walletData) : undefined,
  });

  fs.writeFileSync(WALLET_FILE, JSON.stringify(wallet.exportWallet()));
  return wallet;
}

async function main() {
  const wallet = await initializeWallet();
  console.log("Agent wallet:", wallet.getAddress());

  const agentKit = await AgentKit.from({
    walletProvider: wallet,
    actionProviders: [
      walletActionProvider(),
      erc20ActionProvider(),
      erc721ActionProvider(),
      wethActionProvider(),
      pythActionProvider(),
      cdpApiActionProvider({
        apiKeyId: process.env.CDP_API_KEY_ID!,
        apiKeySecret: process.env.CDP_API_KEY_SECRET!,
      }),
    ],
  });

  const tools = await getLangChainTools(agentKit);

  const llm = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  });

  const memory = new MemorySaver();

  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
    messageModifier: SYSTEM_PROMPT,
  });

  const threadId = `langchain-agent-${Date.now()}`;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  console.log("\nOnchain Agent ready. Type 'exit' to quit.\n");

  while (true) {
    const input = await prompt("You: ");
    if (input.toLowerCase() === "exit") break;

    try {
      const result = await agent.invoke(
        { messages: [new HumanMessage(input)] },
        { configurable: { thread_id: threadId } }
      );

      const lastMessage = result.messages[result.messages.length - 1];
      console.log(`\nAgent: ${lastMessage.content}\n`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`\nError: ${error.message}\n`);
      }
    }
  }

  rl.close();
}

main().catch(console.error);
```

## What This Demonstrates

1. **Full action provider stack** — Wallet, ERC20, ERC721, WETH, Pyth, and CDP API actions are all available to the agent.
2. **System prompt** — Configures the agent's personality and behavior via `messageModifier`.
3. **Persistent wallet** — Wallet state survives process restarts.
4. **Conversational memory** — LangGraph `MemorySaver` maintains conversation history within a session.
5. **Error handling** — Catches and displays transaction failures without crashing.

## Running

```bash
npx tsx langchain-agent.ts
```

## Sample Conversation

```
Agent wallet: 0xabcd...1234

Onchain Agent ready. Type 'exit' to quit.

You: Get me some testnet ETH
Agent: I've requested testnet ETH from the faucet. Your wallet 0xabcd...1234
should receive funds shortly on Base Sepolia.

You: What's the current price of ETH?
Agent: According to Pyth oracle, the current ETH/USD price is $2,847.32.

You: Check my balance
Agent: Your current balances on Base Sepolia:
- ETH: 0.1 ETH

You: Wrap 0.01 ETH
Agent: Successfully wrapped 0.01 ETH to WETH. Transaction: 0x123...
Your new balances:
- ETH: 0.09 ETH
- WETH: 0.01 WETH

You: Swap 0.005 ETH for USDC
Agent: Successfully swapped 0.005 ETH for 14.23 USDC via the CDP trade API.
Transaction: 0x456...

You: exit
```

## Using with Anthropic Claude

Replace the LLM initialization:

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-20250514",
  temperature: 0,
});
```

Install the additional dependency:

```bash
npm install @langchain/anthropic
```

Set the environment variable:

```
ANTHROPIC_API_KEY=your-anthropic-key
```

## Streaming Responses

For real-time output, use `streamEvents`:

```typescript
const stream = agent.streamEvents(
  { messages: [new HumanMessage(input)] },
  {
    configurable: { thread_id: threadId },
    version: "v2",
  }
);

for await (const event of stream) {
  if (
    event.event === "on_chat_model_stream" &&
    event.data.chunk?.content
  ) {
    process.stdout.write(event.data.chunk.content);
  }
}
```

Last verified: February 2026
