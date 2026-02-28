# Sui Troubleshooting

## Package Publish Fails

**Symptom**: `sui client publish` returns an error before or during execution.

**Common causes**:

1. **Insufficient gas budget** -- Publishing requires significant gas (often 100M+ MIST). Increase with `--gas-budget 200000000`.

2. **Compilation errors** -- Run `sui move build` first to catch Move compiler errors locally. Common issues:
   - Missing `use` imports
   - Struct missing `id: UID` as first field when it has `key` ability
   - Using `transfer::transfer` on a type with `store` ability from outside its module (use `transfer::public_transfer` instead)

3. **Dependency mismatch** -- The `rev` in Move.toml must match the target network:
   - Testnet: `rev = "framework/testnet"`
   - Mainnet: `rev = "framework/mainnet"`
   - Devnet: `rev = "framework/devnet"`

4. **No gas coins** -- Run `sui client gas` to check available coins. On testnet, use `sui client faucet` to request tokens.

5. **Address `0x0` conflict** -- If you see "address already assigned", ensure `Move.toml` uses `my_package = "0x0"` (the placeholder address for unpublished packages).

## Object Not Found

**Symptom**: `ObjectNotFound` or `null` when querying an object by ID.

**Common causes**:

1. **Wrong network** -- Object exists on testnet but you are querying mainnet (or vice versa). Check `sui client active-env`.

2. **Object was deleted** -- If a Move function called `object::delete(id)`, the object no longer exists. Check transaction history for deletion.

3. **Object was wrapped** -- The object was stored as a field inside another object. Wrapped objects lose their top-level ID on-chain. Use `dynamic_object_field` instead of a struct field if you need the child to remain independently queryable.

4. **Object was consumed** -- Some patterns (like hot potato) consume objects. They cannot be queried after consumption.

## Transaction Fails with "ObjectVersionUnavailableForConsumption"

**Symptom**: Transaction fails because an owned object was modified by another transaction between when you read it and when you submitted.

**Fix**: This is an optimistic concurrency error. The object version you referenced is stale.

- Refetch the object to get the latest version
- Rebuild and resubmit the transaction
- If this happens repeatedly, the object may be under high contention -- consider using a shared object pattern instead

## "SharedObjectOperationNotAllowed" Error

**Symptom**: Transaction fails when trying to use a shared object.

**Common causes**:

1. **Passing shared object by value** -- Shared objects must be passed by reference (`&` or `&mut`), never by value, in entry functions. Passing by value would require deleting the shared object.

2. **Trying to transfer a shared object** -- Once an object is shared, it cannot be transferred or frozen. This is permanent.

3. **Trying to share an existing object** -- Only freshly created objects (in the same transaction) can be shared. You cannot share an object that was already owned.

## Move Abort with No Clear Error

**Symptom**: Transaction aborts with a numeric code like `MoveAbort(..., 2)`.

**Debug steps**:

1. Parse the error: `MoveAbort(MoveLocation { module: ModuleId { address: 0x2, name: "coin" }, function: 3, instruction: 5 }, 2)`. The key info is: module `0x2::coin`, abort code `2`.

2. Look up the code in `resources/error-codes.md`. For `0x2::coin` code `2`, the error is `ENotEnough` (insufficient balance).

3. For custom modules, find the error constant matching the code number in the Move source.

4. In the SDK, get the error message from effects:
```typescript
if (result.effects?.status?.status === "failure") {
  console.error(result.effects.status.error);
}
```

## Gas Estimation Issues

**Symptom**: Transaction fails with `InsufficientGas` even though you set a high gas budget.

**Common causes**:

1. **Gas coin balance is less than the budget** -- The gas budget is the MAXIMUM you are willing to pay, but your gas coin must have at least that much SUI. Check with `sui client gas`.

2. **Computation is genuinely expensive** -- Large PTBs with many commands (especially with shared objects) can be expensive. Use dry run to estimate:
```typescript
const dryRun = await client.dryRunTransactionBlock({
  transactionBlock: await tx.build({ client }),
});
console.log(dryRun.effects.gasUsed);
```

3. **Storage costs** -- Creating many new objects incurs storage costs beyond computation. Each new object costs approximately 2M MIST in storage.

## SDK: "Cannot find module '@mysten/sui/client'"

**Symptom**: TypeScript cannot resolve imports from `@mysten/sui`.

**Fix**: You are likely using the deprecated `@mysten/sui.js` package. Uninstall it and install the current SDK:

```bash
npm uninstall @mysten/sui.js
npm install @mysten/sui
```

Update all imports:
```typescript
// Old (deprecated)
import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";

// New (current)
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
```

`TransactionBlock` was renamed to `Transaction`.

## "Clock" Object Cannot Be Passed as Owned

**Symptom**: Transaction fails when passing the Clock object (`0x6`).

**Fix**: Clock is a shared object. Always pass it as an immutable reference (`&Clock`) in Move functions, never as `&mut Clock` or by value. In the SDK:

```typescript
tx.moveCall({
  target: "0xPACKAGE::module::function",
  arguments: [
    tx.object("0x6"), // Clock -- SDK handles shared object reference
  ],
});
```

The SDK automatically determines that `0x6` is a shared object and passes it correctly.

## Package Upgrade Fails

**Symptom**: `package::authorize_upgrade` or `commit_upgrade` aborts.

**Common causes**:

1. **Incompatible changes** -- With policy `0` (compatible), you cannot:
   - Remove or rename existing public functions
   - Change function signatures
   - Remove or change struct layouts
   - Remove modules

2. **Wrong digest** -- The digest passed to `authorize_upgrade` must match the compiled bytecode. Rebuild the package and use the fresh digest.

3. **UpgradeCap destroyed** -- If the UpgradeCap was destroyed with `package::make_immutable`, the package cannot be upgraded.

4. **Policy too restrictive** -- If the upgrade policy was set to `192` (dependency-only) or `255` (immutable), the upgrade types allowed are very limited.

## Tests Pass Locally but Fail On-Chain

**Symptom**: `sui move test` passes but the published module behaves differently.

**Common causes**:

1. **Test-only modules** -- Code in `#[test_only]` blocks is not published. If your production code depends on test helpers, it will fail.

2. **Different addresses** -- In tests, addresses are constants like `@0xAD`. On-chain, actual addresses are 32-byte hex. If your code contains hardcoded test addresses, it will break.

3. **Clock not available in tests** -- The Clock object (`0x6`) is not automatically available in `test_scenario`. Use `clock::create_for_testing(ctx)` in tests.

4. **Epoch-dependent logic** -- Test scenarios can advance epochs with `test_scenario::next_epoch`, but on-chain epochs are ~24 hours.

Last verified: 2026-02-26
