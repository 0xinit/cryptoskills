# Polymarket Error Codes Reference

Quick reference for CLOB API error codes, WebSocket errors, and relayer failures. Last verified March 2026.

## Order Rejection Errors

| Error Code | Cause | Fix |
|------------|-------|-----|
| `INVALID_ORDER_MIN_TICK_SIZE` | Price does not conform to market tick size | Query `getTickSize(tokenID)` and round price to valid increment |
| `INVALID_ORDER_MIN_SIZE` | Order size below minimum threshold | Increase size above the market minimum |
| `INVALID_ORDER_DUPLICATED` | Identical order already exists on book | Change price, size, or cancel existing order |
| `INVALID_ORDER_NOT_ENOUGH_BALANCE` | Insufficient USDC/token balance or missing approval | Check balance and contract approval for the funder address |
| `INVALID_ORDER_EXPIRATION` | GTD expiration is in the past | Set expiration to `now + 60 + N` (at least 60 seconds in the future) |
| `INVALID_POST_ONLY_ORDER_TYPE` | Post-only combined with FOK or FAK | Post-only only works with GTC and GTD |
| `INVALID_POST_ONLY_ORDER` | Post-only order would cross the spread | Adjust price to rest behind the spread |
| `FOK_ORDER_NOT_FILLED_ERROR` | FOK could not be fully filled | Reduce size, increase price limit, or use FAK for partial fills |
| `EXECUTION_ERROR` | System error during trade execution | Retry after a short delay |
| `ORDER_DELAYED` | Order delayed due to market conditions (sports) | Wait for the delay period; order will process |
| `MARKET_NOT_READY` | Market is not yet accepting orders | Wait for market activation or check market status via Gamma API |

## Authentication Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Missing or invalid L2 HMAC headers | Re-derive credentials with `createOrDeriveApiKey()` |
| `403 Forbidden` | Wrong signature type or funder mismatch | Verify signature type (0/1/2) and funder address |
| Invalid L1 signature | EIP-712 signature malformed or timestamp expired | Sync system clock; timestamps must be within 60 seconds |
| HMAC mismatch | Request body changed after signing | Ensure body serialization matches exactly what was signed |

## Heartbeat Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `400` with heartbeat ID | Heartbeat ID expired | Update to the ID returned in the error response and retry |
| All orders cancelled | No heartbeat received within 10 seconds | Send heartbeat every 5 seconds with current heartbeat ID |

## WebSocket Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| Connection closes immediately | No subscription message sent | Send subscription JSON right after `onopen` |
| Drops after ~10 seconds | Missing PING heartbeats | Send `PING` every 10 seconds |
| No messages received | Invalid token/condition IDs | Verify IDs are correct and markets are active |
| Auth failure (user channel) | Expired or revoked API credentials | Re-derive credentials |
| No data (market channel) | Used condition IDs instead of token IDs | Market channel requires token IDs (asset IDs) |
| No data (user channel) | Used token IDs instead of condition IDs | User channel requires condition IDs (market IDs) |

## CTF Operation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Split reverts | Missing USDC approval for CTF contract | Approve CTF contract (`0x4D97...6045`), not the Exchange |
| Split reverts | Insufficient USDC balance | Check USDC.e balance on Polygon |
| Merge reverts | Unequal token balances | Need equal amounts of both Yes and No tokens |
| Redeem returns zero | Market not resolved | Check resolution status via Gamma API first |
| Redeem returns zero | Holding losing outcome tokens | Only winning tokens pay out |
| Wrong exchange | Used standard exchange for neg risk market | Check `negRisk` flag; use Neg Risk CTF Exchange if true |

## Relayer Errors

| State | Cause | Fix |
|-------|-------|-----|
| `STATE_FAILED` | Underlying transaction reverted | Check encoded calldata; verify contract addresses and amounts |
| `STATE_INVALID` | Transaction rejected as invalid | Verify Safe wallet is deployed; check nonce |
| Builder auth failed | Invalid builder credentials | Generate new keys at `polymarket.com/settings?tab=builder` |

## Bridge Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Deposit not detected | Amount below minimum | Check minimum deposit for the source chain |
| Deposit not detected | Unsupported token | Call `/supported-assets` before depositing |
| `FAILED` status | Bridging error | For Ethereum: `recovery.polymarket.com`. For Polygon: `matic-recovery.polymarket.com` |
| High slippage on withdrawal | Amount too large for Uniswap pool | Break into smaller amounts (< $50,000) |

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request (invalid parameters or order rejection) |
| `401` | Unauthorized (missing or invalid auth headers) |
| `403` | Forbidden (wrong signature type or permissions) |
| `404` | Resource not found |
| `429` | Rate limited |
| `500` | Server error |
