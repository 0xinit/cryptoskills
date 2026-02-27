# Brian API Troubleshooting

Common issues and fixes when integrating the Brian API.

Last verified: February 2026

## API Key Not Working

### Symptoms

- 401 Unauthorized on every request
- "Invalid API key" error message
- SDK throws authentication errors

### Solutions

1. Verify the header name is `x-brian-api-key`, not `Authorization`:

   ```bash
   # Correct
   curl -H "x-brian-api-key: $BRIAN_API_KEY" \
     -H "Content-Type: application/json" \
     -X POST https://api.brianknows.org/api/v0/agent/transaction \
     -d '{"prompt": "test", "address": "0x0000000000000000000000000000000000000001"}'

   # Wrong — will always return 401
   curl -H "Authorization: Bearer $BRIAN_API_KEY" ...
   ```

2. Check the environment variable is set:

   ```bash
   echo $BRIAN_API_KEY
   ```

3. Ensure no extra whitespace or newline in the key:

   ```typescript
   const brian = new BrianSDK({
     apiKey: process.env.BRIAN_API_KEY!.trim(),
   });
   ```

4. Regenerate the key at https://brianknows.org if it was compromised or expired.

## Brian Returns Empty Results

### Symptoms

- `response.length === 0` or `response` is an empty array
- No error thrown, but no transaction data returned

### Solutions

1. Improve the prompt. Brian needs: action, amount, token, and chain:

   ```typescript
   // Too vague — may return empty
   await brian.transact({
     prompt: "swap tokens",
     address: "0x...",
   });

   // Specific — returns results
   await brian.transact({
     prompt: "Swap 10 USDC for ETH on Base",
     address: "0x...",
     chainId: "8453",
   });
   ```

2. Check token support. Obscure tokens may not be in Brian's token list.

3. Verify the chain supports the requested action. DeFi actions only work on Tier 1 chains (Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche).

4. Check if the amount exceeds available liquidity for that pair.

## Transaction Reverts After Executing Brian's Calldata

### Symptoms

- `receipt.status` is `"reverted"` or `0`
- On-chain transaction fails after Brian returned valid-looking calldata

### Solutions

1. Execute steps in the correct order. Step 0 (approval) must confirm before step 1 (swap):

   ```typescript
   for (const step of result.data.steps) {
     const hash = await walletClient.sendTransaction({ ... });
     const receipt = await publicClient.waitForTransactionReceipt({ hash });
     if (receipt.status !== "success") {
       throw new Error(`Step failed: ${hash}`);
     }
   }
   ```

2. Calldata is time-sensitive. Swap quotes expire as prices move. Execute within 60 seconds of receiving the response.

3. Verify sufficient token balance. The wallet must hold the `fromAmount` plus gas fees.

4. Simulate before sending on mainnet:

   ```typescript
   await publicClient.call({
     to: step.to as `0x${string}`,
     data: step.data as `0x${string}`,
     value: BigInt(step.value),
     account: account.address,
   });
   ```

5. For approval steps, check if an existing allowance conflicts. Some tokens (USDT) require resetting allowance to 0 before setting a new value.

## Chain Not Detected from Prompt

### Symptoms

- Error: "Could not determine the chain from the prompt"
- API returns 400 Bad Request

### Solutions

1. Include the chain name explicitly in the prompt:

   ```
   "Swap 10 USDC for ETH on Base"
   "Bridge 0.5 ETH from Ethereum to Arbitrum"
   ```

2. Pass `chainId` in the request body as a fallback:

   ```typescript
   await brian.transact({
     prompt: "Swap 10 USDC for ETH",
     address: "0x...",
     chainId: "8453",
   });
   ```

3. For cross-chain operations, specify both source and destination:

   ```
   "Bridge 100 USDC from Ethereum to Base"
   ```

## Rate Limiting

### Symptoms

- 429 Too Many Requests
- Intermittent failures under load

### Solutions

1. Check your plan's rate limits (Free: 30/min, Pro: 120/min).

2. Read rate limit headers from every response:

   ```typescript
   // If using raw fetch
   const remaining = response.headers.get("X-RateLimit-Remaining");
   if (parseInt(remaining || "0") < 5) {
     console.warn("Approaching rate limit");
   }
   ```

3. Implement retry with exponential backoff:

   ```typescript
   async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (err: unknown) {
         if (err instanceof Error && err.message.includes("429") && i < maxRetries - 1) {
           await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
           continue;
         }
         throw err;
       }
     }
     throw new Error("Unreachable");
   }
   ```

4. Cache identical requests. If multiple users request the same swap route, cache the response (invalidate after 30-60 seconds).

## SDK Version Mismatch

### Symptoms

- TypeScript type errors after updating
- Methods that existed before are now missing
- Response shapes don't match documentation

### Solutions

1. Update to the latest SDK:

   ```bash
   npm install @brian-ai/sdk@latest
   ```

2. Check the changelog for breaking changes:

   ```bash
   npm info @brian-ai/sdk versions --json | tail -5
   ```

3. If using LangChain integration, update both packages together:

   ```bash
   npm install @brian-ai/sdk@latest @brian-ai/langchain@latest
   ```

4. Clear `node_modules` and reinstall if types are stale:

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## LangChain Agent Not Executing Transactions

### Symptoms

- Agent responds with text but does not execute on-chain
- Tools are available but not being invoked by the LLM

### Solutions

1. Verify the private key is passed correctly:

   ```typescript
   const agent = await createBrianAgent({
     apiKey: process.env.BRIAN_API_KEY!,
     privateKeyOrAccount: process.env.PRIVATE_KEY as `0x${string}`,
     llm: new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 }),
   });
   ```

2. Use `temperature: 0` for the LLM. Higher temperatures cause the model to "hallucinate" responses instead of using tools.

3. Set `verbose: true` on the AgentExecutor to see tool invocations:

   ```typescript
   const executor = new AgentExecutor({
     agent,
     tools,
     verbose: true,
   });
   ```

4. Check that the prompt clearly asks for a transaction, not just information:

   ```
   Good: "Swap 10 USDC for ETH on Base"
   Bad:  "What would happen if I swapped USDC for ETH?"
   ```

## US vs EU API Latency

### Symptoms

- API calls take 3-5+ seconds
- Timeouts on transaction endpoint

### Solutions

1. Use the regional endpoint closest to your server:

   ```typescript
   // EU (default)
   const brian = new BrianSDK({
     apiKey: process.env.BRIAN_API_KEY!,
     apiUrl: "https://api.brianknows.org",
   });

   // US
   const brian = new BrianSDK({
     apiKey: process.env.BRIAN_API_KEY!,
     apiUrl: "https://us-api.brianknows.org",
   });
   ```

2. Set appropriate timeouts:

   ```typescript
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 30_000);

   try {
     const response = await brian.transact({
       prompt: "Swap 10 USDC for ETH on Base",
       address: "0x...",
     });
   } finally {
     clearTimeout(timeout);
   }
   ```

3. The transaction endpoint is slower than knowledge because it calls external solvers. Expect 1-5 seconds for transaction, <1 second for knowledge.
