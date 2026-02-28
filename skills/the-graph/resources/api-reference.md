# The Graph API Reference

## Query Endpoints

| Environment | URL Pattern |
|-------------|-------------|
| Decentralized Network | `https://gateway.thegraph.com/api/{api-key}/subgraphs/id/{subgraph-id}` |
| Subgraph Studio | `https://api.studio.thegraph.com/query/{studio-id}/{subgraph-slug}/{version}` |
| Self-hosted (graph-node) | `http://localhost:8000/subgraphs/name/{subgraph-name}` |

API keys are managed at https://thegraph.com/studio/apikeys/

## GraphQL Schema Directives

### @entity

Marks a type as a stored entity in the subgraph store.

```graphql
type Token @entity {
  id: Bytes!
  name: String!
}

# Immutable entity (append-only, cannot be updated after creation)
type Transfer @entity(immutable: true) {
  id: Bytes!
  value: BigInt!
}
```

### @derivedFrom

Creates a virtual reverse lookup field. No data is stored -- computed at query time.

```graphql
type Token @entity {
  id: Bytes!
  holders: [TokenHolder!]! @derivedFrom(field: "token")
}

type TokenHolder @entity {
  id: Bytes!
  token: Token!
  balance: BigInt!
}
```

### @fulltext

Enables full-text search on string fields.

```graphql
type _Schema_
  @fulltext(
    name: "tokenSearch"
    language: en
    algorithm: rank
    include: [{ entity: "Token", fields: [{ name: "name" }, { name: "symbol" }] }]
  )
```

Algorithms: `rank` (relevance scoring), `proximityRank` (proximity + relevance)

## Scalar Types

| GraphQL Type | AssemblyScript Type | Description |
|-------------|-------------------|-------------|
| `ID` | `Bytes` or `string` | Unique identifier (required on all entities) |
| `Bytes` | `Bytes` | Raw byte array, hex-encoded in GraphQL responses |
| `String` | `string` | UTF-8 string |
| `Boolean` | `boolean` | true/false |
| `Int` | `i32` | 32-bit signed integer |
| `BigInt` | `BigInt` | Arbitrary precision integer |
| `BigDecimal` | `BigDecimal` | Arbitrary precision decimal |

## graph-ts Store API

### Entity Operations

```typescript
import { store } from "@graphprotocol/graph-ts";

// Load (returns Entity | null)
let token = Token.load(id);

// Create
let token = new Token(id);
token.name = "USDC";
token.save();

// Remove
store.remove("Token", id.toHexString());
```

### BigInt Methods

```typescript
import { BigInt } from "@graphprotocol/graph-ts";

// Constructors
BigInt.fromI32(42)
BigInt.fromString("1000000000000000000")
BigInt.fromByteArray(byteArray)

// Arithmetic
a.plus(b)
a.minus(b)
a.times(b)
a.div(b)
a.mod(b)
a.pow(exp: u8)
a.abs()
a.neg()

// Comparison
a.equals(b)
a.gt(b)
a.ge(b)
a.lt(b)
a.le(b)
a.isZero()

// Conversion
a.toI32()
a.toString()
a.toHex()
a.toHexString()
a.toBigDecimal()
```

### BigDecimal Methods

```typescript
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

// Constructors
BigDecimal.fromString("1.5")
BigInt.fromI32(100).toBigDecimal()

// Arithmetic
a.plus(b)
a.minus(b)
a.times(b)
a.div(b)

// Conversion
a.toString()
a.truncate(precision: i32)  // Round to N decimal places
```

### Bytes Methods

```typescript
import { Bytes, Address } from "@graphprotocol/graph-ts";

// Constructors
Bytes.fromHexString("0xabcdef")
Bytes.fromI32(42)

// Operations
a.concat(b)                   // Concatenate two Bytes
a.concatI32(n)                // Append i32 to Bytes
a.toHexString()               // "0xabcdef..."
a.toHex()                     // Same as toHexString()
a.toString()                  // UTF-8 decode (use with caution)

// Address (extends Bytes)
Address.fromString("0x...")
Address.fromBytes(bytes)
```

### Event Object Properties

```typescript
import { ethereum } from "@graphprotocol/graph-ts";

// Inside an event handler
export function handleMyEvent(event: MyEvent): void {
  // Event parameters (typed per ABI)
  event.params.from      // Address
  event.params.to        // Address
  event.params.value     // BigInt

  // Block metadata
  event.block.number     // BigInt
  event.block.timestamp  // BigInt
  event.block.hash       // Bytes

  // Transaction metadata
  event.transaction.hash      // Bytes
  event.transaction.from      // Address
  event.transaction.gasPrice  // BigInt
  event.transaction.value     // BigInt (ETH sent)

  // Log metadata
  event.logIndex         // BigInt
  event.address          // Address (contract that emitted the event)
}
```

## graph-cli Commands

| Command | Description |
|---------|-------------|
| `graph init` | Initialize a new subgraph project |
| `graph codegen` | Generate AssemblyScript types from schema and ABIs |
| `graph build` | Compile subgraph to WebAssembly |
| `graph deploy --studio <name>` | Deploy to Subgraph Studio |
| `graph auth --studio <key>` | Authenticate with Subgraph Studio |
| `graph test` | Run matchstick unit tests |
| `graph create --node <url>` | Create subgraph on a graph-node (self-hosted) |
| `graph remove --node <url>` | Remove subgraph from a graph-node |

### graph init Options

```bash
graph init --studio <name> \
  --protocol ethereum \
  --network mainnet \
  --contract-name MyContract \
  --contract-address 0x... \
  --abi ./path/to/abi.json \
  --start-block 18000000
```

| Flag | Values |
|------|--------|
| `--protocol` | `ethereum`, `near`, `cosmos`, `arweave` |
| `--network` | See `resources/network-list.md` |
| `--start-block` | Block number to start indexing from |
| `--abi` | Path to contract ABI JSON file |
| `--contract-address` | Deployed contract address |

## Subgraph Manifest (subgraph.yaml) Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `specVersion` | string | Yes | Manifest spec version (current: `1.2.0`) |
| `schema.file` | path | Yes | Path to schema.graphql |
| `dataSources` | array | Yes | List of data sources to index |
| `dataSources[].kind` | string | Yes | `ethereum` |
| `dataSources[].name` | string | Yes | Data source name (used in imports) |
| `dataSources[].network` | string | Yes | Network name |
| `dataSources[].source.address` | string | Yes | Contract address |
| `dataSources[].source.abi` | string | Yes | ABI name (matches `abis[].name`) |
| `dataSources[].source.startBlock` | int | No | Block to start indexing (default: 0) |
| `dataSources[].mapping.kind` | string | Yes | `ethereum/events` |
| `dataSources[].mapping.apiVersion` | string | Yes | Mapping API version (current: `0.0.9`) |
| `dataSources[].mapping.language` | string | Yes | `wasm/assemblyscript` |
| `dataSources[].mapping.entities` | array | Yes | Entity names this data source writes |
| `dataSources[].mapping.abis` | array | Yes | ABI definitions |
| `dataSources[].mapping.eventHandlers` | array | No | Event handler definitions |
| `dataSources[].mapping.callHandlers` | array | No | Call handler definitions |
| `dataSources[].mapping.blockHandlers` | array | No | Block handler definitions |
| `dataSources[].mapping.file` | path | Yes | Path to mapping file |
| `templates` | array | No | Data source templates (for factory patterns) |
| `indexerHints.prune` | string | No | `auto` to enable automatic pruning |
| `features` | array | No | Feature flags (`grafting`, `fullTextSearch`, etc.) |
| `graft.base` | string | No | Deployment ID to graft from |
| `graft.block` | int | No | Block number to graft at |
