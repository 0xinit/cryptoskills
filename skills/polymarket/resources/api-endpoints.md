# Polymarket API Endpoints

Quick reference for all Polymarket API endpoints. Last verified March 2026.

## CLOB API (`https://clob.polymarket.com`)

### Public (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/book?token_id={id}` | Orderbook for a token |
| POST | `/books` | Batch orderbooks (up to 500) |
| GET | `/price?token_id={id}&side={BUY\|SELL}` | Best price for a token |
| POST | `/prices` | Batch prices |
| GET | `/midpoint?token_id={id}` | Midpoint price |
| POST | `/midpoints` | Batch midpoints |
| GET | `/spread?token_id={id}` | Bid-ask spread |
| POST | `/spreads` | Batch spreads |
| GET | `/last-trade-price?token_id={id}` | Last trade price |
| GET | `/prices-history` | Price history (params: `market`, `interval`, `fidelity`, `startTs`, `endTs`) |
| GET | `/tick-size?token_id={id}` | Market tick size |
| GET | `/neg-risk?token_id={id}` | Neg risk flag |

### Authenticated (L2 HMAC)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/order` | Place a single order |
| POST | `/orders` | Place batch orders (up to 15) |
| DELETE | `/order/{id}` | Cancel a single order |
| DELETE | `/orders` | Cancel multiple orders |
| DELETE | `/cancel-all` | Cancel all open orders |
| DELETE | `/cancel-market-orders` | Cancel by market or token |
| POST | `/heartbeat` | Heartbeat (dead man's switch) |

### Auth Management (L1 EIP-712)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/api-key` | Create new API credentials |
| GET | `/auth/derive-api-key` | Derive existing credentials |

## Gamma API (`https://gamma-api.polymarket.com`)

All endpoints are public. No authentication required.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/events` | List events (params: `active`, `closed`, `slug`, `tag_id`, `series_id`, `sort`, `ascending`, `limit`, `offset`) |
| GET | `/markets` | List markets (params: `slug`) |
| GET | `/tags/ranked` | Ranked tags |
| GET | `/sports` | Sports metadata |

### Sort Options for Events

| Value | Description |
|-------|-------------|
| `volume_24hr` | 24-hour trading volume |
| `volume` | Total trading volume |
| `liquidity` | Current liquidity |
| `start_date` | Event start date |
| `end_date` | Event end date |
| `competitive` | Competitiveness score |
| `closed_time` | Time market closed |

## Data API (`https://data-api.polymarket.com`)

Public endpoints for trades, positions, and user data.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trades` | Trade history |
| GET | `/positions` | User positions |

## WebSocket Endpoints

| Endpoint | Auth | Subscribe By |
|----------|------|-------------|
| `wss://ws-subscriptions-clob.polymarket.com/ws/market` | None | Token IDs (asset IDs) |
| `wss://ws-subscriptions-clob.polymarket.com/ws/user` | API creds in message | Condition IDs (market IDs) |
| `wss://sports-api.polymarket.com/ws` | None | No subscription needed |

## Relayer (`https://relayer-v2.polymarket.com/`)

Requires Builder Program credentials. Used for gasless transactions.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/execute` | Execute gasless transactions |
| POST | `/deploy` | Deploy Safe/Proxy wallet |

## Bridge (`https://bridge.polymarket.com`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/deposit` | Create deposit addresses |
| POST | `/withdraw` | Create withdrawal addresses |
| POST | `/quote` | Preview withdrawal fees |
| GET | `/status/{address}` | Track deposit/withdrawal status |
| GET | `/supported-assets` | List supported tokens and chains |
