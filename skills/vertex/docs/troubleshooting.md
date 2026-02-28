# Vertex Troubleshooting

Common issues and fixes when integrating with the Vertex Protocol Python SDK and API.

Last verified: February 2026

## Wrong Package Installed

**Symptoms:**

```
ModuleNotFoundError: No module named 'vertex_protocol'
```

Or importing `vertex` gives unrelated functionality.

**Solutions:**

1. The correct package is `vertex-protocol`, not `vertex`:
   ```bash
   pip install vertex-protocol
   ```

2. If you have the wrong package installed, remove it first:
   ```bash
   pip uninstall vertex
   pip install vertex-protocol
   ```

3. Verify the import works:
   ```python
   from vertex_protocol.client import create_vertex_client
   ```

## Orders Rejected with "invalid nonce"

**Symptoms:**

Orders fail with `{"status": "failure", "error": "invalid nonce"}` despite using unique values.

**Solutions:**

1. Do not use sequential integers as nonces. Vertex nonces encode a timestamp. Use the SDK helper:
   ```python
   from vertex_protocol.utils.nonce import gen_order_nonce
   nonce = gen_order_nonce()
   ```

2. If constructing nonces manually, they must be millisecond timestamps multiplied by a factor to ensure uniqueness. The SDK's implementation is the reference.

3. Ensure you are not reusing a nonce from a previously placed or cancelled order.

## Orders Rejected with "invalid signature"

**Symptoms:**

Every execute call returns `{"status": "failure", "error": "invalid signature"}`.

**Solutions:**

1. Verify the private key matches the `subaccount_owner` address:
   ```python
   from eth_account import Account
   account = Account.from_key(private_key)
   print(f"Address: {account.address}")
   ```
   This must match the address used in `SubaccountParams`.

2. Check the chain ID. Each chain has a different EIP-712 domain. Connecting to the Arbitrum gateway with Base credentials (or vice versa) produces invalid signatures. Use the correct `VertexClientMode`.

3. If using a linked signer, confirm the link is still active:
   ```python
   linked = client.context.engine_client.get_linked_signer(
       subaccount=SubaccountParams(
           subaccount_owner=main_address,
           subaccount_name="default",
       )
   )
   print(f"Linked signer: {linked.linked_signer}")
   ```

4. The `sender` field in raw API calls must be a `bytes32` — 20-byte address + 12-byte subaccount name. An empty name is 12 zero bytes, not an empty string. Use `subaccount_to_bytes32()`.

## x18 Conversion Errors

**Symptoms:**

Orders placed at nonsensical prices (e.g., buying BTC at $0.00006 or $65,000,000,000). Amounts filled are astronomically wrong.

**Solutions:**

1. All prices and amounts use x18 fixed-point. To set a price of $65,000:
   ```python
   from vertex_protocol.utils.math import to_x18
   price = to_x18(65000)  # 65000 * 10^18
   ```

2. For amounts, be aware of the difference between `to_x18` and `to_pow_10`:
   ```python
   from vertex_protocol.utils.math import to_pow_10
   # 0.1 ETH = 1 * 10^17
   amount = to_pow_10(1, 17)
   # NOT to_x18(0.1) — floating point can introduce precision errors
   ```

3. On-chain deposit amounts use the token's native decimals (6 for USDC), not x18. The sequencer uses x18 internally.

## Deposits Not Appearing

**Symptoms:**

On-chain deposit transaction succeeded but the balance in the subaccount shows zero.

**Solutions:**

1. Deposits require token approval before the deposit call:
   ```python
   client.spot.approve_allowance(product_id=0, amount=amount)
   client.spot.deposit(DepositCollateralParams(...))
   ```

2. Wait for the deposit to be processed by the sequencer. This typically takes 1-3 blocks on the origin chain.

3. Verify you deposited to the correct subaccount name. The default subaccount is `""` (empty string) or `"default"` — these produce different bytes32 identifiers.

4. Check the deposit transaction on the block explorer. Confirm the Endpoint contract received the tokens. The contract addresses can be queried:
   ```python
   contracts = client.context.engine_client.get_contracts()
   print(f"Endpoint: {contracts.endpoint}")
   print(f"Clearinghouse: {contracts.clearinghouse}")
   ```

## WebSocket Connection Drops

**Symptoms:**

WebSocket connections close unexpectedly after 30-60 seconds of inactivity, or during high-traffic periods.

**Solutions:**

1. Implement automatic reconnection:
   ```python
   def on_close(ws, code, msg):
       print(f"Closed ({code}), reconnecting...")
       time.sleep(2)
       create_connection()
   ```

2. Send periodic ping frames to keep the connection alive. The `websocket-client` library handles this by default, but some environments may need explicit configuration.

3. Use the correct endpoint — subscriptions go to `/v1/subscribe`, not `/v1/ws`:
   - Gateway WS (`/v1/ws`): for executes and queries via WebSocket
   - Subscription WS (`/v1/subscribe`): for streaming data (BBO, trades, fills)

4. Rate-limit your subscriptions. Subscribing to the same stream multiple times wastes connection slots (limit: 10 per connection).

## "insufficient health" on Small Orders

**Symptoms:**

Even small orders fail with `insufficient health for order` despite having collateral.

**Solutions:**

1. Check both initial and maintenance health:
   ```python
   info = client.context.engine_client.get_subaccount_info(
       subaccount=SubaccountParams(
           subaccount_owner=owner,
           subaccount_name="default",
       )
   )
   print(f"Initial: {info.healths.initial.health}")
   print(f"Maintenance: {info.healths.maintenance.health}")
   ```

2. Initial health includes a buffer above maintenance. New orders require positive initial health, which is stricter than maintenance health.

3. Existing positions may be consuming most of your margin. Use `max_order_size` to check what you can actually order:
   ```python
   max_size = client.context.engine_client.get_max_order_size(
       sender=SubaccountParams(
           subaccount_owner=owner,
           subaccount_name="default",
       ),
       product_id=2,
       price=to_x18(65000),
       direction="long",
   )
   print(f"Max order size: {max_size}")
   ```

4. If you have borrows (negative spot balances), those reduce your health. Repay borrows or add collateral.

## Trigger Orders Not Executing

**Symptoms:**

Stop-loss or take-profit trigger orders were placed successfully but never execute when the price condition is met.

**Solutions:**

1. Verify the trigger is active:
   ```python
   import requests
   resp = requests.post(
       "https://trigger.prod.vertexprotocol.com/v1/execute",
       json={"list_trigger_orders": {"sender": sender_bytes32, "product_id": 2}},
   )
   print(resp.json())
   ```

2. Trigger orders check the oracle price, not the last trade price. The oracle and market prices can diverge during volatility.

3. The order itself must still be valid when triggered — if the expiration has passed, the trigger fires but the order fails. Set long expirations on trigger orders (e.g., 30 days).

4. Ensure you set exactly one of `price_above` or `price_below`, not both. The other must be `null`.

## Cross-Chain (Vertex Edge) Issues

**Symptoms:**

Orders placed on one chain do not appear to match against liquidity from other chains, or deposits on Base are not reflected when querying Arbitrum.

**Solutions:**

1. Each chain has its own gateway, indexer, and contract set. Connect to the correct chain's endpoints.

2. Vertex Edge unifies the orderbook at the sequencer level — you do not need to interact with multiple chains. Place orders on your origin chain and the sequencer matches them cross-chain.

3. Subaccounts are chain-specific. Depositing USDC on Arbitrum creates a subaccount on Arbitrum. To trade on Base, deposit on Base (or use cross-chain deposits if available).

4. Product IDs may differ across chains. Always query `all_products` on the target chain.
