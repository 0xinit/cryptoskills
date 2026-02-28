# Money Market (Lend/Borrow) on Vertex

Complete example of depositing collateral to earn lending yield, borrowing against your portfolio, and monitoring interest rates.

## How It Works

Vertex's money market is embedded — there are no separate "lend" or "borrow" actions:

- **Lending**: Any positive spot balance earns the deposit interest rate automatically.
- **Borrowing**: When your spot balance for an asset goes negative (by selling what you don't hold, or via `withdraw_collateral` that takes you negative), you pay the borrow rate. Your cross-margin health must remain positive.

## Prerequisites

```bash
pip install vertex-protocol
```

## Full Example: Deposit and Earn

```python
import os
from vertex_protocol.client import create_vertex_client, VertexClientMode
from vertex_protocol.contracts.types import DepositCollateralParams
from vertex_protocol.utils.math import to_pow_10
from vertex_protocol.utils.subaccount import SubaccountParams

private_key = os.environ["VERTEX_PRIVATE_KEY"]
client = create_vertex_client(VertexClientMode.MAINNET, private_key)
owner = client.context.engine_client.signer.address

USDC_PRODUCT_ID = 0
WETH_SPOT_PRODUCT_ID = 3

# Step 1: Approve USDC spending
approve_tx = client.spot.approve_allowance(
    product_id=USDC_PRODUCT_ID,
    amount=to_pow_10(10_000, 6),  # 10,000 USDC (6 decimals on-chain)
)
print(f"Approval tx: {approve_tx}")

# Step 2: Deposit 10,000 USDC
deposit_tx = client.spot.deposit(
    DepositCollateralParams(
        subaccount_name="default",
        product_id=USDC_PRODUCT_ID,
        amount=to_pow_10(10_000, 6),
    )
)
print(f"Deposit tx: {deposit_tx}")

# Step 3: Check balance — USDC now earns interest automatically
info = client.context.engine_client.get_subaccount_info(
    subaccount=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    )
)
for balance in info.spot_balances:
    if balance.product_id == USDC_PRODUCT_ID:
        print(f"USDC balance: {balance.balance.amount}")
        print(f"USDC is earning deposit interest automatically")
```

## Check Current Interest Rates

```python
products = client.context.engine_client.get_all_products()

print("=== Spot Product Interest Rates ===")
for spot in products.spot_products:
    pid = spot.product_id
    config = spot.product
    print(
        f"Product {pid}: "
        f"long_weight_initial={config.long_weight_initial}, "
        f"short_weight_initial={config.short_weight_initial}"
    )
```

## Implicit Borrowing via Spot Selling

When you sell a spot asset you don't hold, the balance goes negative — this is an implicit borrow:

```python
import time
from vertex_protocol.engine_client.types.execute import (
    PlaceOrderParams,
    OrderParams,
)
from vertex_protocol.utils.math import to_x18, to_pow_10
from vertex_protocol.utils.nonce import gen_order_nonce
from vertex_protocol.utils.expiration import get_expiration_timestamp, OrderType

# Sell 1 wETH you don't hold — creates a borrow position
# You must have sufficient USDC (or other collateral) to maintain health
sell_order = OrderParams(
    sender=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    ),
    priceX18=to_x18(2500),
    amount=-to_pow_10(1, 18),  # sell 1 wETH
    expiration=get_expiration_timestamp(OrderType.IOC, int(time.time()) + 60),
    nonce=gen_order_nonce(),
)

res = client.market.place_order(
    PlaceOrderParams(product_id=WETH_SPOT_PRODUCT_ID, order=sell_order)
)
print(f"Spot sell (borrow) order: {res.digest}")

# Check resulting position — wETH balance should be negative (borrowed)
info = client.context.engine_client.get_subaccount_info(
    subaccount=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    )
)
for balance in info.spot_balances:
    if balance.product_id == WETH_SPOT_PRODUCT_ID:
        amount = float(balance.balance.amount)
        if amount < 0:
            print(f"Borrowed wETH: {abs(amount)} (paying borrow rate)")
        else:
            print(f"wETH deposit: {amount} (earning deposit rate)")
```

## Repay a Borrow

To repay, buy back the borrowed asset or deposit it directly:

```python
# Option 1: Buy back the borrowed wETH on spot market
repay_order = OrderParams(
    sender=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    ),
    priceX18=to_x18(2600),
    amount=to_pow_10(1, 18),  # buy 1 wETH to close borrow
    expiration=get_expiration_timestamp(OrderType.IOC, int(time.time()) + 60),
    nonce=gen_order_nonce(),
)

res = client.market.place_order(
    PlaceOrderParams(product_id=WETH_SPOT_PRODUCT_ID, order=repay_order)
)
print(f"Repay order: {res.digest}")
```

## Check Interest and Funding History

```python
payments = client.context.indexer_client.get_interest_and_funding_payments(
    subaccount=SubaccountParams(
        subaccount_owner=owner,
        subaccount_name="default",
    ),
    product_ids=[0, 3],  # USDC and wETH
    limit=20,
)

for payment in payments:
    print(
        f"Product {payment.product_id}: "
        f"amount={payment.amount}, "
        f"timestamp={payment.timestamp}"
    )
```

## Key Points

- No explicit "lend" or "borrow" actions — it is all implicit based on spot balances
- Positive spot balance = earning deposit interest
- Negative spot balance = paying borrow interest
- Interest accrues continuously and is reflected in your balance
- Cross-margin health must stay positive — all positions (spot, perps, borrows) contribute
- Deposit on-chain via the Endpoint contract (requires token approval)
- Withdrawals are signed executes processed by the sequencer — not direct on-chain calls
- Borrow rates are variable and determined by utilization (higher utilization = higher rate)
