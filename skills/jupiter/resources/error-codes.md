# Jupiter API Error Codes

Common errors returned by the Jupiter API and how to resolve them.

Last verified: 2026-02-26

## HTTP Status Codes

| Status | Meaning | Common Cause |
|--------|---------|--------------|
| 400 | Bad Request | Invalid parameters, malformed request body |
| 401 | Unauthorized | Missing or invalid `x-api-key` header |
| 404 | Not Found | Invalid endpoint or unknown order ID |
| 429 | Too Many Requests | Rate limit exceeded for your API key tier |
| 500 | Internal Server Error | Jupiter backend issue; retry with backoff |
| 503 | Service Unavailable | Maintenance or overload; retry later |

## Quote Errors

### `NO_ROUTE_FOUND`

No viable swap route exists between the two tokens.

**Causes:**
- Token has no liquidity pools
- Amount is too large for available liquidity
- Token mint address is incorrect

**Fixes:**
- Verify both mint addresses are correct
- Try a smaller amount
- Check if the token is listed: `GET /tokens/v1/token/{mint}`

### `AMOUNT_TOO_SMALL`

Input amount is below the minimum for any available route.

**Fix:** Increase the input amount. Most routes require at least a few hundred lamports equivalent.

### `INVALID_MINT`

One of the provided mint addresses is not a valid Solana token mint.

**Fix:** Verify the mint address is a valid SPL token. Use `GET /tokens/v1/token/{mint}` to check.

## Swap Errors

### `QUOTE_EXPIRED`

The quote passed to `/swap/v1/swap` has expired.

**Fix:** Quotes have a ~30 second TTL. Fetch a new quote and submit the swap immediately.

### `SLIPPAGE_EXCEEDED`

The actual price moved beyond your slippage tolerance between quote and execution.

**Fixes:**
- Increase `slippageBps` (e.g., from 50 to 100)
- Use `dynamicSlippage: true` to let Jupiter auto-adjust
- For volatile tokens, use higher slippage or smaller amounts

### `INSUFFICIENT_BALANCE`

The wallet does not have enough of the input token.

**Fix:** Check your token balance before requesting a swap. Remember that SOL swaps also need SOL for rent and transaction fees.

### `SIMULATION_FAILED`

Transaction simulation failed before submission.

**Common causes:**
- Stale blockhash (waited too long before signing)
- Account state changed between quote and execution
- Insufficient compute units

**Fixes:**
- Use `dynamicComputeUnitLimit: true`
- Execute the swap faster after getting the quote
- Retry with a fresh quote

## Transaction Errors

### `BlockhashNotFound`

The transaction's recent blockhash expired before it was processed.

**Fix:** Fetch a new quote and swap transaction. Do not reuse stale transactions.

### `InstructionError: Custom(6001)` (or similar custom errors)

Program-level error from one of the DEXes in the route.

**Common causes:**
- Pool state changed (price moved, liquidity removed)
- Slippage check failed on-chain

**Fix:** Retry with a fresh quote. If persistent, try `onlyDirectRoutes: true` to simplify the route.

### `TransactionTooLarge`

The transaction exceeds Solana's 1232-byte limit.

**Fixes:**
- Set `maxAccounts` to a lower value (e.g., 40) in the quote request
- Use `onlyDirectRoutes: true` to reduce route complexity
- Use `/swap/v1/swap-instructions` and build the transaction yourself with address lookup tables

## Ultra API Errors

### `ORDER_EXPIRED`

The Ultra order was not signed and submitted before its expiry time.

**Fix:** Sign and submit immediately after creating the order. Check the `expiresAt` field.

### `ORDER_FAILED`

Jupiter was unable to execute the order on-chain.

**Possible causes:**
- Market conditions changed significantly
- Insufficient liquidity at the quoted price

**Fix:** Create a new order and try again.

## Rate Limiting

When you receive a 429 response:

1. Check the `Retry-After` header for wait duration
2. Implement exponential backoff: wait 1s, 2s, 4s, etc.
3. Reduce request frequency
4. Upgrade your API key tier at [portal.jup.ag](https://portal.jup.ag) if you consistently hit limits

## Debugging Tips

- Always log the full response body on non-200 responses
- Include the `requestId` from error responses when contacting support
- Test with small amounts first before scaling up
- Use Jupiter's `/swap/v1/swap-instructions` endpoint to inspect individual instructions when debugging complex failures
