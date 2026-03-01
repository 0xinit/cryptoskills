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
import { HumanMessage } from "@langchain/core/messages";
import * as fs from "fs";
import * as readline from "readline";

// --- Configuration ---

const NETWORK_ID = "base-sepolia";
const WALLET_FILE = "./wallet-data.json";
const MODEL = "gpt-4o";

const SYSTEM_PROMPT = `You are a helpful onchain AI assistant with a crypto wallet.
You can check balances, send tokens, swap tokens, wrap ETH, and check prices.
Always confirm transaction details before executing.`;

// --- Wallet Persistence ---

async function initializeWallet(): Promise<CdpEvmWalletProvider> {
  let walletData: string | undefined;
  if (fs.existsSync(WALLET_FILE)) {
    walletData = fs.readFileSync(WALLET_FILE, "utf-8");
  }

  const wallet = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    networkId: NETWORK_ID,
    cdpWalletData: walletData ? JSON.parse(walletData) : undefined,
  });

  fs.writeFileSync(WALLET_FILE, JSON.stringify(wallet.exportWallet()));

  return wallet;
}

// --- Agent Setup ---

async function createAgent() {
  const wallet = await initializeWallet();
  console.log(`Wallet: ${wallet.getAddress()}`);
  console.log(`Network: ${NETWORK_ID}\n`);

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
    model: MODEL,
    temperature: 0,
  });

  const memory = new MemorySaver();

  return createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
    messageModifier: SYSTEM_PROMPT,
  });
}

// --- REPL ---

async function main() {
  const agent = await createAgent();
  const threadId = `session-${Date.now()}`;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  console.log("Agent ready. Type 'exit' to quit.\n");

  while (true) {
    const input = await prompt("You: ");
    if (input.toLowerCase() === "exit") break;
    if (!input.trim()) continue;

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
  console.log("Session ended.");
}

main().catch(console.error);
