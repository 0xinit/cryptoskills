# The Graph Error Codes and Common Failures

## Build Errors (graph codegen / graph build)

| Error | Cause | Fix |
|-------|-------|-----|
| `ERROR TS2322: Type 'X \| null' is not assignable to type 'X'` | Entity.load() returns nullable. Assigning to non-nullable variable. | Add null check: `if (entity == null) { entity = new Entity(id); }` |
| `ERROR TS2304: Cannot find name 'Transfer'` | Missing codegen output. Import references auto-generated types. | Run `graph codegen` before `graph build`. |
| `ERROR TS2339: Property 'x' does not exist on type 'Y'` | Schema field name does not match mapping code. | Check `schema.graphql` field names match exactly. Re-run `graph codegen`. |
| `ERROR TS2554: Expected N arguments, but got M` | Event signature in manifest does not match ABI. | Verify `event:` line in subgraph.yaml matches ABI exactly, including `indexed` keywords. |
| `ERRO: Failed to copy subgraph build artifacts` | Build directory permissions or disk space issue. | Clear `build/` directory and rebuild. Check disk space. |
| `ERROR AS100: Not implemented: Closures` | Using arrow functions or callbacks in AssemblyScript. | Replace with `for` loops and explicit function calls. |
| `ERROR AS200: Conversion from type 'X' to 'Y' requires an explicit cast` | Implicit type conversion between graph-ts types. | Use explicit conversions: `BigInt.fromI32()`, `.toI32()`, `.toBigDecimal()`. |
| `WARNING: apiVersion is deprecated` | Using old mapping API version. | Update `apiVersion` to `0.0.9` in subgraph.yaml. |
| `Compile error: Import 'X' not found` | ABI or schema not in the path specified in manifest. | Verify `file:` paths in subgraph.yaml are relative to the manifest location. |

## Deployment Errors (graph deploy)

| Error | Cause | Fix |
|-------|-------|-----|
| `Authentication failed` | Deploy key is invalid, expired, or not set. | Run `graph auth --studio <NEW_KEY>`. Generate key from Studio dashboard. |
| `Subgraph not found` | Subgraph name in deploy command does not match Studio. | Check slug in Studio URL. Names are case-sensitive and hyphenated. |
| `Version label already exists` | Deploying with a version label that was already used. | Use a new version label: `--version-label v0.2.0`. |
| `Build validation error: X` | Manifest references entities not in schema, or ABI mismatch. | Verify all entities in `mapping.entities` exist in `schema.graphql`. |
| `Network not supported` | The network value in manifest is not recognized. | Check `resources/network-list.md` for valid network names. |
| `IPFS upload failed` | Network issue or IPFS node unavailable. | Retry the deploy. If persistent, check network connectivity. |

## Indexing Errors (Runtime)

These errors occur during indexing after deployment. Check Studio logs.

| Error | Cause | Fix |
|-------|-------|-----|
| `store.get failed: entity not found` | Loading an entity that was never created. | Always null-check `Entity.load()` results before accessing fields. |
| `Mapping aborted: value is null` | Accessing a field on a null entity reference. | Add null checks. AssemblyScript null dereference is a fatal error. |
| `overflow: BigInt too large` | Arithmetic overflow in BigInt operations. | Check input values. Ensure subtraction does not produce negative values for unsigned contexts. |
| `Mapping aborted: division by zero` | Dividing by `BigInt.fromI32(0)` or `BigDecimal.fromString("0")`. | Check divisor before dividing: `if (!divisor.isZero()) { result = a.div(divisor); }` |
| `Entity count exceeds limit` | Subgraph created too many entities (limit varies by indexer). | Reduce entity creation. Use aggregated entities instead of per-event entities where possible. |
| `Block handler timeout` | Block handler execution exceeds time limit. | Simplify block handler logic. Use `filter.every` to reduce invocation frequency. |
| `eth_call failed` | Contract read (try_ method) failed at this block. | Ensure you use `try_` methods and handle `reverted == true`. Non-try calls abort the handler. |
| `Subgraph failed with a deterministic error` | Handler logic produces an unrecoverable error at a specific block. | Fix the handler logic and redeploy. The subgraph will not advance past this block. |

## GraphQL Query Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Unknown field 'X' on type 'Y'` | Querying a field that does not exist in the schema. | Check schema.graphql for available fields. Field names are camelCase. |
| `Variable '$X' is not defined` | Using a variable in the query without declaring it. | Add variable declaration: `query($X: String!)` |
| `skip exceeds maximum (5000)` | Using `skip` > 5000. | Switch to cursor-based pagination with `id_gt`. |
| `first exceeds maximum (1000)` | Requesting more than 1000 entities per query. | Reduce `first` to 1000 or less. Use pagination for larger datasets. |
| `Subgraph indexing error` | The subgraph has a deterministic error and stopped indexing. | Check `_meta.hasIndexingErrors`. Fix and redeploy the subgraph. |
| `Block not found` | Time-travel query references a block not yet indexed. | Query `_meta.block.number` to find the latest indexed block. |
| `Subgraph deployment not found` | Invalid subgraph ID or the subgraph was removed. | Verify the subgraph ID from Studio or Graph Explorer. |

## AssemblyScript Type Errors

| Pattern | Error | Correct Usage |
|---------|-------|---------------|
| `let x = 0` | Type defaults to `f64`, not `i32` | `let x: i32 = 0` or `let x = BigInt.fromI32(0)` |
| `array.map(fn)` | Not implemented in AssemblyScript | Use `for` loop |
| `a?.b` | Optional chaining not supported | `if (a != null) { let b = a.b; }` |
| `a ?? b` | Nullish coalescing not supported | `let result = a != null ? a : b;` |
| `try { } catch { }` | Try/catch not supported | Validate inputs before operations. Use `try_` contract methods. |
| `"template string ${x}"` | Template literals not supported for graph-ts types | Use `.toString()` and string concatenation: `"prefix" + x.toString()` |
