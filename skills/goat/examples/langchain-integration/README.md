# GOAT + LangChain Agent

Build a conversational AI agent using LangChain and GOAT that can interact with DeFi protocols through a chat loop.

## Prerequisites

- Node.js 18+
- Wallet private key funded on Base (or Base Sepolia)
- OpenAI API key

## Step 1: Install Dependencies

```bash
npm init -y
npm install @goat-sdk/core @goat-sdk/adapter-langchain @goat-sdk/wallet-viem \
  @goat-sdk/plugin-send-eth @goat-sdk/plugin-erc20 \
  @langchain/openai @langchain/core langchain \
  viem dotenv tsx readline
```

## Step 2: Configure Environment

Create `.env`:

```bash
WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
RPC_URL=https://mainnet.base.org
OPENAI_API_KEY=sk-your-openai-key
```

## Step 3: Build the LangChain Agent

Create `langchain-agent.ts`:

```typescript
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { getOnChainTools } from "@goat-sdk/adapter-langchain";
import { sendETH } from "@goat-sdk/plugin-send-eth";
import { erc20 } from "@goat-sdk/plugin-erc20";
import { viem } from "@goat-sdk/wallet-viem";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import * as readline from "readline";

const USDC = {
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  chains: {
    8453: {
      contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
  },
};

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
    plugins: [sendETH(), erc20({ tokens: [USDC] })],
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a helpful onchain assistant operating on Base. You can:
- Check ETH and ERC-20 token balances
- Transfer ETH and tokens to any address
- Look up token information
Always confirm amounts and addresses before executing transactions.`,
    ],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const llm = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  });

  const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
  const executor = new AgentExecutor({ agent, tools, verbose: true });

  const chatHistory: (HumanMessage | AIMessage)[] = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("GOAT + LangChain Agent ready. Type 'exit' to quit.\n");

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      const response = await executor.invoke({
        input,
        chat_history: chatHistory,
      });

      chatHistory.push(new HumanMessage(input));
      chatHistory.push(new AIMessage(response.output));

      console.log(`\nAgent: ${response.output}\n`);
      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error);
```

## Step 4: Run

```bash
npx tsx langchain-agent.ts
```

## Example Conversation

```
GOAT + LangChain Agent ready. Type 'exit' to quit.

You: What is my ETH balance?
Agent: Your ETH balance is 0.542 ETH on Base.

You: How much USDC do I have?
Agent: You have 250.00 USDC on Base.

You: Send 10 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18
Agent: I'll send 10 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18.

Transaction submitted: 0xabc...def
Successfully sent 10 USDC. Your remaining balance is 240.00 USDC.
```

## Python Equivalent

GOAT also supports LangChain in Python:

```bash
pip install goat-sdk goat-sdk-adapter-langchain goat-sdk-plugin-erc20 \
  goat-sdk-plugin-send-eth goat-sdk-wallet-viem langchain-openai
```

```python
import os
from dotenv import load_dotenv
from goat_adapters.langchain import get_on_chain_tools
from goat_plugins.erc20 import erc20
from goat_plugins.send_eth import send_eth
from goat_wallets.viem import viem
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

load_dotenv()

wallet_client = viem(
    private_key=os.environ["WALLET_PRIVATE_KEY"],
    rpc_url=os.environ["RPC_URL"],
    chain_id=8453,
)

tools = get_on_chain_tools(
    wallet=wallet_client,
    plugins=[send_eth(), erc20()],
)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful onchain assistant on Base."),
    MessagesPlaceholder("chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder("agent_scratchpad"),
])

llm = ChatOpenAI(model="gpt-4o", temperature=0)
agent = create_openai_functions_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

response = executor.invoke({"input": "What is my ETH balance?", "chat_history": []})
print(response["output"])
```

## Adding Memory with LangChain

For production agents with persistent conversation memory:

```typescript
import { BufferMemory } from "langchain/memory";

const memory = new BufferMemory({
  memoryKey: "chat_history",
  returnMessages: true,
});

const executor = new AgentExecutor({
  agent,
  tools,
  memory,
  verbose: true,
});

const response = await executor.invoke({ input: "Check my balance" });
```

Last verified: February 2026
