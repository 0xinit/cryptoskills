# Listen to Events with ethers.js v6

Subscribe to real-time events, query historical logs, build event filters, and parse log data. WebSocketProvider is required for real-time subscriptions; JsonRpcProvider works for historical queries.

## Setup

```typescript
import {
  JsonRpcProvider,
  WebSocketProvider,
  Contract,
  Interface,
  Log,
  formatUnits,
} from "ethers";

const RPC_URL = process.env.RPC_URL;
const WS_URL = process.env.WS_URL;
if (!RPC_URL) throw new Error("RPC_URL required");
```

## ERC-20 Transfer Events (Real-Time)

Requires a WebSocket provider for persistent subscriptions.

```typescript
function watchTransfers(wsUrl: string, tokenAddress: string): WebSocketProvider {
  const provider = new WebSocketProvider(wsUrl);

  const abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ];

  const token = new Contract(tokenAddress, abi, provider);

  token.on("Transfer", (from: string, to: string, value: bigint, event) => {
    console.log(`Transfer: ${from} -> ${to}: ${value}`);
    console.log(`  Block: ${event.log.blockNumber}`);
    console.log(`  TX: ${event.log.transactionHash}`);
  });

  return provider;
}
```

## New Block Subscription

```typescript
function watchBlocks(wsUrl: string): WebSocketProvider {
  const provider = new WebSocketProvider(wsUrl);

  provider.on("block", async (blockNumber: number) => {
    const block = await provider.getBlock(blockNumber);
    if (!block) return;

    console.log(`Block ${blockNumber}: ${block.transactions.length} txs, base fee ${block.baseFeePerGas}`);
  });

  return provider;
}
```

## Pending Transactions (Mempool)

```typescript
function watchPendingTransactions(wsUrl: string): WebSocketProvider {
  const provider = new WebSocketProvider(wsUrl);

  provider.on("pending", (txHash: string) => {
    console.log(`Pending TX: ${txHash}`);
  });

  return provider;
}
```

## Query Historical Events

Use JsonRpcProvider to query past events within a block range.

```typescript
async function queryPastTransfers(
  tokenAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<Array<{ from: string; to: string; value: bigint; blockNumber: number }>> {
  const provider = new JsonRpcProvider(RPC_URL);

  const abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ];

  const token = new Contract(tokenAddress, abi, provider);

  const events = await token.queryFilter("Transfer", fromBlock, toBlock);

  return events.map((event) => {
    if (!event.args) throw new Error("Event missing args");
    return {
      from: event.args[0] as string,
      to: event.args[1] as string,
      value: event.args[2] as bigint,
      blockNumber: event.blockNumber,
    };
  });
}
```

## Filtered Event Queries

### Filter by Sender

```typescript
async function getTransfersFrom(
  tokenAddress: string,
  sender: string,
  fromBlock: number,
  toBlock: number
): Promise<Array<{ to: string; value: bigint; blockNumber: number }>> {
  const provider = new JsonRpcProvider(RPC_URL);

  const abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ];

  const token = new Contract(tokenAddress, abi, provider);

  // First argument to filters.Transfer is the indexed "from" parameter
  const filter = token.filters.Transfer(sender);
  const events = await token.queryFilter(filter, fromBlock, toBlock);

  return events.map((event) => {
    if (!event.args) throw new Error("Event missing args");
    return {
      to: event.args[1] as string,
      value: event.args[2] as bigint,
      blockNumber: event.blockNumber,
    };
  });
}
```

### Filter by Recipient

```typescript
async function getTransfersTo(
  tokenAddress: string,
  recipient: string,
  fromBlock: number,
  toBlock: number
): Promise<Array<{ from: string; value: bigint; blockNumber: number }>> {
  const provider = new JsonRpcProvider(RPC_URL);

  const abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ];

  const token = new Contract(tokenAddress, abi, provider);

  // null for "from" means any sender; second arg filters indexed "to"
  const filter = token.filters.Transfer(null, recipient);
  const events = await token.queryFilter(filter, fromBlock, toBlock);

  return events.map((event) => {
    if (!event.args) throw new Error("Event missing args");
    return {
      from: event.args[0] as string,
      value: event.args[2] as bigint,
      blockNumber: event.blockNumber,
    };
  });
}
```

## Parse Raw Logs with Interface

When you have raw logs (e.g., from a transaction receipt) and need to decode them manually.

```typescript
function parseRawLogs(logs: ReadonlyArray<Log>): Array<{
  name: string;
  args: Record<string, unknown>;
}> {
  const iface = new Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
  ]);

  const parsed: Array<{ name: string; args: Record<string, unknown> }> = [];

  for (const log of logs) {
    try {
      const description = iface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });

      if (description) {
        const args: Record<string, unknown> = {};
        for (const key of Object.keys(description.args)) {
          // Skip numeric indices, keep named keys only
          if (isNaN(Number(key))) {
            args[key] = description.args[key];
          }
        }
        parsed.push({ name: description.name, args });
      }
    } catch {
      // Log does not match any known event signature -- skip
      continue;
    }
  }

  return parsed;
}
```

## Watch for Large Transfers

A practical example: monitor a token for transfers above a threshold.

```typescript
function watchLargeTransfers(
  wsUrl: string,
  tokenAddress: string,
  thresholdAmount: bigint,
  decimals: number,
  callback: (transfer: { from: string; to: string; value: bigint; txHash: string }) => void
): WebSocketProvider {
  const provider = new WebSocketProvider(wsUrl);

  const abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ];

  const token = new Contract(tokenAddress, abi, provider);

  token.on("Transfer", (from: string, to: string, value: bigint, event) => {
    if (value >= thresholdAmount) {
      callback({
        from,
        to,
        value,
        txHash: event.log.transactionHash,
      });
    }
  });

  return provider;
}
```

## Graceful Cleanup

Always remove listeners and destroy the provider when done.

```typescript
async function cleanupProvider(provider: WebSocketProvider): Promise<void> {
  provider.removeAllListeners();
  await provider.destroy();
}
```

## Paginated Historical Query

RPC providers often limit the block range for `queryFilter`. Paginate through large ranges in chunks.

```typescript
async function paginatedEventQuery(
  tokenAddress: string,
  fromBlock: number,
  toBlock: number,
  chunkSize: number = 2000
): Promise<Array<{ from: string; to: string; value: bigint; blockNumber: number }>> {
  const provider = new JsonRpcProvider(RPC_URL);

  const abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ];

  const token = new Contract(tokenAddress, abi, provider);

  const allEvents: Array<{ from: string; to: string; value: bigint; blockNumber: number }> = [];

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, toBlock);

    const events = await token.queryFilter("Transfer", start, end);

    for (const event of events) {
      if (!event.args) continue;
      allEvents.push({
        from: event.args[0] as string,
        to: event.args[1] as string,
        value: event.args[2] as bigint,
        blockNumber: event.blockNumber,
      });
    }

    console.log(`Fetched blocks ${start}-${end}: ${events.length} events`);
  }

  return allEvents;
}
```

## Complete Usage

```typescript
async function main() {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  // Historical query
  const provider = new JsonRpcProvider(RPC_URL);
  const currentBlock = await provider.getBlockNumber();

  const transfers = await queryPastTransfers(USDC, currentBlock - 100, currentBlock);
  console.log(`Found ${transfers.length} USDC transfers in last 100 blocks`);

  // Real-time (requires WS_URL)
  if (WS_URL) {
    const wsProvider = watchTransfers(WS_URL, USDC);
    console.log("Watching USDC transfers. Press Ctrl+C to stop.");

    // Cleanup on exit
    process.on("SIGINT", async () => {
      await cleanupProvider(wsProvider);
      process.exit(0);
    });
  }
}

main().catch(console.error);
```
