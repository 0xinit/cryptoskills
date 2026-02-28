# Read Chain State Examples

Working examples for querying Sui on-chain data: objects, balances, events, transactions, and dynamic fields using the TypeScript SDK.

## Setup

```typescript
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
```

## Get Object Details

```typescript
async function getObject(objectId: string) {
  const object = await client.getObject({
    id: objectId,
    options: {
      showContent: true,
      showOwner: true,
      showType: true,
      showDisplay: true,
      showStorageRebate: true,
    },
  });

  if (object.error) {
    throw new Error(`Object fetch failed: ${object.error.code}`);
  }
  if (!object.data) {
    throw new Error(`Object ${objectId} not found`);
  }

  console.log("Type:", object.data.type);
  console.log("Owner:", JSON.stringify(object.data.owner));
  console.log("Version:", object.data.version);

  if (object.data.content?.dataType === "moveObject") {
    console.log("Fields:", JSON.stringify(object.data.content.fields, null, 2));
  }

  return object.data;
}
```

## Get Multiple Objects

```typescript
async function getMultipleObjects(objectIds: string[]) {
  const objects = await client.multiGetObjects({
    ids: objectIds,
    options: {
      showContent: true,
      showOwner: true,
      showType: true,
    },
  });

  for (const obj of objects) {
    if (obj.error) {
      console.error(`Error for object: ${obj.error.code}`);
      continue;
    }
    console.log(`${obj.data?.objectId}: ${obj.data?.type}`);
  }

  return objects;
}
```

## Get Balance

```typescript
async function getBalances(address: string) {
  // Get SUI balance
  const suiBalance = await client.getBalance({
    owner: address,
    coinType: "0x2::sui::SUI",
  });
  // totalBalance is a string representing MIST
  const suiAmount = BigInt(suiBalance.totalBalance);
  console.log(`SUI: ${suiAmount} MIST (${Number(suiAmount) / 1e9} SUI)`);
  console.log(`Coin object count: ${suiBalance.coinObjectCount}`);

  // Get all balances (all coin types)
  const allBalances = await client.getAllBalances({ owner: address });
  for (const bal of allBalances) {
    console.log(`${bal.coinType}: ${bal.totalBalance}`);
  }

  return { suiBalance, allBalances };
}
```

## Get Coins

```typescript
async function getCoins(
  address: string,
  coinType: string = "0x2::sui::SUI"
) {
  let cursor: string | null | undefined = undefined;
  const allCoins: Array<{
    coinObjectId: string;
    balance: string;
    version: string;
  }> = [];

  // Paginate through all coins
  do {
    const page = await client.getCoins({
      owner: address,
      coinType,
      cursor: cursor ?? undefined,
      limit: 50,
    });

    for (const coin of page.data) {
      allCoins.push({
        coinObjectId: coin.coinObjectId,
        balance: coin.balance,
        version: coin.version,
      });
    }

    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  console.log(`Found ${allCoins.length} coins of type ${coinType}`);
  return allCoins;
}
```

## Get Owned Objects (with Type Filter)

```typescript
async function getOwnedNFTs(
  address: string,
  nftType: string
) {
  let cursor: string | null | undefined = undefined;
  const allObjects: Array<{ objectId: string; type: string; fields: unknown }> = [];

  do {
    const page = await client.getOwnedObjects({
      owner: address,
      filter: { StructType: nftType },
      options: { showContent: true, showType: true },
      cursor: cursor ?? undefined,
      limit: 50,
    });

    for (const item of page.data) {
      if (item.data) {
        allObjects.push({
          objectId: item.data.objectId,
          type: item.data.type ?? "unknown",
          fields:
            item.data.content?.dataType === "moveObject"
              ? item.data.content.fields
              : null,
        });
      }
    }

    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return allObjects;
}
```

## Query Events

```typescript
async function queryEvents(
  eventType: string,
  limit: number = 25
) {
  const events = await client.queryEvents({
    query: { MoveEventType: eventType },
    limit,
    order: "descending",
  });

  for (const event of events.data) {
    console.log("TX Digest:", event.id.txDigest);
    console.log("Timestamp:", event.timestampMs);
    console.log("Parsed JSON:", JSON.stringify(event.parsedJson, null, 2));
    console.log("---");
  }

  return events.data;
}

// Example: query coin transfer events
await queryEvents("0x2::coin::CoinBalanceChangeEvent");
```

## Get Transaction Details

```typescript
async function getTransaction(digest: string) {
  const txn = await client.getTransactionBlock({
    digest,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
  });

  console.log("Status:", txn.effects?.status?.status);
  console.log("Gas used:", JSON.stringify(txn.effects?.gasUsed));
  console.log("Events:", txn.events?.length ?? 0);
  console.log("Object changes:", txn.objectChanges?.length ?? 0);

  return txn;
}
```

## Get Dynamic Fields

Dynamic fields are key-value data attached to objects at runtime:

```typescript
async function getDynamicFields(parentId: string) {
  let cursor: string | null | undefined = undefined;
  const allFields: Array<{
    name: { type: string; value: unknown };
    objectId: string;
    objectType: string;
  }> = [];

  do {
    const page = await client.getDynamicFields({
      parentId,
      cursor: cursor ?? undefined,
      limit: 50,
    });

    for (const field of page.data) {
      allFields.push({
        name: field.name,
        objectId: field.objectId,
        objectType: field.objectType,
      });
    }

    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return allFields;
}

async function getDynamicFieldValue(
  parentId: string,
  fieldName: { type: string; value: unknown }
) {
  const field = await client.getDynamicFieldObject({
    parentId,
    name: fieldName,
  });

  if (field.data?.content?.dataType === "moveObject") {
    return field.data.content.fields;
  }
  return null;
}
```

## Get Checkpoints (Block Equivalent)

```typescript
async function getLatestCheckpoint() {
  const checkpoint = await client.getLatestCheckpointSequenceNumber();
  console.log("Latest checkpoint:", checkpoint);

  const details = await client.getCheckpoint({
    id: checkpoint,
  });

  console.log("Timestamp:", details.timestampMs);
  console.log("TX count:", details.transactions.length);
  console.log("Epoch:", details.epoch);

  return details;
}
```

## Get Validators and Epoch Info

```typescript
async function getSystemState() {
  const state = await client.getLatestSuiSystemState();

  console.log("Epoch:", state.epoch);
  console.log("Epoch start:", state.epochStartTimestampMs);
  console.log("Epoch duration:", state.epochDurationMs, "ms");
  console.log("Reference gas price:", state.referenceGasPrice);
  console.log("Total stake:", state.totalStake);
  console.log("Active validators:", state.activeValidators.length);

  // Top validators by stake
  const sorted = [...state.activeValidators].sort(
    (a, b) => Number(BigInt(b.stakingPoolSuiBalance) - BigInt(a.stakingPoolSuiBalance))
  );

  for (const v of sorted.slice(0, 5)) {
    console.log(
      `  ${v.name}: ${(Number(BigInt(v.stakingPoolSuiBalance)) / 1e9).toFixed(0)} SUI`
    );
  }

  return state;
}
```

## Subscribe to Events (WebSocket)

```typescript
async function subscribeToEvents(eventType: string) {
  const unsubscribe = await client.subscribeEvent({
    filter: { MoveEventType: eventType },
    onMessage: (event) => {
      console.log("New event:", event.type);
      console.log("TX:", event.id.txDigest);
      console.log("Data:", JSON.stringify(event.parsedJson, null, 2));
    },
  });

  // Call unsubscribe() when done
  return unsubscribe;
}
```

## Resolve Sui Name Service (SuiNS)

```typescript
async function resolveAddress(suiName: string): Promise<string | null> {
  const address = await client.resolveNameServiceAddress({
    name: suiName,
  });
  return address;
}

async function resolveNames(address: string): Promise<string[]> {
  const names = await client.resolveNameServiceNames({
    address,
  });
  return names.data;
}

// Example
const addr = await resolveAddress("example.sui");
console.log("Address:", addr);
```

## CLI Equivalents

```bash
# Get object
sui client object 0xOBJECT_ID --json

# Get owned objects
sui client objects --json

# Get gas coins
sui client gas --json

# Get transaction
sui client tx-block 0xDIGEST --json

# Query events
sui client events --query '{"MoveEventType":"0xPKG::mod::Event"}' --limit 10
```
