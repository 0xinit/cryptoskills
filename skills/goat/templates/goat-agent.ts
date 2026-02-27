import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { sendETH } from "@goat-sdk/plugin-send-eth";
import { erc20 } from "@goat-sdk/plugin-erc20";
import { viem } from "@goat-sdk/wallet-viem";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// Token definitions — add your tokens here
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

// Required environment variables:
//   WALLET_PRIVATE_KEY — hex-encoded private key (0x...)
//   RPC_URL — JSON-RPC endpoint for the target chain
//   OPENAI_API_KEY — OpenAI API key for the LLM

function validateEnv(): void {
  const required = ["WALLET_PRIVATE_KEY", "RPC_URL", "OPENAI_API_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

async function main(): Promise<void> {
  validateEnv();

  const account = privateKeyToAccount(
    process.env.WALLET_PRIVATE_KEY as `0x${string}`
  );

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.RPC_URL),
  });

  // Add or remove plugins based on your use case
  const tools = await getOnChainTools({
    wallet: viem(walletClient),
    plugins: [
      sendETH(),
      erc20({ tokens: [USDC] }),
      // Add more plugins here:
      // uniswap(),
      // debridge(),
      // coingecko(),
    ],
  });

  const result = await generateText({
    model: openai("gpt-4o"),
    tools,
    maxSteps: 10,
    system: `You are an onchain AI agent operating on Base.
You can check balances, transfer tokens, and interact with DeFi protocols.
Always confirm the action before executing transactions.
Never send funds without the user specifying the exact amount and recipient.`,
    prompt: "What is my ETH balance?",
    onStepFinish: ({ toolResults }) => {
      for (const result of toolResults ?? []) {
        console.log(`[Tool] ${result.toolName}:`, JSON.stringify(result.result));
      }
    },
  });

  console.log("\nAgent response:", result.text);
}

main().catch((error) => {
  console.error("Agent failed:", error);
  process.exit(1);
});
