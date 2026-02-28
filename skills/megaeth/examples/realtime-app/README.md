# Real-Time On-Chain App with MegaETH

MegaETH's `eth_sendRawTransactionSync` (EIP-7966) returns a full transaction receipt in under 10ms, eliminating the need to poll for confirmations. Combined with sub-millisecond block times via mini-blocks, this enables real-time on-chain applications.

## When to Use This Pattern

- On-chain order books that need instant confirmation
- Real-time game state committed to chain
- Interactive UIs where users expect immediate feedback after signing
- High-frequency data feeds that write to contract state

## Chain Definition

```typescript
import {
  defineChain,
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type TransactionReceipt,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const megaeth = defineChain({
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://mega.etherscan.io' },
  },
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: megaeth, transport: http() });
const walletClient = createWalletClient({ account, chain: megaeth, transport: http() });
```

## Synchronous Transaction Submission

Two equivalent RPC methods exist. `eth_sendRawTransactionSync` (EIP-7966) is preferred for cross-chain compatibility.

```typescript
async function sendSyncTransaction(
  to: Address,
  value: bigint,
  data: `0x${string}` = '0x'
): Promise<TransactionReceipt> {
  // MegaETH intrinsic gas is 60K, not 21K
  const gasLimit = data === '0x' ? 60_000n : 200_000n;

  const signedTx = await walletClient.signTransaction({
    to,
    value,
    data,
    gas: gasLimit,
    maxFeePerGas: 1_000_000n,
    maxPriorityFeePerGas: 0n,
  });

  const receipt = await walletClient.request({
    method: 'eth_sendRawTransactionSync' as 'eth_sendRawTransaction',
    params: [signedTx],
  });

  return receipt as unknown as TransactionReceipt;
}
```

## Real-Time Contract Interaction

### Contract: On-Chain Order Book

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract OrderBook {
    error OrderBook__InvalidPrice();
    error OrderBook__InvalidAmount();
    error OrderBook__Unauthorized();

    struct Order {
        address maker;
        uint128 price;
        uint128 amount;
        bool isBuy;
    }

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed maker,
        uint128 price,
        uint128 amount,
        bool isBuy
    );
    event OrderCancelled(uint256 indexed orderId);
    event OrderFilled(
        uint256 indexed orderId,
        address indexed taker,
        uint128 filledAmount
    );

    /// @dev Circular buffer to reuse storage slots (MegaETH SSTORE optimization)
    uint256 private constant MAX_ORDERS = 1000;
    Order[1000] public orders;
    uint256 public nextOrderId;

    /// @notice Place a new order, reusing an existing storage slot
    /// @param price Order price in base units
    /// @param amount Order amount in base units
    /// @param isBuy True for buy order, false for sell
    /// @return orderId The ID of the placed order
    function placeOrder(
        uint128 price,
        uint128 amount,
        bool isBuy
    ) external returns (uint256 orderId) {
        if (price == 0) revert OrderBook__InvalidPrice();
        if (amount == 0) revert OrderBook__InvalidAmount();

        orderId = nextOrderId;
        // Circular index reuses existing storage slots -- avoids 2M+ gas SSTORE penalty
        uint256 slot = orderId % MAX_ORDERS;

        orders[slot] = Order({
            maker: msg.sender,
            price: price,
            amount: amount,
            isBuy: isBuy
        });
        nextOrderId = orderId + 1;

        emit OrderPlaced(orderId, msg.sender, price, amount, isBuy);
    }

    /// @notice Cancel an order
    /// @param orderId The order to cancel
    function cancelOrder(uint256 orderId) external {
        uint256 slot = orderId % MAX_ORDERS;
        if (orders[slot].maker != msg.sender) revert OrderBook__Unauthorized();

        // Reset to zero values -- slot stays allocated for reuse
        delete orders[slot];
        emit OrderCancelled(orderId);
    }
}
```

### TypeScript: Instant Order Placement

```typescript
import { encodeFunctionData, parseAbi, type Address } from 'viem';

const ORDER_BOOK_ADDRESS: Address = '0x...'; // deployed OrderBook address

const orderBookAbi = parseAbi([
  'function placeOrder(uint128 price, uint128 amount, bool isBuy) external returns (uint256)',
  'function cancelOrder(uint256 orderId) external',
  'event OrderPlaced(uint256 indexed orderId, address indexed maker, uint128 price, uint128 amount, bool isBuy)',
]);

async function placeOrderInstant(
  price: bigint,
  amount: bigint,
  isBuy: boolean
): Promise<{ orderId: bigint; receipt: unknown }> {
  const data = encodeFunctionData({
    abi: orderBookAbi,
    functionName: 'placeOrder',
    args: [price, amount, isBuy],
  });

  const signedTx = await walletClient.signTransaction({
    to: ORDER_BOOK_ADDRESS,
    data,
    gas: 200_000n,
    maxFeePerGas: 1_000_000n,
    maxPriorityFeePerGas: 0n,
  });

  const receipt = await walletClient.request({
    method: 'eth_sendRawTransactionSync' as 'eth_sendRawTransaction',
    params: [signedTx],
  });

  return { orderId: 0n, receipt };
}
```

## Mini-Block Subscriptions

Mini-blocks are MegaETH's sub-second block units. Subscribe via WebSocket for real-time block data.

```typescript
function subscribeMiniBlocks(
  onMiniBlock: (data: unknown) => void,
  onError: (error: Error) => void
): () => void {
  const ws = new WebSocket('wss://mainnet.megaeth.com/ws');

  ws.onopen = () => {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_subscribe',
      params: ['miniBlocks'],
      id: 1,
    }));
  };

  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data as string);
      if (parsed.params?.result) {
        onMiniBlock(parsed.params.result);
      }
    } catch (err) {
      onError(new Error(`Failed to parse mini-block: ${(err as Error).message}`));
    }
  };

  ws.onerror = (event) => {
    onError(new Error(`WebSocket error: ${String(event)}`));
  };

  // Keepalive: MegaETH drops idle connections
  const keepalive = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: Date.now(),
      }));
    }
  }, 30_000);

  return () => {
    clearInterval(keepalive);
    ws.close();
  };
}
```

## High-Precision Timestamps

`block.timestamp` has 1-second granularity. For microsecond precision, use the predeployed timestamp oracle.

```solidity
interface ITimestampOracle {
    function timestamp() external view returns (uint256);
}

// Predeployed at this address on MegaETH mainnet
ITimestampOracle constant TIMESTAMP_ORACLE =
    ITimestampOracle(0x6342000000000000000000000000000000000002);
```

```typescript
const timestampOracleAbi = parseAbi([
  'function timestamp() external view returns (uint256)',
]);

const TIMESTAMP_ORACLE: Address = '0x6342000000000000000000000000000000000002';

async function getHighPrecisionTimestamp(): Promise<bigint> {
  const timestamp = await publicClient.readContract({
    address: TIMESTAMP_ORACLE,
    abi: timestampOracleAbi,
    functionName: 'timestamp',
  });
  return timestamp;
}
```

## Comparison: Sync vs Async Transaction Flow

| Aspect | eth_sendRawTransaction (standard) | eth_sendRawTransactionSync (MegaETH) |
|--------|-----------------------------------|---------------------------------------|
| Returns | Transaction hash | Full transaction receipt |
| Confirmation | Poll via getTransactionReceipt | Immediate (< 10ms) |
| UX latency | 1-12 seconds (depends on chain) | < 10ms |
| Use case | Fire-and-forget | Real-time interactive apps |

## Common Pitfalls

1. **Polling for receipts** -- Do not use `waitForTransactionReceipt` when `eth_sendRawTransactionSync` is available. Polling adds unnecessary latency on a chain that confirms in milliseconds.

2. **Opening per-user WebSocket connections** -- Never create one WebSocket per frontend user. Use a single server-side connection and broadcast to connected clients via your application layer.

3. **Mini-blocks are ephemeral** -- Mini-blocks cannot be fetched via RPC after they are assembled into regular blocks. If you need mini-block data, you must subscribe and capture it in real time.

4. **WebSocket connection limits** -- MegaETH enforces 50 connections per VIP endpoint and 10 subscriptions per connection. Design your subscription architecture around these limits.
