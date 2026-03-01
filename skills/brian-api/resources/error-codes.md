# Brian API Error Codes and Solutions

Common errors returned by the Brian API, with root causes and fixes.

Last verified: February 2026

## Authentication Errors

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

**Cause**: Missing or invalid `x-brian-api-key` header.

**Fix**:

1. Verify the header name is exactly `x-brian-api-key` (not `Authorization: Bearer`):
   ```bash
   curl -H "x-brian-api-key: $BRIAN_API_KEY" \
     https://api.brianknows.org/api/v0/agent/transaction
   ```

2. Check the API key is not expired. Regenerate at https://brianknows.org if needed.

3. If using the SDK, ensure the key is passed correctly:
   ```typescript
   const brian = new BrianSDK({
     apiKey: process.env.BRIAN_API_KEY!,
   });
   ```

### 403 Forbidden

```json
{
  "error": "Forbidden",
  "message": "API key does not have access to this endpoint"
}
```

**Cause**: The API key's plan does not include access to the requested endpoint.

**Fix**: Upgrade your plan at https://brianknows.org or use a different endpoint.

## Rate Limiting

### 429 Too Many Requests

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

**Cause**: Exceeded the request rate for your plan.

**Fix**:

1. Check rate limit headers in the response:
   ```
   X-RateLimit-Limit: 30
   X-RateLimit-Remaining: 0
   X-RateLimit-Reset: 1709001600
   ```

2. Implement exponential backoff:
   ```typescript
   async function transactWithRetry(
     brian: BrianSDK,
     params: TransactParams,
     maxRetries = 3,
   ) {
     for (let attempt = 0; attempt < maxRetries; attempt++) {
       try {
         return await brian.transact(params);
       } catch (error: unknown) {
         if (error instanceof Error && error.message.includes("429")) {
           const delay = Math.pow(2, attempt) * 1000;
           await new Promise((r) => setTimeout(r, delay));
           continue;
         }
         throw error;
       }
     }
     throw new Error("Max retries exceeded");
   }
   ```

3. Upgrade plan for higher limits.

## Request Validation Errors

### 400 Bad Request — Missing Address

```json
{
  "error": "Bad Request",
  "message": "address is required"
}
```

**Cause**: The `address` field is missing from the request body.

**Fix**: Include a valid Ethereum address:
```typescript
const response = await brian.transact({
  prompt: "Swap 10 USDC for ETH",
  address: "0xYourChecksummedAddress",
});
```

### 400 Bad Request — Invalid Chain

```json
{
  "error": "Bad Request",
  "message": "Could not determine the chain from the prompt"
}
```

**Cause**: The prompt does not specify a chain and `chainId` is not provided. Brian cannot guess which chain when the token exists on multiple networks.

**Fix**:

Option A -- include chain in prompt:
```typescript
const response = await brian.transact({
  prompt: "Swap 10 USDC for ETH on Base",
  address: "0x...",
});
```

Option B -- pass `chainId`:
```typescript
const response = await brian.transact({
  prompt: "Swap 10 USDC for ETH",
  address: "0x...",
  chainId: "8453",
});
```

### 400 Bad Request — Unparseable Prompt

```json
{
  "error": "Bad Request",
  "message": "Could not parse the transaction intent from the prompt"
}
```

**Cause**: The prompt is too vague or does not contain a recognizable action.

**Fix**: Structure prompts with action, amount, token, and chain:
```
Good: "Swap 100 USDC for ETH on Arbitrum"
Bad:  "Do something with my tokens"
```

### 400 Bad Request — Unsupported Token

```json
{
  "error": "Bad Request",
  "message": "Token not found"
}
```

**Cause**: The token symbol is not recognized on the specified chain.

**Fix**:
1. Use standard symbols (USDC, WETH, DAI, WBTC)
2. Verify the token exists on the target chain
3. For non-standard tokens, check if Brian supports them in the token list

### 400 Bad Request — Unsupported Action on Chain

```json
{
  "error": "Bad Request",
  "message": "Action not supported on this chain"
}
```

**Cause**: DeFi actions (deposit, withdraw, borrow, repay) are only supported on Ethereum, Arbitrum, Optimism, Polygon, Base, and Avalanche.

**Fix**: Use a supported chain for DeFi actions, or limit to swap/bridge/transfer on other chains.

## Solver Errors

### 500 — No Route Found

```json
{
  "error": "Internal Server Error",
  "message": "No route found for the requested swap"
}
```

**Cause**: The solver (Enso, LI.FI, etc.) could not find a viable route for the requested transaction. Common with low-liquidity token pairs.

**Fix**:
1. Try a different token pair
2. Reduce the amount (large amounts may exceed available liquidity)
3. Try a different chain if the token is available elsewhere

### 500 — Solver Timeout

```json
{
  "error": "Internal Server Error",
  "message": "Solver request timed out"
}
```

**Cause**: The third-party solver did not respond in time.

**Fix**: Retry after a few seconds. If persistent, the solver may be experiencing downtime.

### 502 — Solver Unavailable

```json
{
  "error": "Bad Gateway",
  "message": "Upstream solver unavailable"
}
```

**Cause**: The solver service is temporarily down.

**Fix**: Retry with exponential backoff. Brian may route through an alternative solver automatically.

## SDK-Specific Errors

### "Cannot read properties of undefined"

**Cause**: The SDK received an unexpected response shape, usually from a network error or API change.

**Fix**:
1. Update the SDK: `npm install @brian-ai/sdk@latest`
2. Check network connectivity
3. Verify the API URL:
   ```typescript
   const brian = new BrianSDK({
     apiKey: process.env.BRIAN_API_KEY!,
     apiUrl: "https://api.brianknows.org",
   });
   ```

### "fetch is not defined"

**Cause**: Running in a Node.js version without native `fetch` (below Node 18).

**Fix**: Upgrade to Node.js 18+ or install a polyfill:
```bash
npm install node-fetch
```

## Transaction Execution Errors

These errors occur when executing the calldata Brian returns, not from the Brian API itself.

### Transaction Reverted

**Cause**: The on-chain transaction failed. Common reasons: insufficient balance, token approval not executed first, stale calldata (price moved).

**Fix**:
1. Execute steps in order (approval before swap)
2. Use calldata promptly; quotes are time-sensitive
3. Simulate with `eth_call` before sending
4. Check token balance covers the amount plus gas

### Insufficient Gas

**Cause**: The `gasLimit` returned by Brian was insufficient, or the wallet lacks native token for gas.

**Fix**:
1. Add a gas buffer:
   ```typescript
   const gasWithBuffer = step.gasLimit
     ? (BigInt(step.gasLimit) * 120n) / 100n
     : undefined;
   ```
2. Ensure the wallet has enough ETH/MATIC/etc. for gas fees
