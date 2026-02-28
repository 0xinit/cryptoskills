# Jupiter API Endpoint Reference

Base URL: `https://api.jup.ag`

Authentication: `x-api-key` header (obtain from [portal.jup.ag](https://portal.jup.ag))

Last verified: 2026-02-26

## Swap API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/swap/v1/quote` | Get a swap quote with optimal routing |
| POST | `/swap/v1/swap` | Get a serialized transaction for a quote |
| POST | `/swap/v1/swap-instructions` | Get individual instructions instead of a full transaction |

### GET /swap/v1/quote

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inputMint` | string | Yes | Input token mint address |
| `outputMint` | string | Yes | Output token mint address |
| `amount` | string | Yes | Input amount in base units (lamports) |
| `slippageBps` | number | No | Slippage in basis points (default: 50) |
| `restrictIntermediateTokens` | boolean | No | Restrict to high-liquidity intermediate tokens |
| `onlyDirectRoutes` | boolean | No | Only use single-hop routes |
| `maxAccounts` | number | No | Max accounts in transaction (for legacy tx compat) |

### POST /swap/v1/swap

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `quoteResponse` | object | Yes | Full quote response from `/quote` |
| `userPublicKey` | string | Yes | Signer's public key |
| `dynamicComputeUnitLimit` | boolean | No | Auto-set CU limit from simulation |
| `dynamicSlippage` | boolean | No | Let Jupiter optimize slippage |
| `prioritizationFeeLamports` | object | No | Priority fee configuration |

## Ultra API (Gasless Swaps)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ultra/v1/order` | Create a gasless swap order |
| POST | `/ultra/v1/execute` | Submit a signed order for execution |
| GET | `/ultra/v1/order/{requestId}` | Check order status |

### POST /ultra/v1/order

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inputMint` | string | Yes | Input token mint |
| `outputMint` | string | Yes | Output token mint |
| `amount` | string | Yes | Input amount in base units |
| `taker` | string | Yes | Taker's public key |

## Trigger API (Limit Orders)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/trigger/v1/createOrder` | Create a limit order |
| POST | `/trigger/v1/cancelOrder` | Cancel an open limit order |
| GET | `/trigger/v1/orders/{publicKey}` | Get open orders for a wallet |

### POST /trigger/v1/createOrder

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `maker` | string | Yes | Maker's public key |
| `payer` | string | Yes | Transaction fee payer |
| `inputMint` | string | Yes | Token you are selling |
| `outputMint` | string | Yes | Token you are buying |
| `makingAmount` | string | Yes | Amount you are offering (base units) |
| `takingAmount` | string | Yes | Minimum amount you want (base units) |
| `expiredAt` | number | No | Unix timestamp (seconds) for order expiry |

## Recurring API (DCA)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recurring/v1/createOrder` | Create a DCA position |
| POST | `/recurring/v1/cancelOrder` | Cancel a DCA position |
| GET | `/recurring/v1/orders/{publicKey}` | Get active DCA orders |

### POST /recurring/v1/createOrder

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user` | string | Yes | User's public key |
| `payer` | string | Yes | Transaction fee payer |
| `inputMint` | string | Yes | Token to sell over time |
| `outputMint` | string | Yes | Token to accumulate |
| `inAmount` | string | Yes | Total input amount (base units) |
| `inAmountPerCycle` | string | Yes | Amount per cycle (base units) |
| `cycleFrequency` | number | Yes | Seconds between swaps |

## Price API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/price/v2` | Get real-time token prices |

### GET /price/v2

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | string | Yes | Comma-separated list of token mint addresses |
| `vsToken` | string | No | Quote currency mint (default: USDC) |
| `showExtraInfo` | boolean | No | Include confidence and depth data |

## Token API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tokens/v1` | Get all tradeable tokens |
| GET | `/tokens/v1/strict` | Get verified tokens only |
| GET | `/tokens/v1/token/{mint}` | Get metadata for a specific token |

## Rate Limits

Rate limits depend on your API key tier. Check [portal.jup.ag](https://portal.jup.ag) for your plan's limits. Exceeding them returns HTTP 429.

## Notes

- All amount fields are strings representing base-unit values (use `bigint` in code)
- Transactions are returned as base64-encoded serialized `VersionedTransaction`
- Quote responses have a short TTL (~30 seconds); execute swaps promptly
