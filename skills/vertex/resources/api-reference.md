# Vertex API Reference

Complete endpoint reference for the Vertex Protocol API. All chains follow the same endpoint pattern — substitute the chain subdomain.

Last verified: February 2026

## Base URLs

### Arbitrum Mainnet

| Service | URL |
|---------|-----|
| Gateway REST | `https://gateway.prod.vertexprotocol.com/v1` |
| Gateway WebSocket | `wss://gateway.prod.vertexprotocol.com/v1/ws` |
| Subscriptions | `wss://gateway.prod.vertexprotocol.com/v1/subscribe` |
| Indexer/Archive | `https://archive.prod.vertexprotocol.com/v1` |
| Trigger | `https://trigger.prod.vertexprotocol.com/v1` |

### Base Mainnet

| Service | URL |
|---------|-----|
| Gateway REST | `https://gateway.base-prod.vertexprotocol.com/v1` |
| Gateway WebSocket | `wss://gateway.base-prod.vertexprotocol.com/v1/ws` |
| Subscriptions | `wss://gateway.base-prod.vertexprotocol.com/v1/subscribe` |
| Indexer/Archive | `https://archive.base-prod.vertexprotocol.com/v1` |
| Trigger | `https://trigger.base-prod.vertexprotocol.com/v1` |

### Mantle Mainnet

| Service | URL |
|---------|-----|
| Gateway REST | `https://gateway.mantle-prod.vertexprotocol.com/v1` |
| Gateway WebSocket | `wss://gateway.mantle-prod.vertexprotocol.com/v1/ws` |
| Subscriptions | `wss://gateway.mantle-prod.vertexprotocol.com/v1/subscribe` |
| Indexer/Archive | `https://archive.mantle-prod.vertexprotocol.com/v1` |
| Trigger | `https://trigger.mantle-prod.vertexprotocol.com/v1` |

### Sepolia Testnet

| Service | URL |
|---------|-----|
| Gateway REST | `https://gateway.sepolia-test.vertexprotocol.com/v1` |
| Gateway WebSocket | `wss://gateway.sepolia-test.vertexprotocol.com/v1/ws` |
| Subscriptions | `wss://gateway.sepolia-test.vertexprotocol.com/v1/subscribe` |
| Indexer/Archive | `https://archive.sepolia-test.vertexprotocol.com/v1` |
| Trigger | `https://trigger.sepolia-test.vertexprotocol.com/v1` |

## Gateway Execute Endpoints

All executes are `POST {GATEWAY}/execute` with a JSON body. Over WebSocket, send JSON to `{GATEWAY_WS}`.

| Execute Type | Description | Key Parameters |
|-------------|-------------|----------------|
| `place_order` | Place a new order | `product_id`, `order` (sender, priceX18, amount, expiration, nonce), `signature` |
| `cancel_orders` | Cancel orders by digest | `sender`, `product_ids[]`, `digests[]`, `nonce`, `signature` |
| `cancel_product_orders` | Cancel all orders for products | `sender`, `product_ids[]`, `nonce`, `signature` |
| `cancel_and_place` | Atomic cancel + place | `cancel_orders` + `place_order` params |
| `withdraw_collateral` | Withdraw collateral | `sender`, `product_id`, `amount`, `nonce`, `signature` |
| `liquidate_subaccount` | Liquidate unhealthy account | `sender`, `liquidatee`, `product_id`, `is_encoded_spread`, `amount`, `nonce`, `signature` |
| `mint_lp` | Provide liquidity | `sender`, `product_id`, `amount_base`, `quote_amount_low`, `quote_amount_high`, `nonce`, `signature` |
| `burn_lp` | Remove liquidity | `sender`, `product_id`, `amount`, `nonce`, `signature` |
| `link_signer` | Link a signing key | `sender`, `signer`, `nonce`, `signature` |
| `transfer_quote` | Transfer USDC between subaccounts | `sender`, `recipient`, `amount`, `nonce`, `signature` |

### Place Order Request Body

```json
{
  "place_order": {
    "product_id": 2,
    "order": {
      "sender": "0x<bytes32_subaccount>",
      "priceX18": "65000000000000000000000",
      "amount": "100000000000000000",
      "expiration": "4611686020146462000",
      "nonce": "1708905600000000000"
    },
    "signature": "0x<eip712_signature>"
  }
}
```

### Cancel Orders Request Body

```json
{
  "cancel_orders": {
    "sender": "0x<bytes32_subaccount>",
    "productIds": [2],
    "digests": ["0x<order_digest>"],
    "nonce": "1708905600000000001",
    "signature": "0x<eip712_signature>"
  }
}
```

## Gateway Query Endpoints

All queries are `GET/POST {GATEWAY}/query` with a JSON body.

| Query Type | Description | Key Parameters |
|-----------|-------------|----------------|
| `status` | Gateway health check | None |
| `contracts` | Contract addresses | None |
| `nonces` | Current nonces for subaccount | `address` |
| `order` | Single order by digest | `product_id`, `digest` |
| `orders` | Open orders for subaccount | `sender`, `product_id` |
| `subaccount_info` | Full subaccount state | `subaccount` (bytes32) |
| `market_liquidity` | Orderbook depth | `product_id`, `depth` |
| `symbols` | Product symbol mapping | None |
| `all_products` | All product configs | None |
| `market_prices` | Bid/ask for product | `product_id` |
| `max_order_size` | Max orderable amount | `sender`, `product_id`, `price`, `direction` |
| `max_withdrawable` | Max withdrawal amount | `sender`, `product_id` |
| `max_lp_mintable` | Max LP mintable | `sender`, `product_id` |
| `fee_rates` | Maker/taker fees | `sender` |
| `linked_signer` | Linked signer info | `subaccount` |

### Subaccount Info Response

```json
{
  "status": "success",
  "data": {
    "exists": true,
    "healths": {
      "initial": { "health": "5000000000000000000000" },
      "maintenance": { "health": "7500000000000000000000" }
    },
    "health_contributions": [...],
    "spot_count": 3,
    "perp_count": 2,
    "spot_balances": [
      {
        "product_id": 0,
        "balance": { "amount": "10000000000000000000000" },
        "lp_balance": { "amount": "0" }
      }
    ],
    "perp_balances": [
      {
        "product_id": 2,
        "balance": {
          "amount": "100000000000000000",
          "v_quote_balance": "-6500000000000000000000"
        },
        "lp_balance": { "amount": "0" }
      }
    ]
  }
}
```

## Subscriptions (WebSocket Streams)

Connect to `{SUBSCRIPTIONS_WS}` and send JSON subscribe messages.

| Stream Type | Required Fields | Message Rate |
|-------------|----------------|--------------|
| `best_bid_offer` | `product_id` | Every book change |
| `trade` | `product_id` | Per trade |
| `book_depth` | `product_id` | Snapshot + deltas |
| `fill` | `product_id`, `subaccount` | Per fill |
| `position_change` | `subaccount` | Per position update |
| `order_update` | `product_id`, `subaccount` | Per order status change |

### Subscribe Message

```json
{
  "method": "subscribe",
  "stream": {
    "type": "best_bid_offer",
    "product_id": 2
  }
}
```

### Unsubscribe Message

```json
{
  "method": "unsubscribe",
  "stream": {
    "type": "best_bid_offer",
    "product_id": 2
  }
}
```

## Indexer/Archive Endpoints

All indexer queries are `POST {ARCHIVE}/indexer` or dedicated paths.

| Endpoint | Description | Key Parameters |
|----------|-------------|----------------|
| `matches` | Historical fills | `subaccount`, `product_ids[]`, `limit`, `offset` |
| `orders` | Historical orders | `subaccount`, `product_ids[]`, `limit`, `offset` |
| `funding_rate` | 24h perp funding rate | `product_id` |
| `interest_and_funding_payments` | Payment history | `subaccount`, `product_ids[]`, `limit` |
| `linked_signer_rate_limit` | Linked signer rate limits | `subaccount` |
| `subaccounts` | List subaccounts | `address` (optional), `limit` |
| `rewards` | Trading rewards history | `address` |
| `candlesticks` | OHLCV data | `product_id`, `granularity`, `limit` |
| `market_snapshots` | Historical market data | `product_id`, `interval` |

### Candlestick Granularities

| Value | Interval |
|-------|----------|
| `60` | 1 minute |
| `300` | 5 minutes |
| `900` | 15 minutes |
| `3600` | 1 hour |
| `14400` | 4 hours |
| `86400` | 1 day |

## Trigger Endpoints

All trigger requests are `POST {TRIGGER}/execute`.

| Action | Description | Key Parameters |
|--------|-------------|----------------|
| `place_order` | Place trigger (stop/TP) order | `product_id`, `order`, `trigger` (price_above/price_below), `signature` |
| `cancel_trigger_orders` | Cancel trigger orders | `sender`, `product_ids[]`, `digests[]` |
| `list_trigger_orders` | List active triggers | `sender`, `product_id` |

### Trigger Order Body

```json
{
  "place_order": {
    "product_id": 2,
    "order": {
      "sender": "0x<bytes32>",
      "priceX18": "60000000000000000000000",
      "amount": "-100000000000000000",
      "expiration": "4611686020146462000",
      "nonce": "1708905600000000000"
    },
    "trigger": {
      "price_above": null,
      "price_below": "62000000000000000000000"
    },
    "signature": "0x<eip712_signature>"
  }
}
```

## EIP-712 Signing

All executes require EIP-712 typed data signatures. The `sender` field is a `bytes32` composed of:

```
sender = address (20 bytes) + subaccount_name (12 bytes, right-padded with 0x00)
```

The SDK handles this automatically. For raw API usage, construct the bytes32 manually:

```python
from vertex_protocol.utils.subaccount import SubaccountParams, subaccount_to_bytes32

sender = subaccount_to_bytes32(
    SubaccountParams(
        subaccount_owner="0xYourAddress",
        subaccount_name="default",
    )
)
```

An empty `subaccount_name` (`""`) sets the 12-byte identifier to all zeros — this is the default subaccount.

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Gateway executes | 10 requests/second per subaccount |
| Gateway queries | 50 requests/second per IP |
| Subscriptions | 10 subscriptions per connection |
| Indexer queries | 20 requests/second per IP |
| Trigger orders | 5 requests/second per subaccount |

Linked signers inherit the rate limit of the parent subaccount.
