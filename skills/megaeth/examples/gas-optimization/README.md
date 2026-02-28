# Gas Optimization on MegaETH

MegaETH uses a dual gas model where storage operations are dramatically more expensive than compute. On Ethereum, SSTORE (0 to non-zero) costs 20,000 gas. On MegaETH, the same operation costs 2,000,000+ gas multiplied by a bucket multiplier. Optimization on MegaETH is about avoiding new storage slot allocation.

## MegaETH Gas Cost Summary

| Operation | Ethereum | MegaETH | Difference |
|-----------|----------|---------|------------|
| Simple transfer (intrinsic) | 21,000 | 60,000 | 2.9x (21K compute + 39K storage) |
| SSTORE (0 to non-zero) | 20,000 | 2,002,100+ | 100x+ (with bucket multiplier) |
| SSTORE (non-zero to non-zero) | 5,000 | 22,100 (mult=1) | 4.4x |
| SLOAD | 2,100 | 2,100 | Same |
| Compute opcodes | Standard | Standard | Same |

## SSTORE Bucket Multiplier

Storage gas scales with the bucket multiplier -- a function of how many new slots the transaction allocates:

| Bucket Multiplier | Storage Gas | Total Gas per SSTORE |
|-------------------|-------------|----------------------|
| 1 | 0 | 22,100 |
| 2 | 20,000 | 42,100 |
| 10 | 180,000 | 202,100 |
| 100 | 1,980,000 | 2,002,100 |

When the multiplier is 1 (reusing an existing slot), storage gas is zero. This is why slot reuse is the single most impactful optimization on MegaETH.

## Pattern 1: Circular Buffer (Slot Reuse)

Replace unbounded mappings with fixed-size circular buffers. Once all slots are allocated on first pass, subsequent writes reuse existing slots at multiplier = 1.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CircularPriceOracle {
    error CircularPriceOracle__ZeroPrice();
    error CircularPriceOracle__EmptyBuffer();

    event PriceUpdated(uint256 indexed slot, uint256 price, uint256 timestamp);

    /// @dev 100 slots -- after initial fill, all writes reuse existing slots
    uint256 private constant BUFFER_SIZE = 100;

    struct PriceEntry {
        uint128 price;
        uint128 timestamp;
    }

    /// @dev Fixed-size array -- slots are allocated once, reused forever
    PriceEntry[100] public prices;
    uint256 public head;

    /// @notice Push a new price, overwriting the oldest entry
    /// @dev After BUFFER_SIZE writes, SSTORE bucket multiplier drops to 1 (zero storage gas)
    function updatePrice(uint128 price) external {
        if (price == 0) revert CircularPriceOracle__ZeroPrice();

        uint256 slot = head;
        prices[slot] = PriceEntry({
            price: price,
            timestamp: uint128(block.timestamp)
        });

        emit PriceUpdated(slot, price, block.timestamp);
        head = (slot + 1) % BUFFER_SIZE;
    }

    /// @notice Read the latest price
    function latestPrice() external view returns (uint128 price, uint128 timestamp) {
        uint256 slot = head == 0 ? BUFFER_SIZE - 1 : head - 1;
        PriceEntry storage entry = prices[slot];
        if (entry.price == 0) revert CircularPriceOracle__EmptyBuffer();
        return (entry.price, entry.timestamp);
    }
}
```

### Gas comparison

```
First 100 writes:   ~2,002,100 gas each (new slot allocation)
Writes 101+:        ~22,100 gas each    (slot reuse, multiplier = 1)
Savings after fill:  ~99% reduction per write
```

## Pattern 2: RedBlackTreeLib (Solady)

Solady's `RedBlackTreeLib` uses contiguous storage slots with internal reuse. Insertions and deletions rebalance within the same slot range.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RedBlackTreeLib} from "solady/src/utils/RedBlackTreeLib.sol";

contract OrderedSet {
    using RedBlackTreeLib for RedBlackTreeLib.Tree;

    error OrderedSet__ValueExists();
    error OrderedSet__ValueNotFound();

    event ValueInserted(uint256 indexed value);
    event ValueRemoved(uint256 indexed value);

    RedBlackTreeLib.Tree private _tree;

    /// @notice Insert a value into the ordered set
    /// @dev Tree nodes reuse storage slots internally -- amortized O(1) new slot allocation
    function insert(uint256 value) external {
        if (_tree.exists(value)) revert OrderedSet__ValueExists();
        _tree.insert(value);
        emit ValueInserted(value);
    }

    /// @notice Remove a value from the ordered set
    function remove(uint256 value) external {
        if (!_tree.exists(value)) revert OrderedSet__ValueNotFound();
        _tree.remove(value);
        emit ValueRemoved(value);
    }

    /// @notice Get the smallest value
    function first() external view returns (uint256) {
        return _tree.first();
    }

    /// @notice Get the largest value
    function last() external view returns (uint256) {
        return _tree.last();
    }

    /// @notice Get the next value after the given value
    function next(uint256 value) external view returns (uint256) {
        return _tree.next(value);
    }
}
```

Install Solady:

```bash
forge install vectorized/solady --no-commit
```

## Pattern 3: Transient Storage (EIP-1153)

`TSTORE`/`TLOAD` store data that persists only within the current transaction. Zero storage gas -- the data is never written to persistent state.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ReentrancyGuardTransient {
    error ReentrancyGuardTransient__Reentrant();

    /// @dev Slot for the reentrancy lock in transient storage
    uint256 private constant _LOCK_SLOT = 0x1;

    modifier nonReentrant() {
        assembly {
            if tload(_LOCK_SLOT) {
                mstore(0x00, 0x37ed32aa) // ReentrancyGuardTransient__Reentrant()
                revert(0x1c, 0x04)
            }
            tstore(_LOCK_SLOT, 1)
        }
        _;
        assembly {
            tstore(_LOCK_SLOT, 0)
        }
    }
}
```

### Transient storage for temporary computation results

```solidity
contract BatchProcessor {
    error BatchProcessor__EmptyBatch();

    event BatchProcessed(uint256 indexed batchId, uint256 total);

    /// @notice Process a batch using transient storage for intermediate accumulation
    /// @dev Avoids SSTORE entirely for temporary values within a single transaction
    function processBatch(uint256 batchId, uint256[] calldata values) external {
        if (values.length == 0) revert BatchProcessor__EmptyBatch();

        uint256 total;
        assembly {
            for { let i := 0 } lt(i, values.length) { i := add(i, 1) } {
                let val := calldataload(add(values.offset, mul(i, 0x20)))
                let accumulated := tload(0x00)
                accumulated := add(accumulated, val)
                tstore(0x00, accumulated)
            }
            total := tload(0x00)
            tstore(0x00, 0) // clean up
        }

        emit BatchProcessed(batchId, total);
    }
}
```

## Pattern 4: SSTORE2 (Immutable Data as Bytecode)

Store large immutable data as contract bytecode instead of storage slots. Reads use `EXTCODECOPY` which is free on MegaETH.

| Approach | Write Cost | Read Cost |
|----------|------------|-----------|
| SSTORE (slots) | 2M+ gas per new slot | 100-2100 gas |
| SSTORE2 (bytecode) | ~10K gas per byte | Free (EXTCODECOPY) |

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SSTORE2} from "solady/src/utils/SSTORE2.sol";

contract ImmutableRegistry {
    error ImmutableRegistry__EmptyData();
    error ImmutableRegistry__AlreadySet();

    event DataStored(bytes32 indexed key, address pointer);

    /// @dev Maps keys to SSTORE2 pointers (contract addresses holding data as bytecode)
    mapping(bytes32 => address) public pointers;

    /// @notice Store immutable data, paying bytecode deployment cost once
    /// @param key Unique identifier for this data blob
    /// @param data The data to store
    function store(bytes32 key, bytes calldata data) external {
        if (data.length == 0) revert ImmutableRegistry__EmptyData();
        if (pointers[key] != address(0)) revert ImmutableRegistry__AlreadySet();

        address pointer = SSTORE2.write(data);
        pointers[key] = pointer;

        emit DataStored(key, pointer);
    }

    /// @notice Read stored data -- free via EXTCODECOPY
    /// @param key The key to look up
    function read(bytes32 key) external view returns (bytes memory) {
        address pointer = pointers[key];
        if (pointer == address(0)) return "";
        return SSTORE2.read(pointer);
    }
}
```

## Pattern 5: EIP-6909 over ERC-1155

EIP-6909 removes mandatory callback hooks and enables single-contract multi-token management with fewer storage operations.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC6909} from "solady/src/tokens/ERC6909.sol";

contract GameItems is ERC6909 {
    error GameItems__Unauthorized();

    event ItemMinted(address indexed to, uint256 indexed id, uint256 amount);

    address public immutable admin;

    constructor() {
        admin = msg.sender;
    }

    /// @notice Mint game items -- single SSTORE per balance update
    /// @dev ERC-6909 has no mandatory callbacks, saving gas on transfers
    function mint(address to, uint256 id, uint256 amount) external {
        if (msg.sender != admin) revert GameItems__Unauthorized();
        _mint(to, id, amount);
        emit ItemMinted(to, id, amount);
    }

    /// @notice Token metadata URI
    function tokenURI(uint256 id) public pure override returns (string memory) {
        return string.concat("https://api.example.com/items/", _toString(id));
    }

    function _toString(uint256 value) internal pure returns (string memory result) {
        assembly {
            result := mload(0x40)
            let ptr := add(result, 0x20)
            mstore(0x40, add(ptr, 0x20))
            if iszero(value) {
                mstore(ptr, "0")
                mstore(result, 1)
                leave
            }
            let end := ptr
            for {} value {} {
                ptr := sub(ptr, 1)
                mstore8(ptr, add(48, mod(value, 10)))
                value := div(value, 10)
            }
            let len := sub(end, ptr)
            result := sub(ptr, 0x20)
            mstore(result, len)
        }
    }
}
```

## Pattern 6: LOG Opcode Size Awareness

LOG opcodes have quadratic cost above 4KB data. Emit a hash and store large payloads off-chain.

```solidity
contract EventOptimized {
    /// @dev Emit full data when small -- hash when large
    /// @dev LOG cost is quadratic above 4KB on MegaETH
    event SmallData(bytes32 indexed key, bytes data);
    event LargeDataHash(bytes32 indexed key, bytes32 dataHash, uint256 dataSize);

    uint256 private constant MAX_INLINE_SIZE = 4096;

    function emitData(bytes32 key, bytes calldata data) external {
        if (data.length <= MAX_INLINE_SIZE) {
            emit SmallData(key, data);
        } else {
            emit LargeDataHash(key, keccak256(data), data.length);
        }
    }
}
```

## Profiling Gas Usage

### Foundry Fork Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CircularPriceOracle} from "../src/CircularPriceOracle.sol";

contract GasProfileTest is Test {
    CircularPriceOracle oracle;

    function setUp() public {
        vm.createSelectFork("https://carrot.megaeth.com/rpc");
        oracle = new CircularPriceOracle();
    }

    function testGas_firstWrite() public {
        uint256 gasBefore = gasleft();
        oracle.updatePrice(100e8);
        uint256 gasUsed = gasBefore - gasleft();
        console.log("First write (new slot):", gasUsed);
    }

    function testGas_slotReuse() public {
        // Fill all 100 slots first
        for (uint256 i = 0; i < 100; i++) {
            oracle.updatePrice(uint128(i + 1));
        }

        // Slot 0 is now being reused
        uint256 gasBefore = gasleft();
        oracle.updatePrice(999e8);
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Reuse write (existing slot):", gasUsed);
    }
}
```

```bash
forge test --match-test testGas -vv --skip-simulation
```

### mega-evme Trace

```bash
# Replay and trace a transaction to see per-opcode gas breakdown
mega-evme replay <txhash> --trace --trace.output trace.json --rpc https://mainnet.megaeth.com/rpc
```

## Optimization Checklist

| Optimization | Impact | When to Use |
|-------------|--------|-------------|
| Circular buffer | High | Any bounded dataset (price feeds, logs, queues) |
| RedBlackTreeLib | High | Ordered sets with insert/delete |
| Transient storage | High | Temporary values within a single transaction |
| SSTORE2 | High | Large immutable data blobs |
| EIP-6909 over ERC-1155 | Medium | Multi-token contracts |
| Struct packing | Medium | Multiple values fitting in one 32-byte slot |
| LOG size < 4KB | Medium | Events with variable-size data |
| Late metadata access | Low-Medium | Contracts using block.timestamp/block.number |

## Common Pitfalls

1. **Using dynamic mappings for bounded data** -- Every new mapping key allocates a new storage slot at 2M+ gas. If the data is bounded (e.g., last N prices), use a fixed-size array with circular indexing.

2. **Initializing many storage slots in a constructor** -- Contract deployment that writes to hundreds of slots will cost orders of magnitude more than on Ethereum. Use SSTORE2 for initial data or lazy initialization.

3. **Assuming Ethereum gas costs** -- Foundry and Hardhat simulate with standard EVM costs. Your local gas profile will not match MegaETH. Always test on the testnet fork with `vm.createSelectFork("https://carrot.megaeth.com/rpc")`.

4. **Using `via_ir = true` in foundry.toml** -- Silently breaks return values on MegaETH. Functions return 0 instead of correct values. Use `optimizer = true` with `optimizer_runs = 200`.
