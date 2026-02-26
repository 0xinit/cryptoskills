# Solidity Storage Layout Reference

How the Solidity compiler assigns state variables to 32-byte EVM storage slots, and how to read them directly.

## Slot Assignment Rules

State variables are assigned slots sequentially starting at slot 0. Each slot is 32 bytes (256 bits).

```solidity
contract Sequential {
    uint256 a;  // slot 0 — full 32 bytes
    uint256 b;  // slot 1
    address c;  // slot 2 — 20 bytes, but gets its own slot (next var doesn't fit)
    uint256 d;  // slot 3
}
```

## Packing Rules

Variables smaller than 32 bytes are packed into the same slot if they fit. Packing is right-aligned (lower-order bytes first) within a slot.

```solidity
contract Packed {
    uint128 a;  // slot 0, bytes 0-15
    uint128 b;  // slot 0, bytes 16-31 (fits in remaining space)
    uint256 c;  // slot 1 — needs full slot, starts new one
    uint8   d;  // slot 2, byte 0
    uint8   e;  // slot 2, byte 1
    address f;  // slot 2, bytes 2-21 (20 bytes, fits in remaining 30)
    uint64  g;  // slot 2, bytes 22-29 (8 bytes, fits in remaining 10)
    uint256 h;  // slot 3 — only 2 bytes left in slot 2, starts new slot
}
```

**Declaration order matters.** These two layouts have different slot counts:

```solidity
// 3 slots — poor packing
contract Bad {
    uint128 a;  // slot 0
    uint256 b;  // slot 1 (can't fit with a)
    uint128 c;  // slot 2 (separate slot)
}

// 2 slots — optimal packing
contract Good {
    uint128 a;  // slot 0, bytes 0-15
    uint128 c;  // slot 0, bytes 16-31
    uint256 b;  // slot 1
}
```

## Dynamic Arrays

The array length is stored at the declared slot `p`. Elements start at `keccak256(p)` and are laid out contiguously.

```
slot p            →  array.length
keccak256(p)      →  array[0]
keccak256(p) + 1  →  array[1]
keccak256(p) + n  →  array[n]
```

For arrays of types smaller than 32 bytes, elements pack within slots following the same rules as state variables.

```bash
# Read array length at slot 5
cast storage 0xContract 5

# Read array[0]: compute keccak256(slot) then read
cast keccak 0x0000000000000000000000000000000000000000000000000000000000000005
# Use the result as the slot number for array[0]
```

## Mappings

Mappings store nothing at their declared slot `p`. Each value lives at:

```
mapping[key]  →  keccak256(abi.encode(key, p))
```

Both `key` and `p` are left-padded to 32 bytes, then concatenated before hashing.

```bash
# Read balanceOf[0xUser] where balanceOf is at slot 3
cast index address 0xUserAddress 3 | xargs cast storage 0xContract
```

## Nested Mappings

Each nesting level wraps another `keccak256`:

```
mapping[k1][k2]      →  keccak256(abi.encode(k2, keccak256(abi.encode(k1, p))))
mapping[k1][k2][k3]  →  keccak256(abi.encode(k3, keccak256(abi.encode(k2, keccak256(abi.encode(k1, p))))))
```

For `mapping(address => mapping(address => uint256))` at slot 4 (e.g., allowance):

```bash
# Step 1: compute inner slot for owner
cast keccak $(cast abi-encode "x(address,uint256)" 0xOwner 4)

# Step 2: compute final slot for spender
cast keccak $(cast abi-encode "x(address,uint256)" 0xSpender <result-from-step-1>)

# Step 3: read the value
cast storage 0xContract <result-from-step-2>
```

## Strings and Bytes

Short values (31 bytes or fewer) are stored inline:

```
slot p: [data (high bytes)] [length * 2 (lowest byte)]
```

The lowest-order byte holds `length * 2`. Since the length is even, the lowest bit is 0, which signals "short encoding."

Long values (32+ bytes) use a different encoding:

```
slot p:           length * 2 + 1   (lowest bit = 1 signals "long encoding")
keccak256(p):     data[0..31]
keccak256(p)+1:   data[32..63]
...
```

```bash
# Read a short string at slot 6
cast storage 0xContract 6
# Decode: strip the last byte (length), remaining bytes are UTF-8 data
```

## Structs

Struct members are laid out sequentially from the struct's base slot, following the same packing rules as top-level variables.

```solidity
struct Position {
    address owner;  // base_slot, bytes 0-19
    uint96 amount;  // base_slot, bytes 20-31 (packed with owner)
    uint256 debt;   // base_slot + 1
}

contract Vault {
    uint256 totalDebt;       // slot 0
    Position position;       // slot 1 (owner + amount), slot 2 (debt)
    uint256 lastUpdate;      // slot 3
}
```

Struct arrays combine both rules: array base = `keccak256(p)`, then each element occupies `ceil(struct_size / 32)` consecutive slots.

## Constants and Immutables

Neither occupies a storage slot:

- **`constant`**: Value is inlined into bytecode at compile time. Cannot reference runtime data.
- **`immutable`**: Value is set in the constructor and appended to the deployed bytecode. Reads use `CODECOPY`, not `SLOAD`.

```solidity
contract Example {
    uint256 public constant FEE = 300;       // no storage slot, hardcoded in bytecode
    address public immutable FACTORY;        // no storage slot, embedded in deployed code
    uint256 public totalSupply;              // slot 0

    constructor(address factory) {
        FACTORY = factory;
    }
}
```

## Reading Storage with Foundry

```bash
# Read a single slot
cast storage 0xContract 0

# Read a packed slot and decode specific bytes
cast storage 0xContract 2
# Manually decode: rightmost bytes = first declared variable

# Read mapping value using cast index
# balanceOf(0xUser) at slot 3
cast index address 0xUserAddress 3 | xargs cast storage 0xContract

# In Foundry tests, use vm.load
bytes32 value = vm.load(contractAddress, bytes32(uint256(0)));

# Read all storage slots (useful for debugging)
cast storage 0xContract --etherscan-api-key $KEY
```

## Storage Collisions in Proxies

Proxy patterns use `DELEGATECALL`, so the implementation's code executes against the proxy's storage. If the proxy and implementation declare variables in different orders, storage collisions corrupt state.

### EIP-1967 Standard Proxy Slots

EIP-1967 defines deterministic slots that avoid collisions with implementation storage:

```
Implementation slot: keccak256("eip1967.proxy.implementation") - 1
  = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc

Admin slot: keccak256("eip1967.proxy.admin") - 1
  = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103

Beacon slot: keccak256("eip1967.proxy.beacon") - 1
  = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50
```

The `-1` ensures these slots cannot collide with Solidity's sequential allocation or `keccak256`-based dynamic layouts.

```bash
# Read implementation address behind a proxy
cast storage 0xProxy 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
```

### Collision Prevention Rules

1. Never add state variables before existing ones in upgradeable contracts
2. Always append new variables at the end
3. Use storage gaps (`uint256[50] private __gap`) to reserve space for future variables
4. Use namespaced storage (EIP-7201) for diamond/modular patterns
5. Run `forge inspect Contract storage-layout` to verify layout before upgrades
