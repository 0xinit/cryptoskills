# Stylus Storage Types Reference

All Stylus storage types map directly to EVM 256-bit storage slots. The layout is identical to Solidity — slot positions are deterministic and interchangeable between Solidity and Stylus implementations.

## Primitive Types

| Stylus Type | Solidity Equivalent | Slot Size | Usage |
|-------------|-------------------|-----------|-------|
| `StorageU256` | `uint256` | 1 full slot | Token amounts, counters, timestamps |
| `StorageU128` | `uint128` | Packed (16 bytes) | Smaller numeric values |
| `StorageU64` | `uint64` | Packed (8 bytes) | Block numbers, timestamps |
| `StorageU8` | `uint8` | Packed (1 byte) | Decimals, small flags |
| `StorageBool` | `bool` | Packed (1 byte) | Feature flags, paused state |
| `StorageAddress` | `address` | 1 slot (20 bytes used) | Addresses, owners, recipients |

### Imports

```rust
use stylus_sdk::storage::{
    StorageU256, StorageU128, StorageU64, StorageU8,
    StorageBool, StorageAddress,
};
```

### Read and Write

```rust
// Read
let value: U256 = self.my_u256.get();
let flag: bool = self.my_bool.get();
let addr: Address = self.my_address.get();

// Write
self.my_u256.set(U256::from(42));
self.my_bool.set(true);
self.my_address.set(new_address);
```

## Collection Types

| Stylus Type | Solidity Equivalent | Slot Computation |
|-------------|-------------------|------------------|
| `StorageVec<T>` | `T[]` | Length at slot N; elements at keccak256(N) + index |
| `StorageMap<K, V>` | `mapping(K => V)` | Value at keccak256(key . slot) |
| `StorageMap<K, StorageMap<K2, V>>` | `mapping(K => mapping(K2 => V))` | Nested keccak hashing |

### StorageVec

```rust
use stylus_sdk::storage::StorageVec;

#[storage]
pub struct MyContract {
    items: StorageVec<StorageU256>,
}

// Push
let mut slot = self.items.grow();
slot.set(U256::from(100));

// Read by index
if let Some(item) = self.items.get(0) {
    let val = item.get();
}

// Length
let len = self.items.len();
```

### StorageMap

```rust
use stylus_sdk::storage::StorageMap;

#[storage]
pub struct MyContract {
    balances: StorageMap<Address, StorageU256>,
}

// Read (returns zero default if key not set)
let balance = self.balances.get(account);

// Write (must use setter)
let mut slot = self.balances.setter(account);
slot.set(new_balance);
```

### Nested StorageMap

```rust
#[storage]
pub struct MyContract {
    // mapping(address => mapping(address => uint256))
    allowances: StorageMap<Address, StorageMap<Address, StorageU256>>,
}

// Read
let allowance = self.allowances.get(owner).get(spender);

// Write
self.allowances.setter(owner).setter(spender).set(amount);
```

## Dynamic Byte Types

| Stylus Type | Solidity Equivalent | Notes |
|-------------|-------------------|-------|
| `StorageString` | `string` | UTF-8 encoded, dynamic length |
| `StorageBytes` | `bytes` | Raw byte array, dynamic length |

```rust
use stylus_sdk::storage::{StorageString, StorageBytes};

// StorageString
let name: String = self.name.get_string();
self.name.set_str("NewName");

// StorageBytes
let data: Vec<u8> = self.data.get_bytes();
self.data.set_bytes(&new_data);
```

## Storage Layout Rules

### Slot Assignment

Fields are assigned sequential slots in declaration order, identical to Solidity:

```rust
#[storage]
pub struct Token {
    total_supply: StorageU256,  // slot 0
    owner: StorageAddress,      // slot 1
    paused: StorageBool,        // slot 2
    balances: StorageMap<Address, StorageU256>,  // slot 3 (base)
}
```

### Mapping Slot Computation

Map values are stored at `keccak256(key . baseSlot)`, matching Solidity exactly. This means:

- `self.balances.get(addr)` reads from `keccak256(addr . 3)` (if balances is at slot 3)
- A Solidity contract reading `balances[addr]` at slot 3 gets the same value

### Vec Slot Computation

- Length stored at the base slot
- Elements stored at `keccak256(baseSlot) + index`

## Gas Costs

Storage operations in Stylus cost the same as Solidity because they use the same EVM storage layer:

| Operation | Gas Cost |
|-----------|----------|
| SLOAD (cold) | 2,100 |
| SLOAD (warm) | 100 |
| SSTORE (cold, zero → non-zero) | 20,000 |
| SSTORE (cold, non-zero → non-zero) | 2,900 |
| SSTORE (warm) | 100 |

The WASM computation around storage access is where Stylus saves gas — the storage I/O itself is identical.

## Comparison with Solidity

| Feature | Solidity | Stylus |
|---------|----------|--------|
| Storage layout | Sequential slots | Sequential slots (identical) |
| Mapping key hashing | keccak256(key . slot) | keccak256(key . slot) (identical) |
| Dynamic array | Length at slot, elements at keccak256(slot) | Same |
| Packed storage | Multiple small types per slot | Supported via StorageU8, StorageBool |
| Custom structs | Nested struct = sequential sub-slots | Nested #[storage] structs |
| Immutable variables | `immutable` keyword, stored in bytecode | No direct equivalent; use constants in Rust |
| Transient storage (EIP-1153) | `tstore`/`tload` | Not yet available in Stylus SDK |
