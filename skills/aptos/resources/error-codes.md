# Aptos Error Codes

## Error Code Format

Aptos Move abort codes follow a structured format. Framework errors use category-based encoding:

```
abort_code = (category << 16) | reason
```

Categories:
| Category | Value | Meaning |
|----------|-------|---------|
| `INVALID_ARGUMENT` | `0x1` | Bad input parameter |
| `OUT_OF_RANGE` | `0x2` | Value out of bounds |
| `INVALID_STATE` | `0x3` | Operation invalid in current state |
| `UNAUTHENTICATED` | `0x4` | Caller not authenticated |
| `PERMISSION_DENIED` | `0x5` | Caller lacks permission |
| `NOT_FOUND` | `0x6` | Resource or item not found |
| `ABORTED` | `0x7` | Operation aborted |
| `ALREADY_EXISTS` | `0x8` | Resource or item already exists |
| `RESOURCE_EXHAUSTED` | `0x9` | Limit reached |
| `INTERNAL` | `0xA` | Internal error |

Example: `0x60001` = `NOT_FOUND (0x6)` category, reason `1` = `EACCOUNT_NOT_FOUND`

## Account Errors (0x1::account)

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| `0x8_0001` | `EACCOUNT_ALREADY_EXISTS` | Account already exists at address | Use existing account |
| `0x6_0001` | `EACCOUNT_NOT_FOUND` | Account does not exist at address | Create account first or use `aptos_account::transfer` |
| `0x1_0002` | `EMALFORMED_AUTHENTICATION_KEY` | Auth key wrong length | Must be 32 bytes |
| `0x5_0005` | `ENO_SUCH_SIGNER_CAPABILITY` | Signer capability not found | Ensure resource account was created properly |
| `0x1_000A` | `EOUT_OF_GAS` | Transaction ran out of gas | Increase max gas units |

## Coin Errors (0x1::coin)

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| `0x6_0001` | `ECOIN_INFO_NOT_PUBLISHED` | Coin type not initialized | Initialize coin first with `coin::initialize` |
| `0x6_0002` | `ECOIN_STORE_NOT_PUBLISHED` | Account not registered for coin | Call `coin::register<CoinType>` or use `aptos_account::transfer_coins` |
| `0x8_0002` | `ECOIN_STORE_ALREADY_PUBLISHED` | Account already registered | Safe to ignore — already registered |
| `0x1_0003` | `EINSUFFICIENT_BALANCE` | Not enough coins | Check balance before operation |
| `0x3_0005` | `ECOIN_SUPPLY_UPGRADE_NOT_SUPPORTED` | Supply tracking cannot be upgraded | Must be set at initialization |
| `0x8_0004` | `ECOIN_INFO_ALREADY_PUBLISHED` | Coin type already initialized | Only one initialization per coin type |
| `0x3_0006` | `EFROZEN` | Coin store is frozen | Unfreeze the account's coin store |

## Object Errors (0x1::object)

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| `0x1_0001` | `EOBJECT_NOT_TRANSFERRABLE` | Object transfer disabled | Generate `TransferRef` at creation |
| `0x5_0002` | `ENOT_OBJECT_OWNER` | Caller does not own the object | Only owner can transfer |
| `0x6_0003` | `EOBJECT_DOES_NOT_EXIST` | No object at the address | Verify object address |
| `0x8_0004` | `EOBJECT_ALREADY_EXISTS` | Named object seed already used | Use different seed |
| `0x1_0005` | `ECANNOT_DELETE` | Object has resources attached | Remove all resources before deletion |

## Token V2 Errors (0x4::token)

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| `0x8_0001` | `ECOLLECTION_ALREADY_EXISTS` | Collection name already used by creator | Each creator can have one collection per name |
| `0x8_0002` | `ETOKEN_ALREADY_EXISTS` | Named token already exists | Token names must be unique per collection |
| `0x6_0003` | `ECOLLECTION_NOT_FOUND` | Collection does not exist | Create collection first |
| `0x9_0004` | `EMAX_SUPPLY_REACHED` | Fixed collection supply exhausted | Cannot mint beyond max supply |
| `0x5_0005` | `ENOT_CREATOR` | Caller is not the collection creator | Only creator can mint |

## Fungible Asset Errors (0x1::fungible_asset)

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| `0x1_0001` | `EINSUFFICIENT_BALANCE` | Not enough fungible asset | Check balance before operation |
| `0x3_0002` | `ESTORE_IS_FROZEN` | Fungible store is frozen | Unfreeze with `TransferRef` |
| `0x8_0003` | `ESTORE_ALREADY_EXISTS` | Primary store already created | Safe to ignore |
| `0x1_0004` | `EAMOUNT_IS_NOT_ZERO` | Expected zero balance | Withdraw all before deleting store |
| `0x9_0005` | `EMAX_SUPPLY_EXCEEDED` | Exceeds maximum supply | Cannot mint beyond configured max |

## Transaction-Level Errors

These errors come from the VM, not from Move code. They appear in transaction status.

| Error | Cause | Fix |
|-------|-------|-----|
| `SEQUENCE_NUMBER_TOO_OLD` | Nonce already used | Fetch current sequence number |
| `SEQUENCE_NUMBER_TOO_NEW` | Nonce too far ahead | Wait for pending transactions to land |
| `TRANSACTION_EXPIRED` | Expiration timestamp passed | Resubmit with new expiration |
| `INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE` | Cannot cover gas fee | Fund account with APT |
| `MAX_GAS_UNITS_EXCEEDS_MAX_GAS_UNITS_BOUND` | Gas limit too high | Reduce max gas units (max 2,000,000) |
| `GAS_UNIT_PRICE_BELOW_MIN_BOUND` | Gas price too low | Use at least 100 octas gas unit price |
| `VM_MAX_VALUE_DEPTH_REACHED` | Deeply nested struct | Flatten data structures |
| `EMODULE_NOT_FOUND` | Module does not exist at address | Verify module address and name |
| `EFUNCTION_NOT_FOUND` | Function does not exist in module | Check function name and visibility |
| `TYPE_MISMATCH` | Wrong type arguments | Verify type argument matches expected generic |
| `LINKER_ERROR` | Module dependency missing on chain | Publish dependencies first |

## Resource Account Errors

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| `0x5_0001` | `ECONTAINER_NOT_PUBLISHED` | No signer capability stored | Ensure `init_module` stored the capability |
| `0x3_0002` | `EALREADY_CLAIMED` | Signer capability already retrieved | Can only retrieve once in `init_module` |

## Staking Errors

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| `0x1_0001` | `ELOCK_TIME_TOO_SHORT` | Lock period below minimum | Use at least the minimum lockup period |
| `0x1_0002` | `EINSUFFICIENT_STAKE` | Stake below minimum | Meet minimum stake requirement (currently 1M APT for validators) |
| `0x3_0003` | `ESTAKE_POOL_DOES_NOT_EXIST` | No stake pool at address | Initialize stake pool first |
| `0x1_0005` | `ENOT_OPERATOR` | Caller is not the pool operator | Only operator can perform this action |

## Debugging Abort Codes

```typescript
function decodeAbortCode(code: number): { category: string; reason: number } {
  const categories: Record<number, string> = {
    0x1: "INVALID_ARGUMENT",
    0x2: "OUT_OF_RANGE",
    0x3: "INVALID_STATE",
    0x4: "UNAUTHENTICATED",
    0x5: "PERMISSION_DENIED",
    0x6: "NOT_FOUND",
    0x7: "ABORTED",
    0x8: "ALREADY_EXISTS",
    0x9: "RESOURCE_EXHAUSTED",
    0xa: "INTERNAL",
  };

  const category = (code >> 16) & 0xff;
  const reason = code & 0xffff;

  return {
    category: categories[category] ?? `UNKNOWN(0x${category.toString(16)})`,
    reason,
  };
}
```
