# Wallet Management Agent

Build an AI agent that creates a CDP wallet, checks balances, and sends native token transfers on Base Sepolia.

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

import { AgentKit, walletActionProvider, CdpEvmWalletProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import * as fs from "fs";
import * as readline from "readline";

const WALLET_FILE = "./wallet-data.json";

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

  const exported = wallet.exportWallet();
  fs.writeFileSync(WALLET_FILE, JSON.stringify(exported));

  return wallet;
}

async function main() {
  const wallet = await initializeWallet();
  console.log("Wallet address:", wallet.getAddress());

  const agentKit = await AgentKit.from({
    walletProvider: wallet,
    actionProviders: [walletActionProvider()],
  });

  const tools = await getLangChainTools(agentKit);
  const llm = new ChatOpenAI({ model: "gpt-4o" });
  const memory = new MemorySaver();

  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const threadId = `wallet-agent-${Date.now()}`;

  const prompt = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  console.log("\nWallet Agent ready. Commands:");
  console.log("  'balance'  — Check ETH balance");
  console.log("  'address'  — Show wallet address");
  console.log("  'send 0.001 ETH to 0x...' — Transfer ETH");
  console.log("  'exit' — Quit\n");

  while (true) {
    const input = await prompt("You: ");
    if (input.toLowerCase() === "exit") break;

    const result = await agent.invoke(
      { messages: [new HumanMessage(input)] },
      { configurable: { thread_id: threadId } }
    );

    const lastMessage = result.messages[result.messages.length - 1];
    console.log(`Agent: ${lastMessage.content}\n`);
  }

  rl.close();
}

main().catch(console.error);
```

## What This Demonstrates

1. **Wallet persistence** — Wallet data is serialized to disk and restored on restart, so the agent keeps the same address across sessions.
2. **walletActionProvider** — Gives the agent `getBalance`, `getWalletDetails`, and `nativeTransfer` capabilities.
3. **Conversational memory** — `MemorySaver` + `thread_id` lets the agent reference previous messages in the same session.

## Running

```bash
npx tsx wallet-agent.ts
```

## Expected Output

```
Wallet address: 0x1234...abcd

Wallet Agent ready. Commands:
  'balance'  — Check ETH balance
  'address'  — Show wallet address
  'send 0.001 ETH to 0x...' — Transfer ETH
  'exit' — Quit

You: balance
Agent: Your current ETH balance on Base Sepolia is 0.05 ETH.

You: send 0.001 ETH to 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18
Agent: Successfully sent 0.001 ETH to 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18. Transaction hash: 0xabc123...
```

## Testnet Funding

Fund the wallet with Base Sepolia ETH from the CDP faucet. Add `cdpApiActionProvider` to enable the agent to request funds itself:

```typescript
import { cdpApiActionProvider } from "@coinbase/agentkit";

const agentKit = await AgentKit.from({
  walletProvider: wallet,
  actionProviders: [
    walletActionProvider(),
    cdpApiActionProvider({
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    }),
  ],
});
```

Then ask: "Request testnet ETH from the faucet."

Last verified: February 2026
