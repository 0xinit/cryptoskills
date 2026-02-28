# Query Subgraph Examples

Querying subgraphs via GraphQL from frontend applications, Node.js scripts, and the command line.

## Query Endpoint

```
# Decentralized network (production)
https://gateway.thegraph.com/api/{api-key}/subgraphs/id/{subgraph-id}

# Subgraph Studio (development/testing)
https://api.studio.thegraph.com/query/{studio-id}/{subgraph-slug}/{version}
```

Get your API key from https://thegraph.com/studio/apikeys/

## Basic Queries

### Fetch Top Tokens by Supply

```graphql
{
  tokens(first: 10, orderBy: totalSupply, orderDirection: desc) {
    id
    name
    symbol
    decimals
    totalSupply
  }
}
```

### Fetch Recent Transfers for an Address

```graphql
{
  transfers(
    first: 50
    orderBy: blockTimestamp
    orderDirection: desc
    where: {
      from: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
    }
  ) {
    id
    from { id }
    to { id }
    amount
    blockNumber
    blockTimestamp
    transactionHash
  }
}
```

### Filter by Multiple Conditions

```graphql
{
  transfers(
    where: {
      amount_gt: "1000000000"
      blockTimestamp_gte: "1700000000"
      blockTimestamp_lt: "1701000000"
    }
    orderBy: amount
    orderDirection: desc
    first: 100
  ) {
    from { id }
    to { id }
    amount
    token { symbol }
  }
}
```

## Pagination Patterns

### Cursor-Based Pagination (Recommended)

`skip` is limited to 5000. For large datasets, use `id_gt` for efficient cursor-based pagination.

```typescript
const SUBGRAPH_URL = "https://gateway.thegraph.com/api/{api-key}/subgraphs/id/{id}";

interface Transfer {
  id: string;
  from: { id: string };
  to: { id: string };
  amount: string;
}

async function fetchAllTransfers(minAmount: string): Promise<Transfer[]> {
  const PAGE_SIZE = 1000;
  let allTransfers: Transfer[] = [];
  let lastId = "";

  while (true) {
    const query = `{
      transfers(
        first: ${PAGE_SIZE}
        where: {
          amount_gt: "${minAmount}"
          ${lastId ? `id_gt: "${lastId}"` : ""}
        }
        orderBy: id
        orderDirection: asc
      ) {
        id
        from { id }
        to { id }
        amount
      }
    }`;

    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Subgraph query failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();

    if (json.errors) {
      throw new Error(`GraphQL error: ${json.errors[0].message}`);
    }

    const transfers: Transfer[] = json.data.transfers;
    if (transfers.length === 0) break;

    allTransfers = allTransfers.concat(transfers);
    lastId = transfers[transfers.length - 1].id;

    if (transfers.length < PAGE_SIZE) break;
  }

  return allTransfers;
}
```

### Skip-Based Pagination (Simple, Limited to 5000)

```graphql
# Page 1
{ transfers(first: 100, skip: 0) { id amount } }

# Page 2
{ transfers(first: 100, skip: 100) { id amount } }

# Page 3
{ transfers(first: 100, skip: 200) { id amount } }

# FAILS: skip cannot exceed 5000
{ transfers(first: 100, skip: 5001) { id amount } }
```

## Time-Travel Queries

Query historical state at a specific block.

```graphql
# Token balances at block 18,000,000
{
  accountBalances(
    block: { number: 18000000 }
    where: { token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }
    first: 10
    orderBy: amount
    orderDirection: desc
  ) {
    account { id }
    amount
  }
}
```

Requirements for time-travel:
- The subgraph must NOT have `prune: auto` enabled (pruning deletes historical state)
- The requested block must be within the subgraph's indexed range

## Full-Text Search

Requires `@fulltext` directive in the subgraph schema.

```graphql
{
  tokenSearch(text: "USD Coin") {
    id
    name
    symbol
    totalSupply
  }
}
```

Search operators:
- `"USD Coin"` -- exact phrase
- `USD & Coin` -- both terms (AND)
- `USD | USDT` -- either term (OR)
- `USD*` -- prefix match

## Frontend Integration (React + fetch)

```typescript
const SUBGRAPH_URL = "https://gateway.thegraph.com/api/{api-key}/subgraphs/id/{id}";

interface Token {
  id: string;
  name: string;
  symbol: string;
  totalSupply: string;
}

interface SubgraphResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

async function querySubgraph<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result: SubgraphResponse<T> = await response.json();

  if (result.errors) {
    throw new Error(`Subgraph error: ${result.errors[0].message}`);
  }

  return result.data;
}

// Usage
const data = await querySubgraph<{ tokens: Token[] }>(`
  query GetTokens($first: Int!) {
    tokens(first: $first, orderBy: totalSupply, orderDirection: desc) {
      id
      name
      symbol
      totalSupply
    }
  }
`, { first: 10 });
```

## Command Line with curl

```bash
# Query a subgraph from the terminal
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ tokens(first: 5) { id name symbol totalSupply } }"}' \
  "https://gateway.thegraph.com/api/YOUR_API_KEY/subgraphs/id/SUBGRAPH_ID"
```

## Handling Indexing Errors

Subgraphs can fail and stop indexing. Always check the indexing status metadata.

```graphql
{
  _meta {
    block {
      number
      hash
    }
    deployment
    hasIndexingErrors
  }
}
```

- `hasIndexingErrors: true` means the subgraph encountered a fatal error and stopped indexing
- `block.number` shows the last successfully indexed block
- Compare `block.number` to the current chain head to determine how far behind the subgraph is

## Common Query Mistakes

1. **Not checking `_meta` for indexing errors** -- a failed subgraph returns stale data without warning
2. **Using `skip` beyond 5000** -- silently returns empty results. Use cursor-based pagination.
3. **Querying pruned subgraphs with `block` parameter** -- time-travel fails if historical state was pruned
4. **Assuming subgraph is real-time** -- indexing lags behind the chain head by seconds to minutes depending on network load
5. **Not URL-encoding API keys** -- some keys contain special characters that break URL parsing
