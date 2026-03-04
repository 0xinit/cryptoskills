# Polymarket Order Types Reference

Quick reference for order types, tick sizes, statuses, and trading rules. Last verified March 2026.

## Order Types

| Type | Behavior | Amount Semantics | Post-Only |
|------|----------|------------------|-----------|
| **GTC** | Good-Til-Cancelled. Rests on book until filled or cancelled. | `size` = share count | Yes |
| **GTD** | Good-Til-Date. Expiration = UTC seconds. Min: `now + 60 + N`. | `size` = share count | Yes |
| **FOK** | Fill-Or-Kill. Fill entirely or cancel. | BUY: `amount` = dollars. SELL: `amount` = shares. | No |
| **FAK** | Fill-And-Kill. Fill available, cancel rest. | BUY: `amount` = dollars. SELL: `amount` = shares. | No |

## Tick Sizes

| Tick Size | Precision | Valid Prices |
|-----------|-----------|-------------|
| `0.1` | 1 decimal | 0.1, 0.2, 0.3, ..., 0.9 |
| `0.01` | 2 decimals | 0.01, 0.02, ..., 0.99 |
| `0.001` | 3 decimals | 0.001, 0.002, ..., 0.999 |
| `0.0001` | 4 decimals | 0.0001, 0.0002, ..., 0.9999 |

Tick sizes change dynamically when prices approach extremes (>0.96 or <0.04). Monitor `tick_size_change` WebSocket events.

## Signature Types

| Type | Value | Funder | Gas |
|------|-------|--------|-----|
| EOA | `0` | Wallet address | Needs POL |
| POLY_PROXY | `1` | Magic Link proxy | Needs POL |
| GNOSIS_SAFE | `2` | Safe proxy wallet | Needs POL (or use Relayer) |

## Insert Statuses (Order Placement Response)

| Status | Description |
|--------|-------------|
| `live` | Resting on the book |
| `matched` | Matched immediately |
| `delayed` | Marketable but subject to matching delay |
| `unmatched` | Marketable but failed to delay — placement still successful |

## Trade Statuses (Settlement Lifecycle)

```
MATCHED -> MINED -> CONFIRMED
    |        ^
    v        |
RETRYING ---+
    |
    v
  FAILED
```

| Status | Terminal | Description |
|--------|----------|-------------|
| `MATCHED` | No | Sent to executor for onchain submission |
| `MINED` | No | Mined on chain, no finality yet |
| `CONFIRMED` | Yes | Finalized — trade successful |
| `RETRYING` | No | Failed, being resubmitted |
| `FAILED` | Yes | Permanently failed |

## Relayer Transaction States

| State | Terminal | Description |
|-------|----------|-------------|
| `STATE_NEW` | No | Received by relayer |
| `STATE_EXECUTED` | No | Submitted onchain |
| `STATE_MINED` | No | Included in a block |
| `STATE_CONFIRMED` | Yes | Finalized successfully |
| `STATE_FAILED` | Yes | Failed permanently |
| `STATE_INVALID` | Yes | Rejected as invalid |

## Batch Limits

| Operation | Max per Request |
|-----------|----------------|
| Place orders | 15 |
| Cancel orders | Unlimited (cancel all) |
| Batch orderbook queries | 500 tokens |

## Sports Market Rules

- Outstanding limit orders are auto-cancelled when game begins.
- Marketable orders have a 3-second placement delay.
- Game start times can shift. Monitor accordingly.

## Balance Constraints

```
maxOrderSize = balance - sum(openOrderSize - filledAmount)
```

- **BUY**: Requires USDC allowance >= spending amount on the exchange contract.
- **SELL**: Requires conditional token allowance >= selling amount on the exchange contract.
