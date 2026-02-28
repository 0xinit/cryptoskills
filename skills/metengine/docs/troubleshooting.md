# MetEngine Troubleshooting

## Payment Issues

### "PAYMENT_REQUIRED" on every request

The endpoint is paid. This is expected behavior, not an error. The x402 flow is:

1. Send initial request -- receive 402 with payment details
2. Sign and send USDC transfer on Solana Mainnet
3. Wait for "confirmed" commitment
4. Retry with `X-Payment-Proof: <signature>` header

Free endpoints that skip this flow: `GET /health` and `GET /api/v1/pricing`.

### "PAYMENT_EXPIRED" after paying

Payment proofs expire 5 minutes after the Solana transaction confirms. Common causes:

- **Slow confirmation**: Your transaction took too long to confirm. Use `"confirmed"` commitment level, not `"finalized"`.
- **Delayed retry**: You waited too long between payment and retrying the API call. Retry immediately after confirmation.
- **Clock skew**: Rare, but if your system clock is significantly off, expiry calculations may differ from the server.

Fix: Make a new payment and retry immediately after confirmation.

### "PAYMENT_INSUFFICIENT" even though I sent USDC

The required amount comes from the 402 response body. Common causes:

- **Stale pricing**: You hardcoded a price instead of reading from the 402 response. Always use the `amount` field from the 402 JSON body.
- **Rounding**: USDC has 6 decimals. Convert `amount` (float) to smallest unit: `BigInt(Math.round(amount * 1_000_000))`. Floating point multiplication can lose precision -- `Math.round` prevents sending 0.049999 instead of 0.050000.
- **Wrong decimal conversion**: The `amount` field is in USDC (not lamports, not micro-USDC). Multiply by 1,000,000 for the SPL token transfer.

### "PAYMENT_ALREADY_USED" on retry

Each payment proof (Solana transaction signature) is single-use. You cannot reuse a signature for multiple API calls. Each request to a paid endpoint requires its own payment.

### "PAYMENT_WRONG_TOKEN"

You sent SOL or a different SPL token. MetEngine requires USDC on Solana Mainnet:

- Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Use `createTransferInstruction` from `@solana/spl-token` (not `SystemProgram.transfer`)

### "PAYMENT_UNCONFIRMED"

The Solana transaction has not reached "confirmed" commitment when you sent the proof. Fix:

```typescript
const signature = await connection.sendRawTransaction(transaction.serialize());
await connection.confirmTransaction(signature, "confirmed");
// Only THEN retry with the proof
```

Do not send the proof before `confirmTransaction` resolves.

## Data Issues

### "WALLET_NOT_FOUND" for a valid address

The address exists on-chain but has no activity on the requested platform. MetEngine only indexes wallets that have interacted with Polymarket, Hyperliquid, or Meteora.

- Verify the wallet has actual activity on the platform you are querying
- An Ethereum address queried against Meteora (Solana) endpoints will always 404

### "INSUFFICIENT_DATA" for a scored wallet

The wallet has some activity but not enough for a reliable score. MetEngine requires a minimum transaction count before generating scores. Try again after the wallet has more history.

### "MARKET_NOT_FOUND" for a Polymarket conditionId

- Verify the conditionId on the Polymarket API or UI
- Delisted or resolved markets may be removed from the index after a period
- Format is a hex string (e.g., `0x1234...abcd`) -- do not URL-encode it

### "POOL_NOT_FOUND" for a Meteora pool address

- Verify the pool address on Meteora's UI or Solana explorer
- Closed or migrated pools may not be indexed
- Use the pool address (base58 Solana address), not the token mint

## Network Issues

### Request timeouts

MetEngine aggregates data from multiple upstream sources. Timeouts can occur when:

- Polymarket/Hyperliquid/Meteora APIs are slow
- The requested wallet has extensive history requiring heavy computation

Fix: Retry with a timeout of 30 seconds. If persistent, check `GET /health` for upstream status.

### Solana RPC failures during payment

Your Solana RPC endpoint may be rate-limited or down. Mitigations:

- Use a dedicated RPC provider (Helius, Triton, QuickNode) instead of `api.mainnet-beta.solana.com`
- Implement retry logic for `sendRawTransaction` and `confirmTransaction`
- Check RPC health before starting a batch of paid calls

### CORS errors in browser

MetEngine does not support browser-originated requests due to the Solana signing requirement. Run your MetEngine client server-side (Node.js, Deno, Bun) and expose results through your own API.

## Common Mistakes

### Using `SystemProgram.transfer` instead of SPL token transfer

`SystemProgram.transfer` sends SOL, not USDC. Use `createTransferInstruction` from `@solana/spl-token`:

```typescript
import { createTransferInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const ix = createTransferInstruction(
  payerAta,       // source (your USDC associated token account)
  recipientAta,   // destination (from 402 response)
  payer.publicKey, // owner
  amountInSmallestUnit,
  [],
  TOKEN_PROGRAM_ID
);
```

### Hardcoding payment amounts

Prices can change. Always read the `amount` from the 402 response body rather than hardcoding.

### Sending proof in the request body

The proof goes in a header, not the body:

```typescript
const response = await fetch(url, {
  headers: { "X-Payment-Proof": signature },
});
```

### Batching proofs

One proof per request. You cannot pay once and make multiple API calls. Each endpoint call requires its own payment transaction.

### Using devnet USDC

MetEngine requires mainnet USDC. Devnet tokens will result in `PAYMENT_INVALID`.

## Getting Help

1. Check `GET /health` for API and upstream status
2. Check `GET /api/v1/pricing` for current endpoint prices
3. Verify your Solana transaction on a block explorer before assuming payment failed
4. Review the error codes reference for all documented error types
