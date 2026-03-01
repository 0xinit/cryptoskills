# AgentKit Troubleshooting

Common issues and fixes when building agents with `@coinbase/agentkit`.

Last verified: February 2026

## CDP API Key Not Working

### Symptoms

```
Error: Invalid API key
Error: Unauthorized
```

AgentKit fails to initialize the wallet provider or returns authentication errors on every action.

### Solutions

1. Verify the key exists and is active at https://portal.cdp.coinbase.com under your project's API Keys section.

2. Ensure you are using a **Secret API Key**, not a regular API key. AgentKit requires the secret key type which has both `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET`.

3. Check for whitespace or newline characters in your environment variables:
   ```bash
   echo -n "$CDP_API_KEY_SECRET" | wc -c
   ```
   Compare the character count against the expected length. Trailing newlines from copy-paste are a common cause.

4. If using a `.env` file, ensure values are not wrapped in quotes with escape characters:
   ```
   # Correct
   CDP_API_KEY_SECRET=your-secret-here

   # Wrong — extra quotes become part of the value
   CDP_API_KEY_SECRET="your-secret-here"
   ```

5. Regenerate the key pair in the CDP portal if the above checks pass. Key secrets cannot be retrieved after creation — you must create a new one.

## Wallet Initialization Fails

### Symptoms

```
Error: Wallet not found
Error: Invalid wallet data
Error: Failed to create wallet
```

### Solutions

1. Delete any persisted wallet data file and let AgentKit create a fresh wallet:
   ```bash
   rm wallet-data.json
   ```

2. Verify your CDP API key has wallet creation permissions. Keys can be scoped in the portal.

3. Check the `networkId` is valid. Common mistake: using `base` instead of `base-sepolia` or `base-mainnet`.

4. If restoring from exported data, ensure the JSON structure has not been modified:
   ```typescript
   const data = JSON.parse(fs.readFileSync("wallet-data.json", "utf-8"));
   console.log(Object.keys(data));
   ```

5. CDP wallet IDs are tied to the API key's project. Using wallet data from a different project will fail.

## Node.js Version Incompatibility

### Symptoms

```
SyntaxError: Unexpected token '?.'
TypeError: fetch is not a function
Error: Cannot find module 'node:crypto'
```

Runtime crashes on import or during the first API call.

### Solutions

1. AgentKit requires Node.js v22+. Check your version:
   ```bash
   node --version
   ```

2. If using `nvm`:
   ```bash
   nvm install 22
   nvm use 22
   ```

3. Verify the correct Node.js is in your PATH, especially in CI environments where the system Node.js may be older.

## Agent Loops Without Making Progress

### Symptoms

The LangChain or Vercel AI agent calls the same tool repeatedly, generates hallucinated tool names, or hits the maximum iteration limit without producing a useful result.

### Solutions

1. Reduce the number of action providers. More tools means more confusion for the LLM. Start with 3-5 providers and add more as needed:
   ```typescript
   const agentKit = await AgentKit.from({
     walletProvider: wallet,
     actionProviders: [
       walletActionProvider(),
       erc20ActionProvider(),
       cdpApiActionProvider({ ... }),
     ],
   });
   ```

2. Add a system prompt that explicitly tells the agent which tools to use for which tasks:
   ```typescript
   const agent = createReactAgent({
     llm,
     tools,
     messageModifier: `You have wallet tools. Use getBalance to check balances, nativeTransfer to send ETH, and tradeTokens to swap.`,
   });
   ```

3. Set `temperature: 0` on the LLM to reduce randomness in tool selection.

4. For LangChain, increase `maxIterations` if the task genuinely requires many steps:
   ```typescript
   const result = await agent.invoke(
     { messages: [new HumanMessage(input)] },
     { configurable: { thread_id: "t1" }, recursionLimit: 25 }
   );
   ```

5. Log tool calls to identify the loop pattern (see error-codes.md for debugging snippets).

## Transaction Reverts with No Clear Error

### Symptoms

```
Error: Transaction reverted
Error: execution reverted
```

The agent reports a transaction failure but the revert reason is not surfaced.

### Solutions

1. Check if the wallet has sufficient balance for both the transaction value and gas:
   ```typescript
   const balance = await walletProvider.getBalance();
   console.log("Balance:", balance);
   ```

2. For ERC20 operations, verify approval exists before transfer:
   ```typescript
   const tools = await getLangChainTools(agentKit);
   ```
   Ask the agent: "Check the allowance of [spender] for [token]" before attempting a transfer.

3. Simulate the transaction on a block explorer. Copy the `to`, `data`, and `value` fields from the error logs and paste into Tenderly or Basescan's transaction simulator.

4. On Base Sepolia, ensure the contract you are interacting with is actually deployed. Testnet contracts may be redeployed at different addresses between versions.

5. For smart wallet (`CdpSmartWalletProvider`) transactions, the revert happens inside the UserOperation. Use the bundler's debug endpoint or check the inner call trace on the block explorer.

## Decorator Metadata Error with Custom Actions

### Symptoms

```
Error: emitDecoratorMetadata is not enabled
TypeError: Reflect.getMetadata is not a function
```

Custom action providers using `@CreateAction` fail at runtime.

### Solutions

1. Add both decorator options to `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "emitDecoratorMetadata": true,
       "experimentalDecorators": true
     }
   }
   ```

2. Install `reflect-metadata` if not already present:
   ```bash
   npm install reflect-metadata
   ```
   Import it at the top of your entry file:
   ```typescript
   import "reflect-metadata";
   ```

3. If using `tsx` or `ts-node`, ensure it respects `tsconfig.json`. With `tsx`, this works automatically. With `ts-node`, add:
   ```json
   {
     "ts-node": {
       "compilerOptions": {
         "emitDecoratorMetadata": true,
         "experimentalDecorators": true
       }
     }
   }
   ```

## Faucet Requests Failing

### Symptoms

```
Error: Faucet request failed
Error: Faucet not available on this network
```

### Solutions

1. The CDP faucet is only available on `base-sepolia` and `ethereum-sepolia`. It does not work on mainnet or other testnets.

2. Each wallet address has a daily request limit. Wait 24 hours before requesting again.

3. Ensure `cdpApiActionProvider` is registered with valid credentials:
   ```typescript
   cdpApiActionProvider({
     apiKeyId: process.env.CDP_API_KEY_ID!,
     apiKeySecret: process.env.CDP_API_KEY_SECRET!,
   })
   ```

4. If the faucet is temporarily down, fund the wallet manually via the Base Sepolia faucet at https://www.coinbase.com/faucets/base-ethereum/sepolia.

## Import Errors After Upgrading

### Symptoms

```
Error: Module '@coinbase/cdp-agentkit-core' not found
Error: CdpWalletProvider is not exported from '@coinbase/agentkit'
```

Code that worked with the old SDK breaks after upgrading to `@coinbase/agentkit` v0.1+.

### Solutions

1. The old packages are deprecated. Migration map:

   | Old Import | New Import |
   |-----------|------------|
   | `@coinbase/cdp-agentkit-core` | `@coinbase/agentkit` |
   | `@coinbase/cdp-langchain` | `@coinbase/agentkit-langchain` |
   | `CdpWalletProvider` | `CdpEvmWalletProvider` |
   | `CdpToolkit` | `getLangChainTools(agentKit)` |
   | `CdpTool` | `@CreateAction` decorator |

2. Remove old packages:
   ```bash
   npm uninstall @coinbase/cdp-agentkit-core @coinbase/cdp-langchain
   npm install @coinbase/agentkit @coinbase/agentkit-langchain
   ```

3. Update wallet initialization:
   ```typescript
   // Old
   const wallet = await CdpWalletProvider.configureWithWallet({ ... });

   // New
   const wallet = await CdpEvmWalletProvider.configureWithWallet({ ... });
   ```

4. Update tool creation:
   ```typescript
   // Old
   const toolkit = new CdpToolkit(agentKit);
   const tools = toolkit.getTools();

   // New
   const tools = await getLangChainTools(agentKit);
   ```
