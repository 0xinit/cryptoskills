# GOAT Error Codes and Solutions

Common errors encountered when using GOAT SDK, with root causes and fixes.

Last verified: February 2026

## Installation Errors

### "Cannot find module '@goat-sdk/core'"

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@goat-sdk/core'
```

**Cause**: Core package not installed or wrong package manager resolution.

**Fix**:

```bash
npm install @goat-sdk/core
```

If using a monorepo, ensure the package is hoisted or install in the correct workspace.

### "Cannot find module '@goat-sdk/adapter-vercel-ai'"

**Cause**: Adapter not installed. GOAT requires separate adapter packages per framework.

**Fix**:

```bash
npm install @goat-sdk/adapter-vercel-ai
```

### Version mismatch between @goat-sdk packages

```
Type 'WalletClientBase' is not assignable to type 'WalletClientBase'.
```

**Cause**: Multiple versions of `@goat-sdk/core` in your dependency tree. Adapters and plugins must share the same core version.

**Fix**:

```bash
npm ls @goat-sdk/core
npm dedupe
```

If that fails, pin all `@goat-sdk/*` packages to the same version in `package.json`.

## Runtime Errors

### "getOnChainTools is not a function"

```
TypeError: getOnChainTools is not a function
```

**Cause**: Importing from the wrong package. Each adapter has its own `getOnChainTools`.

**Fix**: Import from the correct adapter:

```typescript
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { getOnChainTools } from "@goat-sdk/adapter-langchain";
```

### "wallet.getAddress is not a function"

**Cause**: Passing a raw viem wallet client instead of wrapping it with the `viem()` factory.

**Fix**:

```typescript
import { viem } from "@goat-sdk/wallet-viem";

const tools = await getOnChainTools({
  wallet: viem(walletClient),
  plugins: [...],
});
```

### "No tools returned" (empty tools array)

**Cause 1**: Plugin does not support the wallet's chain type. An EVM plugin with a Solana wallet returns no tools.

**Fix**: Match plugins to wallet types. Check `supported-chains.md` for plugin chain compatibility.

**Cause 2**: Missing `await` on `getOnChainTools()`.

**Fix**:

```typescript
const tools = await getOnChainTools({ ... });
```

### "Cannot read properties of undefined (reading 'getAddress')"

**Cause**: Wallet client not properly initialized. Usually a missing private key or RPC URL.

**Fix**: Verify environment variables are set:

```typescript
if (!process.env.WALLET_PRIVATE_KEY) {
  throw new Error("WALLET_PRIVATE_KEY not set");
}
if (!process.env.RPC_URL) {
  throw new Error("RPC_URL not set");
}
```

## Transaction Errors

### "insufficient funds for gas"

```
Error: insufficient funds for gas * price + value
```

**Cause**: Wallet does not have enough native token (ETH, SOL, etc.) to pay gas.

**Fix**: Fund the wallet with native tokens on the target chain. For testing, use a faucet:

```typescript
import { faucet } from "@goat-sdk/plugin-faucet";

const tools = await getOnChainTools({
  wallet: viem(walletClient),
  plugins: [faucet()],
});
```

### "execution reverted"

```
Error: execution reverted: ERC20: transfer amount exceeds balance
```

**Cause**: The smart contract call reverted. Common reasons: insufficient token balance, missing approval, or wrong function parameters.

**Fix**: The agent should check balances before transfers. Ensure ERC-20 approvals are set before swap operations. Most DeFi plugins handle approvals automatically.

### "nonce too low"

```
Error: nonce too low
```

**Cause**: A pending transaction was replaced or the nonce counter is stale. Common when submitting multiple transactions quickly.

**Fix**: Wait for pending transactions to confirm before sending the next one. If stuck, use a nonce manager or reset the nonce:

```typescript
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.RPC_URL),
});
```

viem automatically manages nonces, but rapid sequential calls can still race.

### "user rejected transaction"

**Cause**: When using browser wallets or custodial providers, the signer rejected the transaction.

**Fix**: This is expected behavior for wallets requiring user approval. For server-side agents using key pairs, this should not occur.

## Plugin-Specific Errors

### "Plugin 'uniswap' does not support chain"

**Cause**: Uniswap plugin does not support the wallet's chain. For example, Uniswap V3 is not deployed on all EVM chains.

**Fix**: Check the plugin's supported chains. Use a chain where the protocol is deployed.

### "Rate limit exceeded" (CoinGecko, DexScreener)

**Cause**: Market data plugins hit API rate limits, especially on free tiers.

**Fix**: Add API keys where supported, or implement caching:

```typescript
import { coingecko } from "@goat-sdk/plugin-coingecko";

const tools = await getOnChainTools({
  wallet: viem(walletClient),
  plugins: [coingecko({ apiKey: process.env.COINGECKO_API_KEY })],
});
```

### "Invalid token address"

**Cause**: Token contract address is incorrect for the current chain. USDC has different addresses on each chain.

**Fix**: Use the correct chain-specific address in token configs:

```typescript
const USDC = {
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  chains: {
    1: { contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    8453: { contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  },
};
```

## TypeScript Errors

### "Type 'EVMWalletClient' is not assignable to type 'WalletClientBase'"

**Cause**: Plugin generics mismatch. EVM-specific plugins expect `EVMWalletClient`, not the base type.

**Fix**: Ensure your plugin extends `PluginBase` with the correct generic:

```typescript
export class MyPlugin extends PluginBase<EVMWalletClient> { ... }
```

### "Property 'read' does not exist on type 'WalletClientBase'"

**Cause**: Using chain-specific wallet methods on the base class. `read()` is only available on `EVMWalletClient`.

**Fix**: Narrow the wallet type in your plugin:

```typescript
export class MyPlugin extends PluginBase<EVMWalletClient> {
  supportsChain = (chain: Chain) => chain.type === "evm";

  getTools(walletClient: EVMWalletClient) {
    // walletClient.read() is now available
  }
}
```

### "Argument of type 'z.ZodObject<...>' is not assignable"

**Cause**: Zod version mismatch between your project and `@goat-sdk/core`.

**Fix**: Align Zod versions:

```bash
npm ls zod
npm install zod@3.23
```

## MCP Adapter Errors

### "MCP server failed to start"

**Cause**: Port conflict or missing wallet configuration.

**Fix**: Ensure no other process uses the MCP port, and verify wallet initialization completes before calling `server.listen()`.

### "Tool not found" in MCP client

**Cause**: The MCP client connected before tools were registered, or plugin returned no tools for the wallet's chain.

**Fix**: Ensure `await` is used when setting up tools, and verify plugin-chain compatibility.
