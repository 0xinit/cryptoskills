# Vertex Product List

Available products on Vertex Protocol with their IDs, types, and trading pairs.

Last verified: February 2026

## Product ID Convention

- **Product 0**: USDC — the quote asset. Cannot be traded on a spot market, used as collateral only.
- **Odd IDs**: Spot products (1, 3, 5, 7, ...). Trade the underlying asset against USDC.
- **Even IDs**: Perpetual products (2, 4, 6, 8, ...). Trade perpetual contracts settled in USDC.

Each spot/perp pair shares a **health group** — their margin is calculated together.

## Core Products

| Product ID | Type | Symbol | Pair | Health Group | Min Size |
|------------|------|--------|------|-------------|----------|
| 0 | Quote | USDC | — | — | — |
| 1 | Spot | wBTC | wBTC/USDC | BTC | 0.001 BTC |
| 2 | Perp | BTC-PERP | BTC-PERP/USDC | BTC | 0.001 BTC |
| 3 | Spot | wETH | wETH/USDC | ETH | 0.01 ETH |
| 4 | Perp | ETH-PERP | ETH-PERP/USDC | ETH | 0.01 ETH |

## Extended Products

| Product ID | Type | Symbol | Pair | Health Group |
|------------|------|--------|------|-------------|
| 5 | Spot | wARB | wARB/USDC | ARB |
| 6 | Perp | ARB-PERP | ARB-PERP/USDC | ARB |
| 7 | Spot | wOP | wOP/USDC | OP |
| 8 | Perp | OP-PERP | OP-PERP/USDC | OP |
| 9 | Spot | wMATIC | wMATIC/USDC | MATIC |
| 10 | Perp | MATIC-PERP | MATIC-PERP/USDC | MATIC |
| 11 | Spot | wBNB | wBNB/USDC | BNB |
| 12 | Perp | BNB-PERP | BNB-PERP/USDC | BNB |
| 31 | Spot | wSOL | wSOL/USDC | SOL |
| 32 | Perp | SOL-PERP | SOL-PERP/USDC | SOL |
| 33 | Spot | COMP | COMP/USDC | COMP |
| 34 | Perp | COMP-PERP | COMP-PERP/USDC | COMP |

## Querying Products at Runtime

Product availability varies by chain. Always query the current list dynamically:

```python
from vertex_protocol.client import create_vertex_client, VertexClientMode

client = create_vertex_client(VertexClientMode.MAINNET, private_key)
products = client.context.engine_client.get_all_products()

print("=== Spot Products ===")
for spot in products.spot_products:
    print(f"  ID={spot.product_id} book={spot.book_info}")

print("\n=== Perp Products ===")
for perp in products.perp_products:
    print(f"  ID={perp.product_id} book={perp.book_info}")
```

### Query via REST API

```bash
curl -s https://gateway.prod.vertexprotocol.com/v1/query \
  -H "Content-Type: application/json" \
  -d '{"type": "all_products"}' | python -m json.tool
```

### Query Symbols Mapping

```bash
curl -s https://gateway.prod.vertexprotocol.com/v1/query \
  -H "Content-Type: application/json" \
  -d '{"type": "symbols"}' | python -m json.tool
```

## Product Configuration Fields

Each product returned by `all_products` includes:

| Field | Description |
|-------|-------------|
| `product_id` | Numeric ID used in all API calls |
| `oracle_price_x18` | Current oracle price (x18 fixed-point) |
| `risk.long_weight_initial` | Initial margin weight for longs (lower = more leverage allowed) |
| `risk.short_weight_initial` | Initial margin weight for shorts |
| `risk.long_weight_maintenance` | Maintenance margin weight for longs |
| `risk.short_weight_maintenance` | Maintenance margin weight for shorts |
| `book_info.size_increment` | Minimum order size increment |
| `book_info.price_increment_x18` | Minimum price tick (x18) |
| `book_info.min_size` | Absolute minimum order size |
| `book_info.lp_spread_x18` | AMM LP spread |

## Health Groups

A health group ties a spot product to its corresponding perp product. Within a group:

- Long spot + short perp = basis trade (lower margin requirement)
- Health is calculated across both products simultaneously
- Liquidation considers the combined position

## Cross-Chain Product Availability

Vertex Edge unifies liquidity across chains, but product availability can differ:

| Chain | Available Products |
|-------|-------------------|
| Arbitrum | All products (primary chain) |
| Base | Major pairs (BTC, ETH, SOL, ARB) |
| Mantle | Major pairs |
| Sei | Major pairs |
| Blast | Major pairs |
| Sonic | Major pairs |

Always query `all_products` on the specific chain's gateway to confirm availability.

## Fee Tiers

Fees are per-subaccount based on 30-day volume:

| 30d Volume (USDC) | Maker Fee | Taker Fee |
|-------------------|-----------|-----------|
| < $1M | 0.00% | 0.02% |
| $1M - $5M | 0.00% | 0.018% |
| $5M - $10M | 0.00% | 0.016% |
| $10M - $50M | 0.00% | 0.014% |
| > $50M | -0.001% (rebate) | 0.012% |

Query your current fee rate:

```python
fees = client.context.engine_client.get_fee_rates(
    sender=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    )
)
print(f"Maker: {fees.maker_fee_rate}, Taker: {fees.taker_fee_rate}")
```
