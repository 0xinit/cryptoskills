# Event Watching and Filtering

Examples for real-time event watching, historical log queries, and event parsing with viem.

## Setup

```typescript
import {
  createPublicClient,
  http,
  webSocket,
  parseAbiItem,
  formatUnits,
} from "viem";
import { mainnet } from "viem/chains";

// WebSocket transport is recommended for event watching
const client = createPublicClient({
  chain: mainnet,
  transport: webSocket(process.env.WS_URL),
});

// HTTP client for historical queries
const httpClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

const transferEvent = {
  name: "Transfer",
  type: "event",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

const approvalEvent = {
  name: "Approval",
  type: "event",
  inputs: [
    { name: "owner", type: "address", indexed: true },
    { name: "spender", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

const erc20EventsAbi = [transferEvent, approvalEvent] as const;
```

## Watch Contract Events in Real Time

```typescript
const unwatch = client.watchContractEvent({
  address: USDC,
  abi: erc20EventsAbi,
  eventName: "Transfer",
  onLogs: (logs) => {
    for (const log of logs) {
      console.log(`Transfer: ${log.args.from} -> ${log.args.to}`);
      console.log(`  Amount: ${formatUnits(log.args.value!, 6)} USDC`);
      console.log(`  Block: ${log.blockNumber}`);
    }
  },
});

// Stop watching when done
unwatch();
```

## Filter by Indexed Parameters

Indexed parameters allow server-side filtering. Only `indexed` fields can be filtered.

```typescript
// Watch transfers TO a specific address
const unwatch = client.watchContractEvent({
  address: USDC,
  abi: erc20EventsAbi,
  eventName: "Transfer",
  args: {
    to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  },
  onLogs: (logs) => {
    for (const log of logs) {
      console.log(`Received ${formatUnits(log.args.value!, 6)} USDC from ${log.args.from}`);
    }
  },
});

// Watch transfers FROM a specific address
const unwatchFrom = client.watchContractEvent({
  address: USDC,
  abi: erc20EventsAbi,
  eventName: "Transfer",
  args: {
    from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  },
  onLogs: (logs) => {
    for (const log of logs) {
      console.log(`Sent ${formatUnits(log.args.value!, 6)} USDC to ${log.args.to}`);
    }
  },
});
```

## Get Historical Logs

```typescript
const logs = await httpClient.getContractEvents({
  address: USDC,
  abi: erc20EventsAbi,
  eventName: "Transfer",
  fromBlock: 18000000n,
  toBlock: 18001000n,
});

for (const log of logs) {
  console.log(`Block ${log.blockNumber}: ${log.args.from} -> ${log.args.to}: ${log.args.value}`);
}
```

## Historical Logs with parseAbiItem

For one-off queries, `parseAbiItem` avoids defining a full ABI.

```typescript
const logs = await httpClient.getLogs({
  address: USDC,
  event: parseAbiItem(
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ),
  args: {
    to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  },
  fromBlock: 18000000n,
  toBlock: 18001000n,
});

for (const log of logs) {
  console.log(log.args.from, "->", log.args.to, ":", log.args.value);
}
```

## Parse Event Logs from Transaction Receipt

```typescript
import { decodeEventLog } from "viem";

const receipt = await httpClient.getTransactionReceipt({
  hash: "0x...",
});

for (const log of receipt.logs) {
  try {
    const decoded = decodeEventLog({
      abi: erc20EventsAbi,
      data: log.data,
      topics: log.topics,
    });

    if (decoded.eventName === "Transfer") {
      console.log(`Transfer: ${decoded.args.from} -> ${decoded.args.to}`);
      console.log(`Amount: ${decoded.args.value}`);
    }
  } catch {
    // Log does not match this ABI -- skip
  }
}
```

## Block Range Queries

RPC providers typically limit `getLogs` to a range of 2,000-10,000 blocks. Paginate for larger ranges.

```typescript
async function getLogsInRange(
  fromBlock: bigint,
  toBlock: bigint,
  maxRange = 2000n
): Promise<typeof logs> {
  const logs = [];
  let currentFrom = fromBlock;

  while (currentFrom <= toBlock) {
    const currentTo =
      currentFrom + maxRange - 1n > toBlock
        ? toBlock
        : currentFrom + maxRange - 1n;

    const batch = await httpClient.getLogs({
      address: USDC,
      event: parseAbiItem(
        "event Transfer(address indexed from, address indexed to, uint256 value)"
      ),
      fromBlock: currentFrom,
      toBlock: currentTo,
    });

    logs.push(...batch);
    currentFrom = currentTo + 1n;
  }

  return logs;
}

const allLogs = await getLogsInRange(18000000n, 18010000n);
console.log(`Found ${allLogs.length} transfers`);
```

## Unsubscribing and Cleanup

```typescript
const watchers: (() => void)[] = [];

watchers.push(
  client.watchContractEvent({
    address: USDC,
    abi: erc20EventsAbi,
    eventName: "Transfer",
    onLogs: (logs) => {
      console.log(`${logs.length} transfer(s)`);
    },
  })
);

watchers.push(
  client.watchContractEvent({
    address: USDC,
    abi: erc20EventsAbi,
    eventName: "Approval",
    onLogs: (logs) => {
      console.log(`${logs.length} approval(s)`);
    },
  })
);

// Clean up all watchers
function cleanup() {
  for (const unwatch of watchers) {
    unwatch();
  }
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
```

## Watch All Events (No Filter)

```typescript
const unwatch = client.watchEvent({
  onLogs: (logs) => {
    for (const log of logs) {
      console.log(`Block ${log.blockNumber} | ${log.address} | ${log.topics[0]}`);
    }
  },
});
```
