# GOAT Troubleshooting

Common issues and fixes when building onchain AI agents with GOAT SDK.

Last verified: February 2026

## Agent Makes One Tool Call and Stops

### Symptoms

The agent calls a single tool (e.g., checks balance) then returns a text response without performing subsequent actions like transfers or swaps.

### Solutions

1. **Set `maxSteps` in Vercel AI SDK:**

```typescript
const result = await generateText({
  model: openai("gpt-4o"),
  tools,
  maxSteps: 10,
  prompt: userMessage,
});
```

Without `maxSteps`, the SDK performs exactly one round of tool calling. Set it to 5-15 depending on the complexity of tasks you expect.

2. **For LangChain, ensure the agent loop is configured:**

```typescript
const executor = new AgentExecutor({
  agent,
  tools,
  maxIterations: 10,
});
```

3. **Improve the system prompt** to instruct the model to complete multi-step tasks:

```typescript
system: "Complete the full task. If you need to check a balance before transferring, do both steps."
```

## Tools Array is Empty After Setup

### Symptoms

`getOnChainTools()` returns an empty array or object. The agent has no capabilities.

### Solutions

1. **Missing `await`** — `getOnChainTools()` is async:

```typescript
const tools = await getOnChainTools({
  wallet: viem(walletClient),
  plugins: [sendETH()],
});
```

2. **Plugin-chain mismatch** — Solana plugins return no tools when given an EVM wallet (and vice versa). Verify:

```typescript
import { sendETH } from "@goat-sdk/plugin-send-eth";
import { viem } from "@goat-sdk/wallet-viem";
```

3. **Empty plugin array** — ensure you pass at least one plugin:

```typescript
plugins: [sendETH()]
```

4. **Wallet not initialized** — if the wallet client creation fails silently, plugins receive a null wallet and return no tools. Add error checking:

```typescript
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.RPC_URL),
});

if (!walletClient.account) {
  throw new Error("Wallet client failed to initialize");
}
```

## Transactions Fail with "insufficient funds"

### Symptoms

Tool calls return errors like `insufficient funds for gas * price + value` or `transfer amount exceeds balance`.

### Solutions

1. **Check native token balance** — every transaction requires gas in the chain's native token (ETH for EVM, SOL for Solana):

```bash
cast balance 0xYourAddress --rpc-url https://mainnet.base.org
```

2. **Check token balance** — ERC-20 transfers fail if the token balance is too low. The agent should check balance before transferring.

3. **Account for gas costs** — do not send 100% of the balance. Leave gas margin:

```typescript
system: "When sending tokens, always leave at least 0.01 ETH for gas fees."
```

4. **Testnet first** — use Base Sepolia or Solana Devnet with faucet tokens before mainnet:

```typescript
import { faucet } from "@goat-sdk/plugin-faucet";
plugins: [faucet(), sendETH(), erc20()]
```

## Package Version Conflicts

### Symptoms

TypeScript errors like `Type 'X' is not assignable to type 'X'` where both types have the same name, or runtime errors about missing methods on wallet clients.

### Solutions

1. **Check for duplicate @goat-sdk/core:**

```bash
npm ls @goat-sdk/core
```

If multiple versions appear, deduplicate:

```bash
npm dedupe
```

2. **Pin all @goat-sdk packages to the same version range:**

```json
{
  "dependencies": {
    "@goat-sdk/core": "^0.4.0",
    "@goat-sdk/adapter-vercel-ai": "^0.4.0",
    "@goat-sdk/wallet-viem": "^0.4.0",
    "@goat-sdk/plugin-erc20": "^0.4.0"
  }
}
```

3. **Clean install:**

```bash
rm -rf node_modules package-lock.json
npm install
```

## Custom Plugin Not Registering Tools

### Symptoms

A custom plugin is passed to `getOnChainTools()` but its tools do not appear in the agent's capabilities.

### Solutions

1. **`supportsChain` returns false** — verify the chain check matches your wallet:

```typescript
supportsChain = (chain: Chain) => chain.type === "evm";
```

For chain-agnostic plugins, return `true`:

```typescript
supportsChain = (chain: Chain) => true;
```

2. **Missing tool class in constructor** — when using the `@Tool` decorator pattern, pass the tool service instance:

```typescript
export class MyPlugin extends PluginBase<WalletClientBase> {
  constructor() {
    super("myPlugin", [new MyToolService()]);
  }
}
```

3. **`getTools` override not called** — if you override `getTools()`, do not also pass tool services to `super()`. Choose one approach:

```typescript
export class MyPlugin extends PluginBase<WalletClientBase> {
  constructor() {
    super("myPlugin", []);
  }

  getTools(walletClient: WalletClientBase) {
    return [createTool(...)];
  }
}
```

4. **Factory function not called** — plugins must be invoked as functions:

```typescript
plugins: [myPlugin()]
```

## RPC Rate Limiting

### Symptoms

Intermittent errors like `429 Too Many Requests`, `rate limit exceeded`, or `ECONNRESET` after multiple agent interactions.

### Solutions

1. **Use a paid RPC endpoint** — public RPC endpoints have aggressive rate limits. Agent workloads can issue 10-50 RPC calls per prompt.

2. **Reduce plugin count** — each plugin may query the chain during initialization. Only install plugins you need:

```typescript
plugins: [sendETH(), erc20({ tokens: [USDC] })]
```

3. **Add retry logic** — wrap the agent execution:

```typescript
async function executeWithRetry(
  executor: AgentExecutor,
  input: string,
  maxRetries: number = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await executor.invoke({ input });
      return result.output;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
}
```

## Crossmint Wallet Authentication Failures

### Symptoms

`401 Unauthorized` or `403 Forbidden` when using Crossmint smart wallets.

### Solutions

1. **Verify API key** — ensure `CROSSMINT_API_KEY` is set and valid:

```bash
echo $CROSSMINT_API_KEY
```

2. **Check wallet address format** — Crossmint wallet addresses must match the chain:

```typescript
crossmint({
  apiKey: process.env.CROSSMINT_API_KEY as string,
  walletAddress: "0x...",
  chain: "base",
})
```

3. **Environment mismatch** — staging API keys do not work on production. Use the correct Crossmint environment.

## MCP Server Not Connecting

### Symptoms

MCP clients (Claude Desktop, Cursor) cannot discover GOAT tools exposed via the MCP adapter.

### Solutions

1. **Server not started** — ensure `server.listen()` is called:

```typescript
const server = await createMCPServer({
  wallet: viem(walletClient),
  plugins: [sendETH()],
});

server.listen();
```

2. **Client configuration** — add the server to your MCP client config. For Claude Desktop, edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "goat": {
      "command": "npx",
      "args": ["tsx", "/path/to/your/mcp-server.ts"]
    }
  }
}
```

3. **Async initialization** — if tools are empty, the server may have started before plugins finished loading. Ensure all `await` calls complete before `listen()`.
