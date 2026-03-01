# Vertex Error Codes and Solutions

Common errors returned by the Vertex Protocol API, with root causes and fixes.

Last verified: February 2026

## Gateway Execute Errors

### "invalid signature"

```json
{"status": "failure", "error": "invalid signature"}
```

**Cause**: The EIP-712 signature does not match the sender or the payload.

**Fix**:
1. Verify the private key matches the `subaccount_owner` address in the sender bytes32
2. Ensure `subaccount_name` is encoded correctly (right-padded with zero bytes to 12 bytes)
3. Check that the chain ID in the EIP-712 domain matches the target chain (42161 for Arbitrum, 8453 for Base)
4. If using a linked signer, confirm the link is active via `get_linked_signer`

### "invalid nonce"

```json
{"status": "failure", "error": "invalid nonce"}
```

**Cause**: The nonce was already used, is malformed, or does not follow the expected format.

**Fix**:
1. Always use `gen_order_nonce()` from the SDK — it generates timestamp-based nonces, not sequential integers
2. Do not reuse nonces across orders
3. If constructing nonces manually, they must encode a millisecond timestamp and be unique

### "invalid product_id"

```json
{"status": "failure", "error": "invalid product_id"}
```

**Cause**: The product ID does not exist on this chain or was specified incorrectly.

**Fix**:
1. Query `all_products` to get the valid product list for the current chain
2. Product IDs differ between chains — a product active on Arbitrum may not exist on Mantle
3. Product 0 (USDC) cannot be traded as a spot market — it is the quote asset only

### "order would cross"

```json
{"status": "failure", "error": "order would cross, post only"}
```

**Cause**: A `POST_ONLY` order would immediately match against existing liquidity (cross the spread).

**Fix**:
1. Adjust the price further from the current best bid/ask
2. Use `OrderType.DEFAULT` (GTC) if you want the order to fill immediately
3. Use `OrderType.IOC` for market-like execution

### "insufficient health"

```json
{"status": "failure", "error": "insufficient health for order"}
```

**Cause**: Placing this order would bring the subaccount's initial health below zero.

**Fix**:
1. Check `subaccount_info` to see current health values
2. Reduce position size or add more collateral
3. Close existing positions to free up margin
4. Check `max_order_size` query for the maximum orderable amount at a given price

### "subaccount does not exist"

```json
{"status": "failure", "error": "subaccount does not exist"}
```

**Cause**: The subaccount has never deposited or received a transfer.

**Fix**:
1. Deposit collateral to the subaccount first (this creates it)
2. Or transfer USDC from another subaccount via `transfer_quote`

### "order expired"

```json
{"status": "failure", "error": "order expired"}
```

**Cause**: The expiration timestamp in the order has already passed.

**Fix**:
1. Set expiration to a future timestamp: `int(time.time()) + desired_seconds`
2. The expiration field encodes both the order type and the timestamp — use `get_expiration_timestamp()` from the SDK
3. Clock skew between your machine and the sequencer can cause this — use NTP sync

### "rate limited"

```json
{"status": "failure", "error": "rate limited"}
```

**Cause**: Too many requests from this subaccount or IP.

**Fix**:
1. Gateway executes: max 10/second per subaccount
2. Gateway queries: max 50/second per IP
3. Implement exponential backoff
4. Use WebSocket instead of REST polling for high-frequency data

### "amount too small"

```json
{"status": "failure", "error": "amount too small"}
```

**Cause**: The order amount is below the minimum for this product.

**Fix**:
1. Check the product's `min_size` from `all_products`
2. Amounts are in x18 fixed-point — ensure you are using `to_pow_10()` correctly

## Gateway Query Errors

### "unknown query type"

```json
{"status": "failure", "error": "unknown query type"}
```

**Cause**: The query type field is misspelled or not supported.

**Fix**: Valid query types are: `status`, `contracts`, `nonces`, `order`, `orders`, `subaccount_info`, `market_liquidity`, `symbols`, `all_products`, `market_prices`, `max_order_size`, `max_withdrawable`, `max_lp_mintable`, `fee_rates`, `linked_signer`.

### "product not found"

```json
{"status": "failure", "error": "product not found"}
```

**Cause**: Querying a product ID that does not exist.

**Fix**: Use `all_products` query to get valid product IDs for the chain you are connected to.

## WebSocket / Subscription Errors

### Connection drops immediately

**Cause**: Connecting to the wrong endpoint — gateway WS vs subscription WS.

**Fix**:
- For queries and executes: `wss://gateway.prod.vertexprotocol.com/v1/ws`
- For subscriptions (streams): `wss://gateway.prod.vertexprotocol.com/v1/subscribe`
- These are different endpoints — subscriptions will not work on the gateway WS and vice versa

### "invalid stream type"

**Cause**: The `type` field in the subscribe message is misspelled.

**Fix**: Valid stream types: `best_bid_offer`, `trade`, `book_depth`, `fill`, `position_change`, `order_update`.

### No messages received after subscribing

**Cause**: The product has no activity, or the subaccount field is incorrect for authenticated streams.

**Fix**:
1. Try subscribing to a high-volume product (product_id 2 = BTC-PERP)
2. For `fill`, `position_change`, and `order_update`, the `subaccount` must be a hex-encoded bytes32
3. Verify the connection is open by checking for the initial acknowledgment message

## Trigger API Errors

### "trigger price invalid"

**Cause**: Both `price_above` and `price_below` are set, or neither is set.

**Fix**: Set exactly one of `price_above` (for take-profit on longs / stop on shorts) or `price_below` (for stop-loss on longs / take-profit on shorts). Set the other to `null`.

### "too many trigger orders"

**Cause**: Maximum trigger orders per subaccount per product exceeded.

**Fix**: Cancel existing trigger orders before placing new ones. Use `list_trigger_orders` to see active triggers.

## Indexer Errors

### "timeout"

**Cause**: Query too broad — requesting too much historical data without pagination.

**Fix**:
1. Add `limit` parameter (max 100 per page)
2. Use `offset` for pagination
3. Filter by `product_ids` to narrow the query

## HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Parse response body |
| 400 | Bad request | Check request format, missing fields |
| 401 | Unauthorized | Invalid or expired signature |
| 429 | Rate limited | Back off and retry |
| 500 | Internal error | Retry after 1-2 seconds |
| 503 | Service unavailable | Sequencer maintenance — retry later |
