# Deploy Contract Agent

Build an AI agent that compiles and deploys a Solidity smart contract to Base Sepolia using AgentKit's wallet provider.

## Prerequisites

```bash
npm install @coinbase/agentkit @coinbase/agentkit-langchain @langchain/langgraph @langchain/openai solc dotenv
```

Environment variables:

```
CDP_API_KEY_ID=your-key-id
CDP_API_KEY_SECRET=your-key-secret
OPENAI_API_KEY=your-openai-key
```

## Contract to Deploy

A minimal ERC20 token:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _initialSupply * 10 ** decimals;
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        require(balanceOf[from] >= amount, "Insufficient balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
```

## Full Agent

```typescript
import { config } from "dotenv";
config();

import {
  AgentKit,
  walletActionProvider,
  CdpEvmWalletProvider,
  ActionProvider,
  WalletProvider,
  Network,
  CreateAction,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import solc from "solc";

const DeployTokenSchema = z.object({
  name: z.string().describe("Token name"),
  symbol: z.string().describe("Token symbol"),
  initialSupply: z.string().describe("Initial supply (whole tokens, not wei)"),
});

class DeployTokenProvider extends ActionProvider<WalletProvider> {
  constructor() {
    super("deploy-token", []);
  }

  @CreateAction({
    name: "deploy_token",
    description: "Compile and deploy a SimpleToken ERC20 contract with the given name, symbol, and initial supply",
    schema: DeployTokenSchema,
  })
  async deployToken(
    walletProvider: WalletProvider,
    params: z.infer<typeof DeployTokenSchema>
  ): Promise<string> {
    const source = `
      // SPDX-License-Identifier: MIT
      pragma solidity ^0.8.20;
      contract SimpleToken {
        string public name;
        string public symbol;
        uint8 public constant decimals = 18;
        uint256 public totalSupply;
        mapping(address => uint256) public balanceOf;
        mapping(address => mapping(address => uint256)) public allowance;
        event Transfer(address indexed from, address indexed to, uint256 value);
        event Approval(address indexed owner, address indexed spender, uint256 value);
        constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
          name = _name;
          symbol = _symbol;
          totalSupply = _initialSupply * 10 ** decimals;
          balanceOf[msg.sender] = totalSupply;
          emit Transfer(address(0), msg.sender, totalSupply);
        }
        function transfer(address to, uint256 amount) external returns (bool) {
          require(balanceOf[msg.sender] >= amount, "Insufficient balance");
          balanceOf[msg.sender] -= amount;
          balanceOf[to] += amount;
          emit Transfer(msg.sender, to, amount);
          return true;
        }
        function approve(address spender, uint256 amount) external returns (bool) {
          allowance[msg.sender][spender] = amount;
          emit Approval(msg.sender, spender, amount);
          return true;
        }
        function transferFrom(address from, address to, uint256 amount) external returns (bool) {
          require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
          require(balanceOf[from] >= amount, "Insufficient balance");
          allowance[from][msg.sender] -= amount;
          balanceOf[from] -= amount;
          balanceOf[to] += amount;
          emit Transfer(from, to, amount);
          return true;
        }
      }
    `;

    const input = {
      language: "Solidity",
      sources: { "SimpleToken.sol": { content: source } },
      settings: {
        outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
      },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors?.some((e: { severity: string }) => e.severity === "error")) {
      return `Compilation failed: ${JSON.stringify(output.errors)}`;
    }

    const contract = output.contracts["SimpleToken.sol"]["SimpleToken"];
    const abi = contract.abi;
    const bytecode = `0x${contract.evm.bytecode.object}`;

    const { encodeFunctionData } = await import("viem");
    const constructorArgs = encodeFunctionData({
      abi,
      functionName: undefined,
      args: [params.name, params.symbol, BigInt(params.initialSupply)],
    });

    const deployData = bytecode + constructorArgs.slice(2);
    const txHash = await walletProvider.sendTransaction({
      to: undefined,
      data: deployData as `0x${string}`,
    });

    return `Token deployed! Name: ${params.name}, Symbol: ${params.symbol}, Supply: ${params.initialSupply}. Transaction: ${txHash}`;
  }

  supportsNetwork(_network: Network): boolean {
    return true;
  }
}

const deployTokenProvider = () => new DeployTokenProvider();

async function main() {
  const wallet = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    networkId: "base-sepolia",
  });

  console.log("Deploy Agent wallet:", wallet.getAddress());

  const agentKit = await AgentKit.from({
    walletProvider: wallet,
    actionProviders: [walletActionProvider(), deployTokenProvider()],
  });

  const tools = await getLangChainTools(agentKit);
  const llm = new ChatOpenAI({ model: "gpt-4o" });
  const agent = createReactAgent({ llm, tools });

  const result = await agent.invoke({
    messages: [
      new HumanMessage(
        'Deploy a token called "Test Agent Token" with symbol "TAT" and initial supply of 1000000'
      ),
    ],
  });

  const lastMessage = result.messages[result.messages.length - 1];
  console.log(`Agent: ${lastMessage.content}`);
}

main().catch(console.error);
```

## What This Demonstrates

1. **Custom ActionProvider** — Extends `ActionProvider` with `@CreateAction` decorator to add a compile-and-deploy action.
2. **In-memory Solidity compilation** — Uses `solc` to compile contracts at runtime without Foundry or Hardhat.
3. **Agent-driven deployment** — The agent decides how to interpret the user's deployment request and calls the action.
4. **Zod schema validation** — Constructor parameters are validated before compilation.

## Running

```bash
npx tsx deploy-agent.ts
```

Ensure `emitDecoratorMetadata` and `experimentalDecorators` are `true` in your `tsconfig.json`.

## Expected Output

```
Deploy Agent wallet: 0xabcd...1234
Agent: Successfully deployed "Test Agent Token" (TAT) with 1,000,000 initial supply on Base Sepolia. Transaction hash: 0xdef789...
```

## Production Considerations

- For real deployments, compile contracts offline and pass verified bytecode rather than compiling at runtime.
- Verify deployed contracts on Basescan using `npx hardhat verify` or the Basescan API.
- Consider using `CdpSmartWalletProvider` with a paymaster for gasless deployments.

Last verified: February 2026
