# Hyperliquid API Reference

Endpoint tables for all Info and Exchange API methods.

Last verified: February 2026

## Base URLs

| Environment | REST | WebSocket |
|-------------|------|-----------|
| Mainnet | `https://api.hyperliquid.xyz` | `wss://api.hyperliquid.xyz/ws` |
| Testnet | `https://api.hyperliquid-testnet.xyz` | `wss://api.hyperliquid-testnet.xyz/ws` |

All REST requests are `POST` with `Content-Type: application/json`.

## Info Endpoints (`POST /info`)

No authentication required. All requests take `{"type": "<type>", ...params}`.

### Market Data

| Type | Params | Description | Response |
|------|--------|-------------|----------|
| `meta` | `dex?` | Perpetual universe: asset names, indices, max leverage, tick sizes | `{universe: [{name, szDecimals, maxLeverage}]}` |
| `allMids` | `dex?` | Mid prices for all assets | `{"BTC": "95432.5", "ETH": "3245.1"}` |
| `l2Book` | `coin`, `nSigFigs?` (2-5), `mantissa?` (1/2/5) | L2 orderbook snapshot, up to 20 levels per side | `{levels: [[bids], [asks]], coin, time}` |
| `candleSnapshot` | `req: {coin, interval, startTime, endTime}` | OHLCV candles. Intervals: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h, 1d, 3d, 1w, 1M. Max 5000. | `[{T, o, h, l, c, v, n, s, t, i}]` |
| `predictedFundings` | — | Predicted funding rates across venues | `[{coin, fundingRate, premium}]` |
| `fundingHistory` | `coin`, `startTime`, `endTime?` | Historical funding rates | `[{coin, fundingRate, premium, time}]` |

### User State (Public — any address)

| Type | Params | Description | Response |
|------|--------|-------------|----------|
| `clearinghouseState` | `user`, `dex?` | Positions, margin summary, withdrawable | `{marginSummary, assetPositions, withdrawable}` |
| `openOrders` | `user`, `dex?` | Open orders (basic) | `[{oid, coin, side, limitPx, sz, timestamp}]` |
| `frontendOpenOrders` | `user`, `dex?` | Open orders (detailed with trigger info) | `[{oid, coin, side, limitPx, sz, orderType, triggerPx, reduceOnly}]` |
| `userFills` | `user`, `aggregateByTime?` | Recent fills (max 2000) | `[{px, sz, side, coin, fee, feeToken, closedPnl, dir, tid, hash}]` |
| `userFillsByTime` | `user`, `startTime`, `endTime?`, `aggregateByTime?` | Fills in time range (max 2000) | Same as `userFills` |
| `userFunding` | `user`, `startTime`, `endTime?` | User funding payments | `[{time, coin, usdc, szi, fundingRate}]` |
| `orderStatus` | `user`, `oid` or `cloid` | Single order status | `{status, order}` — status: open, filled, canceled, rejected, triggered |
| `historicalOrders` | `user` | Order history (max 2000) | `[{order, status, statusTimestamp}]` |
| `userRateLimit` | `user` | Current rate limit usage | `{cumVlm, nRequestsUsed, nRequestsCap, nRequestsSurplus}` |
| `userFees` | `user` | Fee tier and daily volume | `{dailyVolume, feeSchedule, tier}` |
| `subAccounts` | `user` | List subaccounts | `[{name, subAccountUser, master, clearinghouseState}]` |
| `userRole` | `user` | Account type | `"user" | "agent" | "vault" | "subAccount" | "missing"` |

### Vault & Staking

| Type | Params | Description |
|------|--------|-------------|
| `vaultDetails` | `vaultAddress`, `user?` | Vault TVL, APR, portfolio, depositor info |
| `portfolio` | `user` | Historical account value and PnL |
| `delegations` | `user` | Active staking delegations |
| `delegatorSummary` | `user` | Staking summary |
| `delegatorRewards` | `user` | Staking reward history |

### TWAP

| Type | Params | Description |
|------|--------|-------------|
| `userTwapSliceFills` | `user` | TWAP slice execution history (max 2000) |

## Exchange Endpoints (`POST /exchange`)

All requests require EIP-712 signature. Payload: `{action, nonce, signature, vaultAddress?}`.

### Order Management

| Action Type | Key Fields | Description |
|-------------|-----------|-------------|
| `order` | `orders: [{a, b, p, s, r, t, c?}]`, `grouping` | Place one or more orders. `a`=asset index, `b`=isBuy, `p`=price (string), `s`=size (string), `r`=reduceOnly, `t`=order type, `c`=cloid |
| `cancel` | `cancels: [{a, o}]` | Cancel by asset index + OID |
| `cancelByCloid` | `cancels: [{asset, cloid}]` | Cancel by client order ID |
| `modify` | `oid`, `order` | Modify a single order in-place |
| `batchModify` | `modifies: [{oid, order}]` | Modify multiple orders atomically |
| `scheduleCancel` | `time` | Dead man's switch: cancel all orders at timestamp. Min 5s delay, max 10/day |

### Order Type Field (`t`)

| Type | Format | Description |
|------|--------|-------------|
| Limit GTC | `{"limit": {"tif": "Gtc"}}` | Good-til-canceled |
| Limit IOC | `{"limit": {"tif": "Ioc"}}` | Immediate-or-cancel |
| Limit ALO | `{"limit": {"tif": "Alo"}}` | Add-liquidity-only (post-only) |
| Trigger Market | `{"trigger": {"triggerPx": "...", "isMarket": true, "tpsl": "tp"|"sl"}}` | Market order on trigger |
| Trigger Limit | `{"trigger": {"triggerPx": "...", "isMarket": false, "tpsl": "tp"|"sl"}}` | Limit order on trigger |

### TWAP

| Action Type | Key Fields | Description |
|-------------|-----------|-------------|
| `twapOrder` | `a`, `b`, `s`, `r`, `m` (minutes), `t` (randomize) | Time-weighted execution |
| `twapCancel` | `a`, `t` (twapId) | Cancel running TWAP |

### Position Management

| Action Type | Key Fields | Description |
|-------------|-----------|-------------|
| `updateLeverage` | `asset`, `isCross`, `leverage` | Set cross or isolated leverage |
| `updateIsolatedMargin` | `asset`, `isBuy`, `ntli` | Add/remove isolated margin |

### Transfers

| Action Type | Key Fields | Description |
|-------------|-----------|-------------|
| `usdClassTransfer` | `amount`, `toPerp` | Move USDC between spot and perp wallets |
| `usdSend` | `destination`, `amount` | Internal USDC transfer to another Hyperliquid account |
| `spotSend` | `destination`, `token`, `amount` | Internal spot token transfer |
| `withdraw3` | `destination`, `amount` | Bridge USDC to EVM (~5 min, $1 fee) |
| `vaultTransfer` | `vaultAddress`, `isDeposit`, `usd` | Deposit/withdraw from vault |
| `subAccountTransfer` | `subAccountUser`, `isDeposit`, `usd` | Transfer to/from subaccount |

### Account Management

| Action Type | Key Fields | Description |
|-------------|-----------|-------------|
| `approveAgent` | `agentAddress`, `agentName?` | Approve agent wallet for automated trading (max 4 per account) |
| `approveBuilderFee` | `builder`, `maxFeeRate` | Approve builder fee deduction |
| `createSubAccount` | `name` | Create a new subaccount |

## Response Format

### Success

```json
{
  "status": "ok",
  "response": {
    "type": "order",
    "data": {
      "statuses": [
        {"resting": {"oid": 123456}},
        {"filled": {"oid": 123457, "totalSz": "0.1", "avgPx": "3245.5"}},
        {"error": "Insufficient margin to place order."}
      ]
    }
  }
}
```

### Error

```json
{
  "status": "err",
  "response": "Error message string"
}
```

## Pagination

Info endpoints with time ranges return max 500 elements per request. Use the last item's timestamp as the `startTime` for the next request to paginate.
