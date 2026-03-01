# LangChain Web3 Agent with Brian API

End-to-end example: build an autonomous Web3 agent that executes on-chain transactions from conversational input using `@brian-ai/langchain` and OpenAI.

## Prerequisites

```bash
npm install @brian-ai/langchain @langchain/openai langchain viem
```

Environment variables:

```bash
export BRIAN_API_KEY="brian_..."
export OPENAI_API_KEY="sk-..."
export PRIVATE_KEY="0x..."
```

## Step 1: Create a Basic Agent

```typescript
import { createBrianAgent } from "@brian-ai/langchain";
import { ChatOpenAI } from "@langchain/openai";

const agent = await createBrianAgent({
  apiKey: process.env.BRIAN_API_KEY!,
  privateKeyOrAccount: process.env.PRIVATE_KEY as `0x${string}`,
  llm: new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0,
  }),
});
```

## Step 2: Execute a Single Intent

```typescript
const result = await agent.invoke({
  input: "Swap 10 USDC for ETH on Base",
});

console.log(result.output);
```

The agent interprets the input, calls Brian's transaction endpoint, signs the transactions with the provided private key, and broadcasts them.

## Step 3: Multi-Turn Conversation

```typescript
const conversationResult = await agent.invoke({
  input: "What is the current price of ETH?",
});
console.log(conversationResult.output);

const swapResult = await agent.invoke({
  input: "Swap 100 USDC for ETH on Arbitrum",
});
console.log(swapResult.output);

const bridgeResult = await agent.invoke({
  input: "Bridge the ETH I just got to Base",
});
console.log(bridgeResult.output);
```

## Using BrianToolkit Directly

For more control over which tools the agent has access to:

```typescript
import { BrianToolkit } from "@brian-ai/langchain";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

const toolkit = new BrianToolkit({
  apiKey: process.env.BRIAN_API_KEY!,
  privateKeyOrAccount: process.env.PRIVATE_KEY as `0x${string}`,
});

const tools = toolkit.getTools();

console.log("Available tools:");
tools.forEach((tool) => {
  console.log(`  - ${tool.name}: ${tool.description}`);
});

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0,
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful Web3 assistant. You can execute blockchain transactions on behalf of the user. Always confirm the action before executing.",
  ],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const agent = await createOpenAIFunctionsAgent({
  llm,
  tools,
  prompt,
});

const executor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
});

const result = await executor.invoke({
  input: "Deposit 100 USDC into Aave on Ethereum",
});

console.log(result.output);
```

## With Coinbase CDP Wallet

Use a Coinbase MPC wallet instead of a raw private key:

```typescript
import { BrianCDPToolkit } from "@brian-ai/langchain";
import { ChatOpenAI } from "@langchain/openai";
import { createBrianAgent } from "@brian-ai/langchain";

const cdpToolkit = new BrianCDPToolkit({
  apiKey: process.env.BRIAN_API_KEY!,
  coinbaseApiKeyName: process.env.CDP_API_KEY_NAME!,
  coinbaseApiKeySecret: process.env.CDP_API_KEY_SECRET!,
});

const tools = cdpToolkit.getTools();

const agent = await createBrianAgent({
  apiKey: process.env.BRIAN_API_KEY!,
  privateKeyOrAccount: process.env.PRIVATE_KEY as `0x${string}`,
  llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
  instructions: "You manage a Coinbase CDP wallet. Execute DeFi operations safely.",
});
```

## Knowledge-Only Agent

Build an agent that answers DeFi questions without executing transactions:

```typescript
import { BrianSDK } from "@brian-ai/sdk";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicTool } from "@langchain/core/tools";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

const brian = new BrianSDK({
  apiKey: process.env.BRIAN_API_KEY!,
});

const knowledgeTool = new DynamicTool({
  name: "brian-knowledge",
  description: "Ask questions about DeFi protocols, chains, and Web3 concepts",
  func: async (input: string) => {
    const response = await brian.ask({
      prompt: input,
      kb: "public-knowledge-box",
    });
    return response.result.answer;
  },
});

const llm = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a DeFi research assistant. Use the knowledge tool to answer questions about protocols and chains."],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const agent = await createOpenAIFunctionsAgent({
  llm,
  tools: [knowledgeTool],
  prompt,
});

const executor = new AgentExecutor({
  agent,
  tools: [knowledgeTool],
});

const result = await executor.invoke({
  input: "How does Uniswap V4 hooks system work?",
});

console.log(result.output);
```

## Adding Safety Guards

Production agents should validate transactions before execution:

```typescript
import { BrianToolkit } from "@brian-ai/langchain";
import { DynamicTool } from "@langchain/core/tools";

const toolkit = new BrianToolkit({
  apiKey: process.env.BRIAN_API_KEY!,
  privateKeyOrAccount: process.env.PRIVATE_KEY as `0x${string}`,
});

const ALLOWED_CHAINS = new Set(["1", "8453", "42161", "10"]);
const MAX_VALUE_USD = 1000;

const guardedTools = toolkit.getTools().map((tool) => {
  const originalFunc = tool.func.bind(tool);

  return new DynamicTool({
    name: tool.name,
    description: tool.description,
    func: async (input: string) => {
      console.log(`[GUARD] Tool: ${tool.name}, Input: ${input}`);

      // Add chain validation, value limits, or confirmation prompts here
      // For production: integrate with a policy engine or human-in-the-loop

      return originalFunc(input);
    },
  });
});
```

## Error Handling

```typescript
async function safeAgentInvoke(agent: AgentExecutor, input: string) {
  try {
    const result = await agent.invoke({ input });
    return result.output;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        return "Transaction failed: insufficient balance for this operation.";
      }
      if (error.message.includes("429")) {
        return "Rate limited. Please wait a moment and try again.";
      }
      if (error.message.includes("user rejected")) {
        return "Transaction was rejected.";
      }
      return `Agent error: ${error.message}`;
    }
    return "An unexpected error occurred.";
  }
}
```

Last verified: February 2026
