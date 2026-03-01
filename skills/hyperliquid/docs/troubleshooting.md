# Hyperliquid Troubleshooting

Common issues and fixes when integrating with the Hyperliquid API.

Last verified: February 2026

## Signature Recovery Fails — "User or API Wallet does not exist"

### Symptom

```json
{"status": "err", "response": "L1 error: User or API Wallet 0xABC... does not exist"}
```

The recovered signer address in the error does not match your wallet address.

### Root Cause

Incorrect EIP-712 signature construction. Hyperliquid uses two distinct signing schemes, and using the wrong one produces a valid signature that recovers to a different address:

- **L1 actions** (orders, cancels, leverage): chain ID `1337`, phantom agent signing
- **User-signed actions** (agent approval, withdrawals): chain ID `421614`

Common mistakes:
1. Wrong chain ID for the action type
2. Incorrect field ordering in msgpack serialization
3. Numeric precision mismatch (float vs string)
4. Uppercase characters in the address (use lowercase)

### Fix

Use the official SDK instead of manual signing:

```python
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
from eth_account import Account

wallet = Account.from_key("0xYOUR_PRIVATE_KEY")
exchange = Exchange(wallet, constants.MAINNET_API_URL)
# SDK handles signing correctly for both L1 and user-signed actions
```

If you must implement signing manually, compare your signed payload byte-for-byte against the SDK output.

## Orders Rejected with "Insufficient margin" Despite Having Balance

### Symptom

Placing an order fails with `Insufficient margin to place order` even though the account shows available balance.

### Root Cause

Multiple possibilities:
1. Margin is reserved by existing open orders (not just positions)
2. Using isolated margin — available margin is per-position
3. Cross-margin account value includes unrealized PnL which fluctuates

### Fix

```python
state = info.user_state(wallet.address)
margin = state["marginSummary"]
print(f"Account value: {margin['accountValue']}")
print(f"Margin used:   {margin['totalMarginUsed']}")
available = float(margin["accountValue"]) - float(margin["totalMarginUsed"])
print(f"Available:     {available}")
```

Check that `available` covers the new order's initial margin requirement: `notional / leverage`.

## WebSocket Disconnects Without Error

### Symptom

WebSocket connection drops silently. No `on_error` callback fires. Messages stop arriving.

### Root Cause

Hyperliquid's WebSocket server may disconnect idle connections or during infrastructure updates. The protocol does not define a ping/pong keep-alive.

### Fix

Implement reconnection with exponential backoff and state backfill:

```python
import time
import threading
import requests
import websocket

reconnect_delay = 1.0

def on_close(ws, code, msg):
    global reconnect_delay
    print(f"Disconnected. Reconnecting in {reconnect_delay}s...")
    time.sleep(reconnect_delay)
    reconnect_delay = min(reconnect_delay * 2, 60.0)
    connect()

def on_open(ws):
    global reconnect_delay
    reconnect_delay = 1.0
    # Backfill missed state from REST
    state = requests.post("https://api.hyperliquid.xyz/info", json={
        "type": "clearinghouseState",
        "user": "0xYOUR_ADDRESS"
    }).json()
    # Re-subscribe to channels
    ws.send('{"method":"subscribe","subscription":{"type":"userFills","user":"0xYOUR_ADDRESS"}}')

def connect():
    ws = websocket.WebSocketApp(
        "wss://api.hyperliquid.xyz/ws",
        on_open=on_open,
        on_close=on_close,
        on_message=lambda ws, m: print(m),
        on_error=lambda ws, e: print(f"Error: {e}")
    )
    ws.run_forever()
```

## Asset Index Mismatch — Wrong Asset Traded

### Symptom

Order executes on a different asset than intended, or fails with an invalid asset error.

### Root Cause

Asset indices are assigned sequentially as new markets are listed. Hardcoding indices (e.g., `0` for BTC) will break when new assets are inserted.

### Fix

Always resolve indices dynamically:

```python
meta = info.meta()
asset_map = {asset["name"]: i for i, asset in enumerate(meta["universe"])}

btc_index = asset_map["BTC"]  # current index, not hardcoded
eth_index = asset_map["ETH"]
```

Cache the map at startup and refresh periodically (e.g., every hour) to catch new listings.

## Rate Limit Exhaustion — HTTP 429

### Symptom

Requests return HTTP 429 or responses slow down significantly.

### Root Cause

Exceeded the per-address rate limit (1200 requests/minute base). Common causes:
- Polling info endpoints too frequently
- Placing orders individually instead of batching
- Using `expiresAfter` with stale cancels (5x weight penalty)

### Fix

1. Check current usage:

```python
rate = requests.post("https://api.hyperliquid.xyz/info", json={
    "type": "userRateLimit",
    "user": "0xYOUR_ADDRESS"
}).json()
print(f"Used: {rate['nRequestsUsed']}/{rate['nRequestsCap']}")
```

2. Batch orders with `bulk_orders()` instead of individual `order()` calls
3. Use WebSocket for real-time data instead of polling info endpoints
4. Reserve additional capacity: `requestWeightReservation` action (0.0005 USDC/request)

## Trigger Orders Not Firing

### Symptom

A stop-loss or take-profit trigger order is placed successfully but does not execute when the price crosses the trigger level.

### Root Cause

Trigger orders activate based on the **oracle price**, not the mark price or last trade price. The oracle price can differ from the exchange's mid price, especially during volatile periods.

### Fix

1. Verify the oracle price matches your expectations:

```python
# activeAssetCtx via WebSocket shows oracle price in real-time
# Or check clearinghouseState which uses oracle for liquidation calculations
```

2. Ensure trigger direction is correct:
   - **Long TP**: trigger price ABOVE entry
   - **Long SL**: trigger price BELOW entry
   - **Short TP**: trigger price BELOW entry
   - **Short SL**: trigger price ABOVE entry

3. Ensure `tpsl` field matches intent: `"tp"` for take-profit, `"sl"` for stop-loss

## "Must deposit before performing actions"

### Symptom

Any exchange action returns this error for a new wallet.

### Root Cause

All wallets must complete at least one USDC deposit via the Arbitrum bridge before the Hyperliquid L1 recognizes them.

### Fix

1. Bridge USDC from Arbitrum: https://app.hyperliquid.xyz
2. For testnet: use the faucet at https://app.hyperliquid-testnet.xyz
3. After deposit confirms, retry the action

## Python SDK Import Errors

### Symptom

```
ModuleNotFoundError: No module named 'hyperliquid'
```

### Root Cause

The package name on PyPI is `hyperliquid-python-sdk`, not `hyperliquid`.

### Fix

```bash
pip install hyperliquid-python-sdk
```

Verify:

```bash
python -c "from hyperliquid.info import Info; print('OK')"
```
