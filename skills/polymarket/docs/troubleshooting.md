# Polymarket Troubleshooting

Common issues and solutions for Polymarket CLOB integration. Last verified March 2026.

## Authentication Failures

### "L1 auth headers missing or invalid"

The EIP-712 signature is malformed or the timestamp is stale.

- Ensure `POLY_ADDRESS`, `POLY_SIGNATURE`, `POLY_TIMESTAMP`, and `POLY_NONCE` headers are all present.
- Timestamps must be within 60 seconds of server time. Sync your system clock.
- The SDK handles this automatically via `createOrDeriveApiKey()`. If calling the REST API directly, double-check the EIP-712 domain uses `ClobAuthDomain` with chain ID `137`.

### "L2 HMAC signature mismatch"

The HMAC-SHA256 signature does not match the request body.

- Verify `apiKey`, `secret`, and `passphrase` match what was returned by `createOrDeriveApiKey()`.
- The secret is base64-encoded. Decode it before using as HMAC key.
- Request body must be serialized identically to what was signed. Whitespace or key ordering differences break HMAC.
- If credentials were lost, call `createOrDeriveApiKey()` again to re-derive them.

### "Invalid signature type" or orders silently fail

Wrong `signatureType` or `funderAddress` combination.

- New integrations should use signature type `2` (GNOSIS_SAFE).
- The funder address is your **proxy wallet**, found at `polymarket.com/settings`. It is not your EOA address.
- Type `1` (POLY_PROXY) is only for users who exported their private key from the Polymarket Magic Link wallet.

## Order Rejections

### `INVALID_ORDER_MIN_TICK_SIZE`

Price does not conform to the market tick size.

- Query the tick size: `client.getTickSize(tokenID)` or check `minimum_tick_size` on the market object.
- Tick sizes are `0.1`, `0.01`, `0.001`, or `0.0001`. Round your price accordingly.
- Tick sizes can change when prices approach 0 or 1. Subscribe to `tick_size_change` WebSocket events.

### `INVALID_ORDER_NOT_ENOUGH_BALANCE`

Insufficient USDC or token balance, or missing approval.

- Check that the funder address has enough USDC (for BUY) or conditional tokens (for SELL).
- Verify the funder has approved the correct exchange contract (CTF Exchange for standard, Neg Risk CTF Exchange for neg risk markets).
- Max order size = `balance - sum(openOrderSize - filledAmount)`. Open orders reserve balance.

### `FOK_ORDER_NOT_FILLED_ERROR`

Fill-Or-Kill order could not be fully filled.

- The orderbook did not have enough liquidity at your limit price.
- Use FAK instead if partial fills are acceptable.
- Use `client.calculateMarketPrice()` to estimate fill price before submitting.

### `INVALID_POST_ONLY_ORDER`

Post-only order would cross the spread.

- Your limit price is marketable (buy price >= best ask, or sell price <= best bid).
- Adjust the price to rest behind the spread, or remove the post-only flag.

## WebSocket Issues

### Connection drops after ~10 seconds

You are not sending heartbeats.

- Send `PING` as a text message every 10 seconds. The server responds with `PONG`.
- Implement a heartbeat interval immediately after `onopen`.

### No messages received after subscribing

- Verify the `assets_ids` are valid and the markets are active.
- For the market channel, use **token IDs** (asset IDs). For the user channel, use **condition IDs** (market IDs). Mixing these up produces no errors but no data.
- Check that your subscription message format matches the expected schema.

### Auth failed on user channel

- API credentials may have expired or been revoked.
- Re-derive credentials with `createOrDeriveApiKey()` and update the subscription message.

## CTF Operation Errors

### Split transaction reverts

- Confirm USDC approval for the CTF contract (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`), not the Exchange contract.
- Verify the condition ID belongs to an active, unresolved market.
- Ensure the USDC amount does not exceed your balance.

### Merge fails with "insufficient balance"

- You need **equal amounts** of both Yes and No tokens for the condition.
- Check ERC1155 balances for both token IDs before calling merge.

### Redeem returns zero

- The market has not resolved yet, or you hold the losing outcome tokens.
- Only winning tokens pay out. Losing tokens are burned for $0.
- Verify resolution status via the Gamma API before attempting redemption.

## Gasless Transaction Failures

### "Builder credentials invalid"

- Builder API keys are separate from trading API keys. Generate them at `polymarket.com/settings?tab=builder`.
- If using remote signing, ensure your signing server returns all 4 `POLY_BUILDER_*` headers.

### Relayer returns `STATE_FAILED`

- The underlying transaction reverted. Check the encoded calldata for correctness.
- For token approvals, verify the spender address and amount are correct.
- Deploy the Safe wallet (`client.deploy()`) before executing other transactions.
