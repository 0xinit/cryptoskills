# Token Swap Agent

Build an AI agent that swaps tokens using the CDP trade API on Base Sepolia. The agent can check balances, approve tokens, and execute swaps.

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
  cdpApiActionProvider,
  wethActionProvider,
  CdpEvmWalletProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const wallet = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    networkId: "base-sepolia",
  });

  console.log("Swap Agent wallet:", wallet.getAddress());

  const agentKit = await AgentKit.from({
    walletProvider: wallet,
    actionProviders: [
      walletActionProvider(),
      erc20ActionProvider(),
      wethActionProvider(),
      cdpApiActionProvider({
        apiKeyId: process.env.CDP_API_KEY_ID!,
        apiKeySecret: process.env.CDP_API_KEY_SECRET!,
      }),
    ],
  });

  const tools = await getLangChainTools(agentKit);
  const llm = new ChatOpenAI({ model: "gpt-4o" });
  const memory = new MemorySaver();

  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
  });

  const threadId = `swap-agent-${Date.now()}`;

  const commands = [
    "What is my ETH balance?",
    "Wrap 0.001 ETH to WETH",
    `Swap 0.0005 ETH for USDC (contract: ${USDC_BASE_SEPOLIA})`,
    `Check my USDC balance for token ${USDC_BASE_SEPOLIA}`,
  ];

  for (const command of commands) {
    console.log(`\nUser: ${command}`);
    const result = await agent.invoke(
      { messages: [new HumanMessage(command)] },
      { configurable: { thread_id: threadId } }
    );

    const lastMessage = result.messages[result.messages.length - 1];
    console.log(`Agent: ${lastMessage.content}`);
  }
}

main().catch(console.error);
```

## What This Demonstrates

1. **CDP trade API** — `cdpApiActionProvider` exposes `tradeTokens` which handles routing, approval, and execution in a single action.
2. **WETH wrapping** — `wethActionProvider` adds `wrapEth` to convert native ETH to WETH.
3. **ERC20 balance checks** — `erc20ActionProvider` reads token balances by contract address.
4. **Multi-step reasoning** — The agent checks balance first, wraps ETH, swaps tokens, then confirms the new balance.

## Running

```bash
npx tsx swap-agent.ts
```

## Expected Output

```
Swap Agent wallet: 0xabcd...1234

User: What is my ETH balance?
Agent: Your ETH balance on Base Sepolia is 0.05 ETH.

User: Wrap 0.001 ETH to WETH
Agent: Successfully wrapped 0.001 ETH to WETH. Transaction: 0xdef456...

User: Swap 0.0005 ETH for USDC (contract: 0x036CbD53842c5426634e7929541eC2318f3dCF7e)
Agent: Successfully swapped 0.0005 ETH for 1.25 USDC. Transaction: 0x789abc...

User: Check my USDC balance for token 0x036CbD53842c5426634e7929541eC2318f3dCF7e
Agent: Your USDC balance is 1.25 USDC.
```

## Token Addresses (Base Sepolia)

| Token | Address |
|-------|---------|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| WETH | `0x4200000000000000000000000000000000000006` |

## Notes on CDP Swap API

- The `tradeTokens` action uses Coinbase's swap routing. No need to interact with DEX contracts directly.
- Approvals are handled automatically — the action checks allowance and approves if needed before executing the swap.
- Slippage defaults are set by the CDP API. For production, implement custom slippage checks in a wrapper action.

Last verified: February 2026
