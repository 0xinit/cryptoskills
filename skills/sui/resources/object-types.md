# Sui Object Types Reference

## Object Ownership Model

Every object on Sui has exactly one ownership state. The ownership model is fundamental to Sui's parallel execution -- transactions on different owned objects never conflict.

### Ownership Types

| Ownership | Access | Consensus | Parallel | How to Create |
|-----------|--------|-----------|----------|---------------|
| **Owned** | Only the owning address | No | Yes (across different owners) | `transfer::transfer(obj, addr)` or `transfer::public_transfer(obj, addr)` |
| **Shared** | Any address | Yes (ordered) | No (serialized for same object) | `transfer::share_object(obj)` or `transfer::public_share_object(obj)` |
| **Immutable** | Any address (read-only) | No | Yes | `transfer::freeze_object(obj)` or `transfer::public_freeze_object(obj)` |
| **Wrapped** | Via parent object only | Depends on parent | Depends on parent | Store as field in another struct |

### When to Use Each

| Use Case | Ownership | Rationale |
|----------|-----------|-----------|
| User wallet assets (NFTs, coins) | Owned | Only the owner transacts; parallel execution |
| Global counters, registries | Shared | Multiple users must read/write the same state |
| Configuration, metadata | Immutable | Set once, never changes; everyone can read for free |
| Composable child objects | Wrapped | Object is part of another object's internal state |

## Struct Ability Combinations

| Abilities | Is Sui Object? | Transferable by PTB? | Can Be Stored in Other Objects? | Common Use |
|-----------|---------------|---------------------|-------------------------------|------------|
| `key` | Yes | No (module-only transfer) | No | Objects with restricted transfer logic |
| `key, store` | Yes | Yes (`public_transfer`) | Yes | NFTs, coins, general-purpose objects |
| `store` | No | N/A | Yes | Data stored inside objects (not top-level) |
| `copy, drop` | No | N/A | No | Events, witnesses |
| `drop` | No | N/A | No | One-time witnesses, hot potato receipts (combined with nothing else) |
| (none) | No | N/A | No | Hot potato -- must be consumed in same transaction |

## Core Framework Types

### sui::object

| Type | Description |
|------|-------------|
| `UID` | Unique identifier for Sui objects. Must be the first field of any `key` struct. Created via `object::new(ctx)`. |
| `ID` | A copyable/droppable reference to an object ID. Obtained via `object::id(&obj)`. |

### sui::coin

| Type | Description |
|------|-------------|
| `Coin<T>` | A typed coin object. Has `key, store`. Balance is stored internally. |
| `TreasuryCap<T>` | Capability to mint/burn coins of type `T`. Has `key, store`. |
| `CoinMetadata<T>` | Metadata (name, symbol, decimals, icon). Has `key, store`. |
| `DenyCap<T>` | Capability to deny specific addresses from holding regulated coins. |

### sui::balance

| Type | Description |
|------|-------------|
| `Balance<T>` | Non-object wrapper for coin amounts. Has `store` only (not `key`). Used inside custom objects to hold funds without creating separate coin objects. |
| `Supply<T>` | Tracks total supply of a coin type. |

`Balance<T>` vs `Coin<T>`:
- Use `Coin<T>` when the balance should be a standalone transferable object
- Use `Balance<T>` when embedding funds inside another object (avoids creating a child object)

### sui::table and sui::bag

| Type | Key Constraint | Value Constraint | Description |
|------|---------------|-----------------|-------------|
| `Table<K, V>` | Homogeneous K | Homogeneous V | Typed key-value map. All keys same type, all values same type. |
| `ObjectTable<K, V>` | Homogeneous K | Homogeneous V (must have `key + store`) | Like Table but values are Sui objects. |
| `Bag` | Heterogeneous | Heterogeneous | Untyped key-value map. Different keys and values can have different types. |
| `ObjectBag` | Heterogeneous | Heterogeneous (must have `key + store`) | Like Bag but values are Sui objects. |

### sui::dynamic_field and sui::dynamic_object_field

| Module | Value Constraint | Object Accessible by ID? | Use Case |
|--------|-----------------|------------------------|----------|
| `dynamic_field` | Any type with `store` | No (wrapped) | Primitive values, non-object data |
| `dynamic_object_field` | Must have `key + store` | Yes (still exists as top-level object) | Child objects that should remain independently queryable |

### sui::clock

```move
use sui::clock::Clock;

// Pass Clock as shared immutable reference
public entry fun do_something(clock: &Clock) {
    let timestamp_ms: u64 = clock::timestamp_ms(clock);
}
```

Clock object ID is always `0x6`. Pass it as a shared object reference in transactions.

### sui::event

```move
use sui::event;

public struct MyEvent has copy, drop {
    value: u64,
}

public fun emit_event(value: u64) {
    event::emit(MyEvent { value });
}
```

Events must have `copy` and `drop` abilities. They are not stored on-chain as objects -- they exist only in transaction effects.

### sui::display

| Type | Description |
|------|-------------|
| `Display<T>` | Defines how objects of type `T` appear in wallets and explorers. Fields like `name`, `image_url`, `description` are interpolated from object fields. |

### sui::package

| Type | Description |
|------|-------------|
| `UpgradeCap` | Capability to upgrade a published package. Destroying it makes the package immutable. |
| `UpgradeTicket` | One-time authorization to perform an upgrade (created from UpgradeCap). |
| `UpgradeReceipt` | Proof that an upgrade was performed (consumed by `commit_upgrade`). |
| `Publisher` | Proof that the holder published a specific package. Used to create `Display` and `TransferPolicy`. |

### sui::kiosk

| Type | Description |
|------|-------------|
| `Kiosk` | A shared object that holds items for sale. |
| `KioskOwnerCap` | Owned capability granting management rights over a Kiosk. |
| `PurchaseCap<T>` | Capability allowing purchase of a specific item from a kiosk. |

### sui::transfer_policy

| Type | Description |
|------|-------------|
| `TransferPolicy<T>` | Rules governing how objects of type `T` can be traded. Enforced by kiosks. |
| `TransferPolicyCap<T>` | Capability to modify the transfer policy for type `T`. |
| `TransferRequest<T>` | A "hot potato" that must be resolved by satisfying all policy rules before the transfer completes. |

## Move.toml Type Addresses

When referencing types in TypeScript, the full type string includes the package address:

```typescript
// Framework types
const SUI_TYPE = "0x2::sui::SUI";
const COIN_TYPE = "0x2::coin::Coin<0x2::sui::SUI>";
const CLOCK_TYPE = "0x2::clock::Clock";

// Custom types use the published package address
const MY_NFT_TYPE = "0xPACKAGE_ID::nft::MyNFT";
```

When filtering objects by type in `getOwnedObjects`, use the `StructType` filter with the full type string (no angle brackets for the outer type).

Last verified: 2026-02-26
