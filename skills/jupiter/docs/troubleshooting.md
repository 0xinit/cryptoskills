# Jupiter Troubleshooting Guide

Common issues when integrating with the Jupiter API and how to resolve them.

## "No route found" for a valid token pair

**Symptom:** `/swap/v1/quote` returns `NO_ROUTE_FOUND` even though both tokens exist.

**Diagnosis:**
1. Verify both mint addresses are correct (check via `/tokens/v1/token/{mint}`)
2. Check if the amount is reasonable for available liquidity
3. Test with a very small amount first

**Solutions:**
- Reduce the swap amount -- the pool may not have enough liquidity
- Remove `onlyDirectRoutes: true` to allow multi-hop routing
- Remove `restrictIntermediateTokens: true` to open more route paths
- For new or low-liquidity tokens, routes may not be available

## Transaction fails with "Blockhash not found"

**Symptom:** Transaction is rejected with `BlockhashNotFound` after signing.

**Root cause:** Solana blockhashes expire after ~60 seconds. If you wait too long between getting the swap transaction and submitting it, the blockhash becomes invalid.

**Solutions:**
- Execute the full flow (quote -> swap -> sign -> send) as fast as possible
- Do not cache or reuse swap transactions
- If your flow has user confirmation steps, fetch the quote early but request the swap transaction only after confirmation

## Swap succeeds on-chain but output amount is less than expected

**Symptom:** Transaction confirms but you receive fewer tokens than the quote indicated.

**Root cause:** Price moved between quote and execution (slippage).

**Solutions:**
- Use `dynamicSlippage: true` in the swap request for Jupiter's auto-optimization
- Set a tighter `slippageBps` to reject swaps that move too far (but too tight causes failures)
- For large swaps, split into multiple smaller swaps or use DCA
- The `otherAmountThreshold` field in the quote shows the minimum you will receive

## 429 Too Many Requests

**Symptom:** API returns HTTP 429 consistently.

**Solutions:**
- Implement exponential backoff: 1s, 2s, 4s between retries
- Cache quotes when possible (but respect their ~30s TTL)
- Batch price lookups: `/price/v2` accepts multiple token IDs in a single request
- Upgrade your API key tier at [portal.jup.ag](https://portal.jup.ag)
- Avoid polling in tight loops -- use reasonable intervals (2-5 seconds)

## "Simulation failed" when getting swap transaction

**Symptom:** `/swap/v1/swap` returns a simulation failure.

**Common causes:**
- Insufficient balance for the input token
- Insufficient SOL for transaction fees and rent
- Account state changed between quote and swap request
- Compute unit budget exceeded

**Solutions:**
- Verify token balance before requesting a swap
- Ensure the wallet has at least 0.01 SOL for fees
- Use `dynamicComputeUnitLimit: true` to auto-size compute budget
- Reduce the amount or simplify the route with `maxAccounts`

## Transaction too large (exceeds 1232 bytes)

**Symptom:** Serialized transaction exceeds Solana's size limit.

**Root cause:** Complex multi-hop routes with many accounts exceed the transaction size limit.

**Solutions:**
- Set `maxAccounts` in the quote request (try 40-50)
- Use `onlyDirectRoutes: true` for simpler routes
- Use `/swap/v1/swap-instructions` to get individual instructions and build the transaction yourself with address lookup tables (ALTs)

## Ultra order stuck in "pending"

**Symptom:** Ultra order status remains "pending" for more than 60 seconds.

**Diagnosis:**
- Poll `/ultra/v1/order/{requestId}` every 2-3 seconds
- Check if the order has expired (`expiresAt` field)

**Solutions:**
- If expired, create a new order
- If still pending after 60 seconds, the order may have failed silently -- create a new one
- Ensure you signed the correct transaction (the one returned from `/ultra/v1/order`)

## Limit order never fills

**Symptom:** Limit order stays open indefinitely without filling.

**Diagnosis:**
- Check if the target price was ever reached using `/price/v2`
- Verify the order is still active via `/trigger/v1/orders/{publicKey}`

**Solutions:**
- Review your price calculation -- confirm `makingAmount` and `takingAmount` reflect the correct price
- Account for decimal differences between tokens
- Set a wider price target to test if the order fills at all
- Add an expiry (`expiredAt`) to prevent stale orders from accumulating

## DCA not executing cycles

**Symptom:** DCA position exists but cycles are not executing on schedule.

**Common causes:**
- Insufficient SOL in wallet for cycle transaction fees
- Very short cycle frequency (< 60 seconds) may miss slots
- Market conditions prevent execution at acceptable slippage

**Solutions:**
- Ensure wallet maintains a small SOL balance for fees
- Use cycle frequencies of 60 seconds or longer
- Check `nextCycleAt` on the order to confirm when the next execution is scheduled

## API key issues

**Symptom:** 401 Unauthorized on all requests.

**Checklist:**
1. Confirm the `x-api-key` header is included in every request
2. Verify the key is active at [portal.jup.ag](https://portal.jup.ag)
3. Check that the key is not expired or revoked
4. Ensure no extra whitespace in the key value

## General debugging checklist

1. Log full request URL, headers (redact API key), and body
2. Log full response status, headers, and body on errors
3. Test with known-good token pairs first (SOL/USDC)
4. Test with small amounts before scaling up
5. Use Solana Explorer or Solscan to inspect failed transactions
6. Check Jupiter status page for API outages
