# AgentKit Error Reference

Common errors encountered when using `@coinbase/agentkit` and the CDP API.

Last verified: February 2026

## CDP API Errors

### Authentication Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid API key` | `CDP_API_KEY_ID` is incorrect or revoked | Verify key at https://portal.cdp.coinbase.com. Generate a new key if revoked. |
| `Invalid API key secret` | `CDP_API_KEY_SECRET` is wrong or truncated | Re-copy the full secret. Secrets contain special characters — ensure no trailing whitespace. |
| `API key not found` | Key was deleted from the CDP portal | Create a new API key in the portal. |
| `Unauthorized` | Key lacks permission for the requested action | Check key scoping in CDP portal. Some actions require specific permissions. |

### Rate Limiting

| Error | Cause | Fix |
|-------|-------|-----|
| `Rate limit exceeded` | Too many API calls in a short period | Implement exponential backoff. Default limits: 100 requests/minute for wallet operations. |
| `429 Too Many Requests` | HTTP-level rate limiting from CDP API | Wait and retry. Consider batching operations or reducing polling frequency. |

### Network Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Network not supported` | Requested `networkId` is not available for this wallet provider | Check supported networks in the provider docs. Use `base-sepolia` for testing. |
| `Failed to connect to network` | RPC endpoint is unreachable | Verify network connectivity. For custom RPCs, check the URL is correct and the service is running. |
| `Chain ID mismatch` | Wallet was created on a different network than the action targets | Create a new wallet for the target network or use a provider that supports network switching. |

## Wallet Provider Errors

### CdpEvmWalletProvider

| Error | Cause | Fix |
|-------|-------|-----|
| `Wallet not found` | The wallet ID in persisted data no longer exists on CDP | Create a new wallet. Old wallet data becomes invalid if the CDP project is deleted. |
| `Invalid wallet data` | Corrupted or malformed wallet export JSON | Delete the wallet data file and let the provider create a fresh wallet. |
| `Insufficient funds` | Wallet does not have enough native token for gas + value | Fund the wallet. On testnet, use `cdpApiActionProvider.requestFaucet`. |

### ViemWalletProvider

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid private key` | Key is not a valid 32-byte hex string | Ensure the key starts with `0x` and is 66 characters total. |
| `Nonce too low` | Transaction with this nonce was already mined | Wait for pending transactions to confirm, or manually specify a higher nonce. |
| `Replacement transaction underpriced` | Trying to replace a pending tx with insufficient gas price | Increase `maxFeePerGas` and `maxPriorityFeePerGas` by at least 10%. |

### CdpSmartWalletProvider

| Error | Cause | Fix |
|-------|-------|-----|
| `Smart wallet deployment failed` | First transaction failed during wallet contract creation | Ensure the signer has enough ETH for the deployment gas, or use a paymaster. |
| `Paymaster rejected` | Paymaster URL is invalid or the paymaster declined to sponsor | Verify the paymaster URL. Check if the paymaster has a balance and supports the target network. |
| `UserOperation reverted` | The bundled transaction reverted onchain | Check the inner transaction's revert reason. Common cause: insufficient token balance or approval. |

## Action Provider Errors

### Token Operations

| Error | Cause | Fix |
|-------|-------|-----|
| `ERC20: transfer amount exceeds balance` | Attempting to send more tokens than owned | Check balance with `erc20ActionProvider.getBalance` before transferring. |
| `ERC20: insufficient allowance` | Spender not approved for the transfer amount | Call `erc20ActionProvider.approve` before `transferFrom` operations. |
| `Address has an invalid EIP-55 checksum` | Mixed-case address with wrong checksum | Use `getAddress()` from viem to normalize the address to proper checksum format. |

### Swap Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `No route found` | CDP swap API cannot find a trading route for the pair | Verify both token addresses are correct. Some pairs have no liquidity on the target network. |
| `Slippage tolerance exceeded` | Price moved beyond acceptable range during execution | Retry the swap. For volatile pairs, consider increasing slippage tolerance in a custom action wrapper. |
| `Trade amount too small` | Swap amount is below the minimum for the routing engine | Increase the trade amount. Minimum varies by pair and network. |

### Faucet Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Faucet request failed` | Daily limit reached or faucet is temporarily unavailable | Wait 24 hours. Each wallet address has a daily limit on testnet faucets. |
| `Faucet not available on this network` | Requesting faucet on mainnet or unsupported testnet | Faucet is only available on `base-sepolia` and `ethereum-sepolia`. |

## Framework Integration Errors

### LangChain

| Error | Cause | Fix |
|-------|-------|-----|
| `Tool input validation failed` | LLM generated invalid arguments for an AgentKit tool | Improve the system prompt with examples of valid inputs. Lower the model temperature. |
| `Maximum iterations reached` | Agent is stuck in a loop calling tools repeatedly | Increase `maxIterations` or improve the system prompt. Check if the tool is returning an error the LLM cannot interpret. |
| `Cannot read properties of undefined (reading 'invoke')` | LangGraph agent not properly initialized | Ensure `createReactAgent` receives both `llm` and `tools` parameters. |

### Vercel AI SDK

| Error | Cause | Fix |
|-------|-------|-----|
| `maxSteps exceeded` | Agent hit the step limit without completing | Increase `maxSteps` in `generateText` options. Default is low for complex multi-tool tasks. |
| `Tool not found` | Tool name mismatch between AgentKit and the SDK | Ensure `getVercelAITools(agentKit)` is called after all action providers are registered. |

## Runtime Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `emitDecoratorMetadata is not enabled` | Custom actions using `@CreateAction` without TypeScript decorator support | Add `"emitDecoratorMetadata": true` and `"experimentalDecorators": true` to `tsconfig.json`. |
| `Cannot find module '@coinbase/agentkit'` | Package not installed or wrong Node.js version | Run `npm install @coinbase/agentkit`. Requires Node.js v22+. |
| `Unexpected token 'export'` | Running TypeScript file without a loader | Use `npx tsx` instead of `node`, or compile with `tsc` first. |

## Debugging Tips

1. Enable verbose logging:
   ```typescript
   process.env.DEBUG = "agentkit:*";
   ```

2. Log tool calls in LangChain:
   ```typescript
   const stream = agent.streamEvents(
     { messages: [new HumanMessage(input)] },
     { version: "v2", configurable: { thread_id: "debug" } }
   );

   for await (const event of stream) {
     if (event.event === "on_tool_start") {
       console.log("Tool:", event.name, "Input:", event.data.input);
     }
     if (event.event === "on_tool_end") {
       console.log("Tool result:", event.data.output);
     }
   }
   ```

3. Test actions directly without an LLM:
   ```typescript
   const agentKit = await AgentKit.from({ walletProvider: wallet });
   const actions = agentKit.getActions();
   for (const action of actions) {
     console.log(action.name, action.description);
   }
   ```
