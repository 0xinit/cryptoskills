# Event Handler Examples

Advanced AssemblyScript event handler patterns for subgraphs covering factory contracts, multi-event aggregation, and derived entity updates.

## Uniswap V2 Factory Pattern

Index dynamically created contracts using data source templates.

### Schema

```graphql
type Factory @entity {
  id: Bytes!
  pairCount: BigInt!
  totalVolumeUSD: BigDecimal!
}

type Pair @entity {
  id: Bytes!
  token0: Bytes!
  token1: Bytes!
  reserve0: BigInt!
  reserve1: BigInt!
  totalSupply: BigInt!
  swapCount: BigInt!
  createdAtBlock: BigInt!
  createdAtTimestamp: BigInt!
}

type Swap @entity(immutable: true) {
  id: Bytes!
  pair: Pair!
  sender: Bytes!
  to: Bytes!
  amount0In: BigInt!
  amount1In: BigInt!
  amount0Out: BigInt!
  amount1Out: BigInt!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}
```

### Manifest with Template

```yaml
specVersion: 1.2.0
indexerHints:
  prune: auto
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: UniswapV2Factory
    network: mainnet
    source:
      address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
      abi: Factory
      startBlock: 10000835
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities:
        - Factory
        - Pair
      abis:
        - name: Factory
          file: ./abis/UniswapV2Factory.json
        - name: Pair
          file: ./abis/UniswapV2Pair.json
      eventHandlers:
        - event: PairCreated(indexed address,indexed address,address,uint256)
          handler: handlePairCreated
      file: ./src/factory.ts
templates:
  - kind: ethereum
    name: Pair
    network: mainnet
    source:
      abi: Pair
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities:
        - Pair
        - Swap
      abis:
        - name: Pair
          file: ./abis/UniswapV2Pair.json
      eventHandlers:
        - event: Swap(indexed address,uint256,uint256,uint256,uint256,indexed address)
          handler: handleSwap
        - event: Sync(uint112,uint112)
          handler: handleSync
      file: ./src/pair.ts
```

### Factory Handler

```typescript
// src/factory.ts
import { PairCreated } from "../generated/UniswapV2Factory/Factory";
import { Factory, Pair } from "../generated/schema";
import { Pair as PairTemplate } from "../generated/templates";
import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";

const FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const ZERO_BI = BigInt.fromI32(0);
const ZERO_BD = BigDecimal.fromString("0");
const ONE_BI = BigInt.fromI32(1);

export function handlePairCreated(event: PairCreated): void {
  let factory = Factory.load(event.address);
  if (factory == null) {
    factory = new Factory(event.address);
    factory.pairCount = ZERO_BI;
    factory.totalVolumeUSD = ZERO_BD;
  }
  factory.pairCount = factory.pairCount.plus(ONE_BI);
  factory.save();

  let pair = new Pair(event.params.pair);
  pair.token0 = event.params.token0;
  pair.token1 = event.params.token1;
  pair.reserve0 = ZERO_BI;
  pair.reserve1 = ZERO_BI;
  pair.totalSupply = ZERO_BI;
  pair.swapCount = ZERO_BI;
  pair.createdAtBlock = event.block.number;
  pair.createdAtTimestamp = event.block.timestamp;
  pair.save();

  // Start indexing events from the new pair contract
  PairTemplate.create(event.params.pair);
}
```

### Pair Handlers (Swap + Sync)

```typescript
// src/pair.ts
import {
  Swap as SwapEvent,
  Sync as SyncEvent,
} from "../generated/templates/Pair/Pair";
import { Pair, Swap } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

const ONE_BI = BigInt.fromI32(1);

export function handleSwap(event: SwapEvent): void {
  let pair = Pair.load(event.address);
  if (pair == null) return;

  pair.swapCount = pair.swapCount.plus(ONE_BI);
  pair.save();

  let swap = new Swap(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  swap.pair = pair.id;
  swap.sender = event.params.sender;
  swap.to = event.params.to;
  swap.amount0In = event.params.amount0In;
  swap.amount1In = event.params.amount1In;
  swap.amount0Out = event.params.amount0Out;
  swap.amount1Out = event.params.amount1Out;
  swap.blockNumber = event.block.number;
  swap.blockTimestamp = event.block.timestamp;
  swap.transactionHash = event.transaction.hash;
  swap.save();
}

export function handleSync(event: SyncEvent): void {
  let pair = Pair.load(event.address);
  if (pair == null) return;

  pair.reserve0 = event.params.reserve0;
  pair.reserve1 = event.params.reserve1;
  pair.save();
}
```

## Multi-Event Aggregation (Daily Snapshots)

Track daily volume and transaction counts using time-bucketed entities.

### Schema

```graphql
type DailySnapshot @entity {
  id: Bytes!
  date: Int!
  volumeTotal: BigInt!
  transferCount: BigInt!
  uniqueSenders: BigInt!
}
```

### Handler

```typescript
// src/snapshots.ts
import { Transfer as TransferEvent } from "../generated/ERC20/ERC20";
import { DailySnapshot } from "../generated/schema";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";

// 86400 seconds per day
const SECONDS_PER_DAY = 86400;
const ZERO = BigInt.fromI32(0);
const ONE = BigInt.fromI32(1);

function getDayId(timestamp: BigInt): i32 {
  return timestamp.toI32() / SECONDS_PER_DAY;
}

export function handleTransfer(event: TransferEvent): void {
  let dayId = getDayId(event.block.timestamp);
  let dayIdBytes = Bytes.fromI32(dayId);

  let snapshot = DailySnapshot.load(dayIdBytes);
  if (snapshot == null) {
    snapshot = new DailySnapshot(dayIdBytes);
    snapshot.date = dayId * SECONDS_PER_DAY;
    snapshot.volumeTotal = ZERO;
    snapshot.transferCount = ZERO;
    snapshot.uniqueSenders = ZERO;
  }

  snapshot.volumeTotal = snapshot.volumeTotal.plus(event.params.value);
  snapshot.transferCount = snapshot.transferCount.plus(ONE);
  snapshot.save();
}
```

## Handling Multiple Events from Same Contract

When a contract emits multiple event types, handle them in the same mapping file.

### Manifest (Multiple Event Handlers)

```yaml
eventHandlers:
  - event: Transfer(indexed address,indexed address,uint256)
    handler: handleTransfer
  - event: Approval(indexed address,indexed address,uint256)
    handler: handleApproval
  - event: OwnershipTransferred(indexed address,indexed address)
    handler: handleOwnershipTransferred
```

### Mapping

```typescript
// src/mapping.ts
import {
  Transfer as TransferEvent,
  Approval as ApprovalEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
} from "../generated/MyToken/MyToken";
import { Transfer, Approval, TokenMeta } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

export function handleTransfer(event: TransferEvent): void {
  let transfer = new Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.value = event.params.value;
  transfer.blockTimestamp = event.block.timestamp;
  transfer.save();
}

export function handleApproval(event: ApprovalEvent): void {
  let id = event.params.owner.concat(event.params.spender);
  let approval = new Approval(id);
  approval.owner = event.params.owner;
  approval.spender = event.params.spender;
  approval.value = event.params.value;
  approval.blockTimestamp = event.block.timestamp;
  approval.save();
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let meta = TokenMeta.load(event.address);
  if (meta == null) {
    meta = new TokenMeta(event.address);
  }
  meta.owner = event.params.newOwner;
  meta.lastOwnerChangeBlock = event.block.number;
  meta.save();
}
```

## Receipt-Based Event Filtering (Topic Filters)

Filter events by specific topic values to reduce indexing overhead.

```yaml
eventHandlers:
  - event: Transfer(indexed address,indexed address,uint256)
    handler: handleTransferToTreasury
    topic1:
      - "0x000000000000000000000000TREASURY_ADDRESS_HERE"
```

This indexes only Transfer events where the `to` parameter (topic1 for the second indexed param) matches the treasury address. Dramatically reduces handler invocations for high-volume contracts.

## Common Event Handler Mistakes

1. **Not null-checking `Entity.load()` results** -- always check for `null` before accessing fields. AssemblyScript has no optional chaining.
2. **Using `event.transaction.hash` alone as entity ID** -- multiple events can fire in a single transaction. Append `event.logIndex` for uniqueness.
3. **Modifying immutable entities** -- entities with `@entity(immutable: true)` cannot be loaded and modified. They can only be created once.
4. **Forgetting to call `.save()`** -- entity changes are not persisted until `.save()` is called. Missing `.save()` means lost data.
5. **Heavy contract reads in every handler** -- `ERC20.bind(address).try_name()` is an RPC call. Cache the result in an entity on first encounter.
