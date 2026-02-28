# MetEngine Error Codes

Base URL: `https://agent.metengine.xyz`

## HTTP Status Codes

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| 200 | Success | Parse JSON response body |
| 400 | Bad Request | Check path parameters and query format |
| 402 | Payment Required | Complete x402 payment flow, retry with proof |
| 404 | Not Found | Verify wallet address, conditionId, or pool address exists |
| 408 | Request Timeout | Retry after brief delay |
| 422 | Unprocessable Entity | Valid format but data not available (e.g., wallet has no history) |
| 429 | Rate Limited | Free endpoints only -- wait and retry |
| 500 | Internal Server Error | Retry; if persistent, check /health |
| 502 | Bad Gateway | Upstream data source unavailable; retry later |
| 503 | Service Unavailable | API is down for maintenance; check /health |

## Error Response Format

All error responses return JSON:

```json
{
  "error": "PAYMENT_EXPIRED",
  "message": "Payment proof has expired. Proofs are valid for 5 minutes after transaction confirmation."
}
```

## x402 Payment Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| `PAYMENT_REQUIRED` | Payment required to access this endpoint | First request to paid endpoint | Complete payment flow |
| `PAYMENT_EXPIRED` | Payment proof has expired | Proof older than 5 minutes | Make new payment and retry |
| `PAYMENT_INVALID` | Payment proof is not a valid transaction | Signature doesn't match a real tx | Verify transaction was confirmed on-chain |
| `PAYMENT_INSUFFICIENT` | Payment amount is less than required | Sent less USDC than endpoint price | Check /api/v1/pricing for correct amount |
| `PAYMENT_WRONG_RECIPIENT` | Payment sent to wrong address | USDC transfer to wrong wallet | Use recipient from 402 response body |
| `PAYMENT_WRONG_TOKEN` | Payment must be USDC | Sent SOL or another SPL token | Transfer USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v) |
| `PAYMENT_ALREADY_USED` | This payment proof was already consumed | Reusing a signature | Each proof is single-use; make new payment |
| `PAYMENT_UNCONFIRMED` | Transaction not yet confirmed on-chain | Sent proof before tx confirmed | Wait for "confirmed" commitment level |

## Data Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| `WALLET_NOT_FOUND` | No data available for this wallet | Address has no activity on platform | Verify address and platform |
| `MARKET_NOT_FOUND` | Market conditionId not recognized | Invalid or delisted Polymarket market | Check conditionId on Polymarket |
| `POOL_NOT_FOUND` | Pool address not recognized | Invalid or closed Meteora pool | Verify pool address on Meteora |
| `INSUFFICIENT_DATA` | Not enough data to generate score | Wallet has too few transactions | Wallet needs more activity for scoring |
| `PLATFORM_UNAVAILABLE` | Upstream data source temporarily unavailable | Polymarket/Hyperliquid/Meteora API down | Retry later; affects specific platform only |

## Rate Limit Errors (Free Endpoints Only)

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| `RATE_LIMITED` | Too many requests | Exceeded 60 req/min on free endpoints | Wait for rate limit window to reset |

The `Retry-After` header is included with 429 responses, indicating seconds until the rate limit resets.

## Debugging Tips

1. Always check `/health` first to verify API availability
2. Use `/api/v1/pricing` to confirm the expected payment amount before making paid calls
3. Confirm your Solana transaction reached "confirmed" commitment before sending the proof
4. Payment proofs expire 5 minutes after the transaction confirms -- do not batch requests ahead of time
5. Each proof is single-use -- one payment per one API call
