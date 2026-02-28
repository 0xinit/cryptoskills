# Sui Error Codes

## Move Abort Codes

When a Move function aborts, it returns a (module, code) pair. Framework modules use well-known codes.

### sui::object Errors

| Code | Constant | Cause |
|------|----------|-------|
| 0 | `ENotSystemAddress` | Caller is not `@0x0` (system address) |

### sui::transfer Errors

| Code | Constant | Cause |
|------|----------|-------|
| 0 | `ESharedNonNewObject` | Attempted to share an object that already existed (not freshly created) |
| 1 | `ESharedObjectOperationNotSupported` | Operation not supported on shared objects |

### sui::coin Errors

| Code | Constant | Cause |
|------|----------|-------|
| 0 | `EBadWitness` | One-time witness type does not match the expected module |
| 1 | `EInvalidArg` | Invalid argument to coin operation |
| 2 | `ENotEnough` | Insufficient coin balance for the requested split |
| 3 | `EGlobalPauseNotAllowed` | Global pause not allowed for this coin type |
| 4 | `ENotFrozen` | Account is not frozen |

### sui::balance Errors

| Code | Constant | Cause |
|------|----------|-------|
| 0 | `ENotEnough` | Balance too low to withdraw the requested amount |
| 1 | `ENonZero` | Attempted to destroy a balance that is not zero |
| 2 | `EOverflow` | Balance addition would overflow `u64` |

### sui::table / sui::bag Errors

| Code | Constant | Cause |
|------|----------|-------|
| 0 | `EFieldAlreadyExists` | Key already exists in table/bag |
| 1 | `EFieldDoesNotExist` | Key not found in table/bag |
| 2 | `ETableNotEmpty` | Attempted to destroy a non-empty table/bag |

### sui::dynamic_field Errors

| Code | Constant | Cause |
|------|----------|-------|
| 0 | `EFieldAlreadyExists` | Dynamic field with this name already exists |
| 1 | `EFieldDoesNotExist` | No dynamic field with this name |
| 2 | `EFieldTypeMismatch` | Field exists but stored type does not match expected type |
| 3 | `EBCSSerializationFailure` | BCS serialization failed for the field name |

### sui::package Errors

| Code | Constant | Cause |
|------|----------|-------|
| 0 | `ENotOneTimeWitness` | Provided witness is not a valid one-time witness |
| 1 | `EAlreadyUpgraded` | Package has already been upgraded past this version |
| 2 | `EIncompatibleUpgrade` | Upgrade violates the package's upgrade policy |

### sui::kiosk Errors

| Code | Constant | Cause |
|------|----------|-------|
| 0 | `ENotOwner` | Caller does not own the KioskOwnerCap for this kiosk |
| 1 | `EItemNotFound` | Item not found in kiosk |
| 2 | `EItemAlreadyPlaced` | Item with this ID is already in the kiosk |
| 3 | `EItemIsListed` | Cannot take an item that is currently listed for sale |
| 4 | `EItemLocked` | Item is locked in the kiosk (requires TransferPolicy) |
| 5 | `EListedExclusively` | Item is listed exclusively and cannot be delisted |
| 6 | `EIncorrectAmount` | Payment amount does not match listing price |

## Transaction Execution Errors

These errors come from the Sui runtime, not from Move code:

| Error | Cause | Fix |
|-------|-------|-----|
| `InsufficientGas` | Gas budget too low for the transaction | Increase `--gas-budget` or `setGasBudget()` |
| `InsufficientCoinBalance` | Gas coin does not have enough SUI to pay for gas | Fund the account with more SUI |
| `InvalidTransactionUpdate` | Transaction references an object at the wrong version | Refetch the object; it was modified by another transaction |
| `ObjectNotFound` | Object ID does not exist on chain | Verify the object ID; it may have been deleted or wrapped |
| `ObjectVersionUnavailableForConsumption` | Concurrent transaction already consumed this object version | Retry; another transaction modified the owned object first |
| `MoveAbort(module, code)` | Move code called `abort` | Look up the module's error codes above |
| `MovePackageNotFound` | Package ID does not exist | Verify the package was published to this network |
| `InputObjectDeleted` | An input object was deleted in a prior epoch | Object was destroyed; cannot be used |
| `SharedObjectOperationNotAllowed` | Invalid operation on shared object | Check that the function signature matches shared/owned expectations |
| `SenderNoGasPayment` | Sender has no SUI coins for gas | Fund the sender address or use gas sponsorship |
| `GasBudgetTooHigh` | Gas budget exceeds the maximum allowed (50 SUI) | Lower the gas budget |
| `InvalidGasObject` | The specified gas object is not a SUI coin | Use a valid SUI coin object for gas |
| `DuplicateObjectsInInputs` | Same object ID appears multiple times in transaction inputs | Use each object ID only once |

## Custom Error Patterns in Move

Define and use custom error constants:

```move
module my_package::errors_example {
    const ENotAuthorized: u64 = 0;
    const EInsufficientBalance: u64 = 1;
    const EInvalidAmount: u64 = 2;
    const EAlreadyInitialized: u64 = 3;

    public entry fun restricted_action(cap: &AdminCap, amount: u64) {
        assert!(amount > 0, EInvalidAmount);
        // ...
    }
}
```

Convention: prefix error constants with `E`, use sequential integers starting from 0.

## Debugging Aborts

When a transaction aborts, the error message includes:

```
MoveAbort(MoveLocation { module: ModuleId { address: 0x2, name: "coin" }, function: 3, instruction: 5 }, 2)
```

This means: module `0x2::coin`, function index 3, instruction 5, abort code 2. Look up code `2` in the `sui::coin` table above (`ENotEnough`).

To get human-readable errors in the SDK:

```typescript
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair,
  options: { showEffects: true },
});

if (result.effects?.status?.status === "failure") {
  const errorMsg = result.effects.status.error;
  console.error("Transaction failed:", errorMsg);
}
```

Last verified: 2026-02-26
