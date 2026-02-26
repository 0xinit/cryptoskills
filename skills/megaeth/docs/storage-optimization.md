# Storage Optimization

## The Problem

MegaETH charges high gas for new storage slot creation to prevent state bloat:

```
SSTORE (0 -> non-zero): 2,000,000 gas x bucket_multiplier
```

The bucket multiplier scales with usage (1x, 2x, 4x, 8x...). This makes Solidity mappings with dynamic keys expensive.

## Solution 1: Solady RedBlackTreeLib

Replace Solidity mappings with Solady's RedBlackTreeLib:

```solidity
import {RedBlackTreeLib} from "solady/src/utils/RedBlackTreeLib.sol";

contract StorageOptimized {
    using RedBlackTreeLib for RedBlackTreeLib.Tree;
    RedBlackTreeLib.Tree private _tree;

    // Tree manages contiguous storage slots [from, to)
    // Insert: allocates slot at index `to`
    // Remove: swap-removes with slot at `to - 1`
    // Result: slots are reused, no new allocations
}
```

Avoid resetting the last slot immediately -- reuse it for the next insert.

## Solution 2: Storage Slot Reuse

Design contracts to reuse existing slots:

```solidity
// Bad: constantly allocating new slots
mapping(uint256 => uint256) public data;
function process(uint256 key, uint256 value) {
    data[key] = value;
    delete data[key]; // Slot freed but not reused
}

// Better: fixed-size array with circular buffer
uint256[100] public buffer;
uint256 public head;
function process(uint256 value) {
    buffer[head] = value; // Reuses existing slot
    head = (head + 1) % 100;
}
```

## Solution 3: ZK Compression

For apps with large state requirements:

1. Store only a hash/commitment on-chain
2. Provide pre-state + proof with each transaction
3. Contract verifies proof, applies state transition, stores new commitment

```solidity
contract ZKCompressed {
    bytes32 public stateRoot;

    function update(
        bytes32 newRoot,
        bytes calldata preState,
        bytes calldata proof
    ) external {
        require(verify(stateRoot, preState, proof), "Invalid proof");
        stateRoot = newRoot; // Only 1 storage slot
    }
}
```

Trade-off: More compute gas, much less storage gas. Good fit for MegaETH since compute is cheap.

## Solution 4: Off-Chain Storage

For large static data:
- Use IPFS/Arweave for storage
- Store content hash on-chain
- Verify in contract if needed

```solidity
contract HybridStorage {
    mapping(bytes32 => bool) public verified;

    function verifyData(bytes32 hash, bytes calldata data) external {
        require(keccak256(data) == hash, "Hash mismatch");
        verified[hash] = true;
    }
}
```

## Gas Cost Reference

| Operation | Standard EVM | MegaETH |
|-----------|-------------|---------|
| SSTORE (0->non-zero) | 20,000 | 2,000,000 x multiplier |
| SSTORE (non-zero->non-zero) | 5,000 | ~100-2,100 |
| SLOAD (warm) | 100 | 100 |
| SLOAD (cold) | 2,100 | 2,100 |

## State Size Considerations

MegaETH's state trie scales to 1+ TB but storage remains a scarce resource. At $0.10 per new slot:
- 1 billion slots = 64 GB state = $100M in fees

Future: State rent and state expiry mechanisms planned.

## Debugging Storage Costs

Profile gas by opcode:

```bash
mega-evme replay <txhash> --trace --trace.output trace.json
python trace_opcode_gas.py trace.json
```

Look for high SSTORE counts with 0-to-non-zero transitions.
