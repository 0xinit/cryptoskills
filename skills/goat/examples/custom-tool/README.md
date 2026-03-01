# Creating a Custom GOAT Plugin

Build a custom GOAT plugin that reads on-chain data from any smart contract. This example creates a plugin that checks the total supply and balance of any ERC-20 token via direct contract reads.

## Prerequisites

- Node.js 18+
- Familiarity with TypeScript and Zod schemas

## Step 1: Install Dependencies

```bash
npm init -y
npm install @goat-sdk/core @goat-sdk/adapter-vercel-ai @goat-sdk/wallet-viem \
  @ai-sdk/openai ai viem zod dotenv tsx
```

## Step 2: Create the Plugin with @Tool Decorator

Create `token-info-plugin.ts`:

```typescript
import { PluginBase, Tool, createToolParameters } from "@goat-sdk/core";
import type { EVMWalletClient, Chain } from "@goat-sdk/core";
import { z } from "zod";
import { formatUnits } from "viem";

class GetTokenInfoParameters extends createToolParameters(
  z.object({
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .describe("The ERC-20 token contract address"),
  })
) {}

class GetBalanceOfParameters extends createToolParameters(
  z.object({
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .describe("The ERC-20 token contract address"),
    holderAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .describe("The address to check balance for"),
  })
) {}

const ERC20_ABI = [
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

class TokenInfoTools {
  @Tool({
    name: "get_token_info",
    description:
      "Get the name, symbol, decimals, and total supply of an ERC-20 token",
  })
  async getTokenInfo(
    walletClient: EVMWalletClient,
    parameters: GetTokenInfoParameters
  ): Promise<string> {
    const address = parameters.tokenAddress as `0x${string}`;

    const nameResult = await walletClient.read({
      address,
      abi: ERC20_ABI,
      functionName: "name",
    });

    const symbolResult = await walletClient.read({
      address,
      abi: ERC20_ABI,
      functionName: "symbol",
    });

    const decimalsResult = await walletClient.read({
      address,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    const totalSupplyResult = await walletClient.read({
      address,
      abi: ERC20_ABI,
      functionName: "totalSupply",
    });

    const decimals = Number(decimalsResult.value);
    const totalSupply = formatUnits(totalSupplyResult.value as bigint, decimals);

    return JSON.stringify({
      name: nameResult.value,
      symbol: symbolResult.value,
      decimals,
      totalSupply,
    });
  }

  @Tool({
    name: "get_holder_balance",
    description: "Get the ERC-20 token balance of a specific address",
  })
  async getHolderBalance(
    walletClient: EVMWalletClient,
    parameters: GetBalanceOfParameters
  ): Promise<string> {
    const tokenAddress = parameters.tokenAddress as `0x${string}`;
    const holderAddress = parameters.holderAddress as `0x${string}`;

    const decimalsResult = await walletClient.read({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    const balanceResult = await walletClient.read({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [holderAddress],
    });

    const decimals = Number(decimalsResult.value);
    const balance = formatUnits(balanceResult.value as bigint, decimals);

    return JSON.stringify({ holder: holderAddress, balance, decimals });
  }
}

export class TokenInfoPlugin extends PluginBase<EVMWalletClient> {
  constructor() {
    super("tokenInfo", [new TokenInfoTools()]);
  }

  supportsChain = (chain: Chain) => chain.type === "evm";
}

export const tokenInfo = () => new TokenInfoPlugin();
```

## Step 3: Alternative — createTool Pattern

For simpler tools, use `createTool` instead of decorators. Create `simple-plugin.ts`:

```typescript
import { PluginBase, createTool } from "@goat-sdk/core";
import type { WalletClientBase, Chain } from "@goat-sdk/core";
import { z } from "zod";

export class WalletInfoPlugin extends PluginBase<WalletClientBase> {
  constructor() {
    super("walletInfo", []);
  }

  supportsChain = (chain: Chain) => true;

  getTools(walletClient: WalletClientBase) {
    return [
      createTool(
        {
          name: "get_wallet_address",
          description: "Get the connected wallet address",
          parameters: z.object({}),
        },
        async () => {
          const address = await walletClient.getAddress();
          return `Connected wallet: ${address}`;
        }
      ),
      createTool(
        {
          name: "get_native_balance",
          description: "Get the native token balance of the connected wallet",
          parameters: z.object({}),
        },
        async () => {
          const address = await walletClient.getAddress();
          const balance = await walletClient.balanceOf(address);
          return JSON.stringify(balance);
        }
      ),
    ];
  }
}

export const walletInfo = () => new WalletInfoPlugin();
```

## Step 4: Use the Custom Plugin

Create `agent.ts`:

```typescript
import "dotenv/config";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { viem } from "@goat-sdk/wallet-viem";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { tokenInfo } from "./token-info-plugin";
import { walletInfo } from "./simple-plugin";

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
    plugins: [tokenInfo(), walletInfo()],
  });

  const result = await generateText({
    model: openai("gpt-4o"),
    tools,
    maxSteps: 5,
    prompt:
      "What is the total supply of USDC on Base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)? Also show my wallet address.",
  });

  console.log(result.text);
}

main().catch(console.error);
```

## Step 5: Run

```bash
npx tsx agent.ts
```

## Expected Output

```
Tool: get_wallet_address
Result: "Connected wallet: 0xYour...Address"

Tool: get_token_info
Result: { "name": "USD Coin", "symbol": "USDC", "decimals": 6, "totalSupply": "3245678901.234567" }

Your wallet address is 0xYour...Address.
USDC on Base has a total supply of approximately 3.25 billion tokens.
```

## Plugin Scaffolding CLI

For production plugins intended for contribution to the GOAT SDK:

```bash
pnpm create-plugin -n my-protocol -t evm
```

This generates the standard directory structure:

```
packages/plugins/my-protocol/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── my-protocol.plugin.ts
    ├── my-protocol.service.ts
    └── parameters.ts
```

Last verified: February 2026
