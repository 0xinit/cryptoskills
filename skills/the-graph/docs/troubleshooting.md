# The Graph Troubleshooting Guide

Common issues and solutions for subgraph development, deployment, and querying.

## Subgraph Stops Indexing (Deterministic Error)

**Symptoms:**
- Studio shows "Failed" status
- `_meta.hasIndexingErrors` returns `true`
- Subgraph stuck at a specific block number

**Solutions:**

1. **Check Studio logs** -- the error message includes the block number and handler that failed. Navigate to your subgraph in Studio and check the "Logs" tab.

2. **Common causes of deterministic errors:**
   - Null pointer dereference: `Entity.load(id)` returned null and code accessed a field without checking
   - Division by zero: `BigInt.div()` or `BigDecimal.div()` with zero divisor
   - Integer overflow: `BigInt` arithmetic produced a value exceeding internal limits
   - Non-try contract read reverted: using `contract.name()` instead of `contract.try_name()`

3. **Debug locally with Matchstick:**
   ```bash
   npm install --save-dev matchstick-as
   graph test
   ```
   Create a test that replays the failing event with the same parameters.

4. **Fix and redeploy** -- after fixing the handler, deploy a new version. The subgraph re-indexes from `startBlock`.

## Build Fails After Schema Change

**Symptoms:**
- `graph build` errors after modifying `schema.graphql`
- Type errors in mapping code

**Solutions:**

1. **Always run codegen first:**
   ```bash
   graph codegen
   graph build
   ```
   `graph codegen` regenerates the `generated/schema.ts` file. Skipping codegen means the build uses stale types.

2. **Check for breaking changes:**
   - Adding a required field (non-nullable) breaks existing entity loads
   - Renaming an entity changes the import path
   - Removing a field removes the generated setter/getter

3. **Clear generated files if codegen seems stuck:**
   ```bash
   rm -rf generated/ build/
   graph codegen
   graph build
   ```

## Indexing Is Extremely Slow

**Symptoms:**
- Subgraph syncs less than 100 blocks per second
- Indexing has been running for hours with minimal progress

**Solutions:**

1. **Set `startBlock` to the contract deployment block** -- indexing from block 0 processes millions of irrelevant blocks.
   ```bash
   # Find deployment block
   cast receipt <DEPLOY_TX_HASH> --rpc-url $RPC_URL | grep blockNumber
   ```

2. **Reduce contract reads** -- each `try_*` call is an RPC request. Cache values in entities:
   ```typescript
   // Read once on first encounter, not on every event
   let token = Token.load(address);
   if (token == null) {
     token = new Token(address);
     let contract = ERC20.bind(address);
     let nameResult = contract.try_name();
     token.name = nameResult.reverted ? "Unknown" : nameResult.value;
     token.save();
   }
   ```

3. **Use `@entity(immutable: true)` for event entities** -- reduces storage writes by 80% for append-only data.

4. **Enable pruning** -- add `indexerHints: { prune: auto }` to remove historical entity versions.

5. **Use `Bytes` instead of `String` for entity IDs** -- `Bytes` avoids hex encoding overhead on every save/load.

## Queries Return Empty Results

**Symptoms:**
- GraphQL query returns `{ "data": { "entities": [] } }`
- Expected data is missing

**Solutions:**

1. **Check indexing status:**
   ```graphql
   { _meta { block { number } hasIndexingErrors } }
   ```
   If `block.number` is behind the block where your data exists, the subgraph has not indexed that far yet.

2. **Verify entity field names are camelCase** -- GraphQL fields match `schema.graphql` exactly. `totalSupply` is not `total_supply`.

3. **Check filter values** -- `Bytes` fields are lowercase hex in queries:
   ```graphql
   # Correct: lowercase hex
   { transfers(where: { from: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" }) { id } }

   # Wrong: checksummed address
   { transfers(where: { from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }) { id } }
   ```

4. **Check `skip` limit** -- `skip` maxes out at 5000. Use cursor-based pagination with `id_gt` for deeper pages.

5. **Time-travel query on pruned subgraph** -- if `prune: auto` is enabled, historical state is deleted. Remove the `block` parameter or disable pruning.

## Authentication Fails on Deploy

**Symptoms:**
- `graph deploy` returns "Authentication failed"
- Deployment hangs or times out

**Solutions:**

1. **Regenerate deploy key** -- keys can expire. Go to Studio dashboard, generate a new key, and re-authenticate:
   ```bash
   graph auth --studio <NEW_DEPLOY_KEY>
   ```

2. **Check stored credentials:**
   ```bash
   cat ~/.graph
   ```
   The file should contain a valid JSON with your deploy key.

3. **CI/CD: pass key via environment:**
   ```bash
   GRAPH_AUTH_TOKEN=$DEPLOY_KEY graph deploy --studio my-subgraph
   ```

## Event Handler Not Triggering

**Symptoms:**
- Subgraph indexes blocks but handler is never called
- Entity counts remain at zero

**Solutions:**

1. **Verify event signature matches ABI exactly:**
   ```yaml
   # The event signature must include `indexed` keywords and exact types
   eventHandlers:
     - event: Transfer(indexed address,indexed address,uint256)
       handler: handleTransfer
   ```
   Common mistake: omitting `indexed` or using wrong parameter types.

2. **Verify contract address is correct** -- the data source `address` must be the actual contract that emits the event. For proxy contracts, use the proxy address (events are emitted from the proxy).

3. **Check `startBlock`** -- if `startBlock` is set to a block after all relevant events, the handler never fires. Verify events exist after your `startBlock`:
   ```bash
   cast logs --from-block <START_BLOCK> --to-block <START_BLOCK+1000> \
     --address <CONTRACT> --rpc-url $RPC_URL
   ```

4. **ABI mismatch** -- if the ABI does not match the deployed contract, events decode incorrectly. Verify the ABI:
   ```bash
   cast abi-decode "Transfer(address,address,uint256)" <LOG_DATA>
   ```

## Entity.load() Always Returns Null

**Symptoms:**
- Entity exists in queries but `Entity.load(id)` returns null in mapping code

**Solutions:**

1. **ID type mismatch** -- if schema uses `id: Bytes!` but you pass a `string` to `load()`, it will not match:
   ```typescript
   // Wrong: passing string when ID is Bytes
   let token = Token.load("0x1234...");

   // Correct: passing Bytes
   let token = Token.load(event.address);
   ```

2. **ID construction mismatch** -- the ID used in `load()` must exactly match the ID used in `new Entity()`:
   ```typescript
   // Creation
   let balance = new AccountBalance(tokenAddress.concat(userAddress));

   // Load must use the same concat pattern
   let balance = AccountBalance.load(tokenAddress.concat(userAddress));
   ```

3. **Entity not yet created** -- the entity may not exist at this point in indexing if the creation event has not been processed yet. Always handle null.
