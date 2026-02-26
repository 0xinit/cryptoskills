# EVM Gas Costs Reference

Comprehensive gas cost table for EVM opcodes and common operations. All costs reflect post-Shanghai/Dencun pricing with EIP-2929 warm/cold access semantics.

## Arithmetic & Logic Opcodes

| Opcode | Gas | Description |
|--------|-----|-------------|
| ADD, SUB | 3 | Addition, subtraction |
| MUL, DIV, SDIV, MOD, SMOD | 5 | Multiplication, division, modulo |
| ADDMOD, MULMOD | 8 | Modular addition, modular multiplication |
| EXP | 10 + 50 * byte_len(exponent) | Exponentiation |
| SIGNEXTEND | 5 | Sign extension |
| LT, GT, SLT, SGT, EQ | 3 | Comparison operations |
| ISZERO, AND, OR, XOR, NOT | 3 | Bitwise operations |
| BYTE, SHL, SHR, SAR | 3 | Byte/shift operations |
| KECCAK256 | 30 + 6 * ceil(size / 32) | Keccak-256 hash |

## Stack, Memory & Flow Opcodes

| Opcode | Gas | Description |
|--------|-----|-------------|
| POP | 2 | Remove top stack item |
| MLOAD, MSTORE | 3 + memory expansion | Load/store 32 bytes in memory |
| MSTORE8 | 3 + memory expansion | Store 1 byte in memory |
| PUSH1-PUSH32 | 3 | Push N bytes onto stack |
| DUP1-DUP16 | 3 | Duplicate Nth stack item |
| SWAP1-SWAP16 | 3 | Swap top with Nth stack item |
| JUMP | 8 | Unconditional jump |
| JUMPI | 10 | Conditional jump |
| CALLDATALOAD | 3 | Load 32 bytes from calldata |
| CALLDATACOPY | 3 + 3 * ceil(size / 32) + memory expansion | Copy calldata to memory |
| CODECOPY | 3 + 3 * ceil(size / 32) + memory expansion | Copy code to memory |
| RETURNDATACOPY | 3 + 3 * ceil(size / 32) + memory expansion | Copy return data to memory |

## Storage Opcodes (EIP-2929 Warm/Cold)

| Operation | Gas | Condition |
|-----------|-----|-----------|
| SLOAD (cold) | 2,100 | First access to slot in transaction |
| SLOAD (warm) | 100 | Slot already accessed this transaction |
| SSTORE: zero -> non-zero | 20,000 | Setting a fresh storage slot |
| SSTORE: non-zero -> non-zero | 2,900 | Updating an existing value |
| SSTORE: non-zero -> zero | 2,900 + 4,800 refund | Clearing a slot (net ~100 after refund) |
| SSTORE: zero -> zero | 100 | No-op write to empty slot (warm) |
| SSTORE cold surcharge | +2,100 | Added if slot not yet accessed |

Gas refunds are capped at 20% of total transaction gas used (EIP-3529, post-London).

## Account Access Opcodes (EIP-2929)

| Operation | Gas | Condition |
|-----------|-----|-----------|
| BALANCE (cold) | 2,600 | First access to address in transaction |
| BALANCE (warm) | 100 | Address already accessed |
| EXTCODESIZE (cold) | 2,600 | First access |
| EXTCODESIZE (warm) | 100 | Already accessed |
| EXTCODECOPY (cold) | 2,600 + 3 * ceil(size / 32) | First access |
| EXTCODECOPY (warm) | 100 + 3 * ceil(size / 32) | Already accessed |
| EXTCODEHASH (cold) | 2,600 | First access |
| EXTCODEHASH (warm) | 100 | Already accessed |

## Call Opcodes

| Opcode | Gas | Notes |
|--------|-----|-------|
| CALL (cold) | 2,600 + memory expansion | +9,000 if sending ETH to new account |
| CALL (warm) | 100 + memory expansion | +9,000 if sending ETH to new account |
| DELEGATECALL (cold) | 2,600 + memory expansion | Executes in caller's context |
| DELEGATECALL (warm) | 100 + memory expansion | |
| STATICCALL (cold) | 2,600 + memory expansion | Reverts on state modification |
| STATICCALL (warm) | 100 + memory expansion | |
| CREATE | 32,000 + deployment costs | `keccak256(rlp(sender, nonce))` |
| CREATE2 | 32,000 + 6 * ceil(size / 32) + deployment | Adds initcode hashing cost |
| SELFDESTRUCT | 5,000 | +25,000 if sending to cold address |

## Log Opcodes

| Opcode | Gas | Formula |
|--------|-----|---------|
| LOG0 | 375 + 8 * data_bytes | No indexed topics |
| LOG1 | 750 + 8 * data_bytes | 1 indexed topic |
| LOG2 | 1,125 + 8 * data_bytes | 2 indexed topics |
| LOG3 | 1,500 + 8 * data_bytes | 3 indexed topics |
| LOG4 | 1,875 + 8 * data_bytes | 4 indexed topics |

Each topic costs 375 gas. Base LOG cost is 375.

## Memory Expansion Cost

Memory cost grows quadratically. The cost for expanding memory to `a` words (32-byte units):

```
memory_cost(a) = 3 * a + floor(a^2 / 512)
```

Expansion cost = `memory_cost(new_size) - memory_cost(old_size)`. First ~724 bytes are roughly linear (3 gas per word). Beyond that, the quadratic term dominates.

## Transaction Intrinsic Gas

Every transaction pays a base cost before any EVM execution:

| Component | Gas |
|-----------|-----|
| Base transaction cost | 21,000 |
| Per zero byte in calldata | 4 |
| Per non-zero byte in calldata | 16 |
| Contract creation (CREATE via tx) | +32,000 |
| Access list: per address | +2,400 |
| Access list: per storage key | +1,900 |

Example: a 200-byte calldata payload with 50 zero bytes and 150 non-zero bytes costs `21,000 + (50 * 4) + (150 * 16) = 23,600` gas before execution.

## EIP-4844 Blob Gas

Blob transactions (Type 3) carry a separate gas dimension:

| Parameter | Value |
|-----------|-------|
| Gas per blob | 131,072 (2^17) |
| Target blobs per block | 3 (393,216 blob gas) |
| Max blobs per block | 6 (786,432 blob gas) |
| Blob size | 128 KB (4096 field elements) |
| Min blob base fee | 1 wei |
| Blob base fee adjustment | Same EIP-1559 mechanism, independent market |

Blob gas cost = `blob_count * 131,072 * blob_base_fee`. Blobs are pruned from consensus after ~18 days.

## Deployment Gas Costs

| Component | Gas |
|-----------|-----|
| CREATE opcode | 32,000 |
| Code deposit (per byte) | 200 |
| Initcode execution | Variable |
| Initcode word charge (EIP-3860) | 2 per 32-byte word |

A contract with 10 KB of deployed bytecode costs at minimum `32,000 + (10,240 * 200) = 2,080,000` gas for deployment, plus initcode execution and constructor logic.

## Common Operation Gas Benchmarks

Typical gas usage for real-world operations (approximate, depends on contract implementation):

| Operation | Approximate Gas | Notes |
|-----------|----------------|-------|
| ETH transfer | 21,000 | Exact, no calldata |
| ERC-20 transfer | ~65,000 | Includes SSTORE for balance update |
| ERC-20 approve | ~46,000 | Single SSTORE for allowance |
| ERC-20 transferFrom | ~80,000 | Two SSTOREs (balance + allowance) |
| ERC-721 transfer | ~85,000 | Ownership + balance updates |
| ERC-721 mint | ~95,000 | New token creation |
| Uniswap V2 swap | ~150,000 | Pair contract swap |
| Uniswap V3 swap | ~185,000 | Concentrated liquidity, tick crossing |
| Uniswap V3 multi-hop (2 pools) | ~350,000 | Two sequential swaps |
| Aave V3 supply | ~250,000 | Deposit collateral |
| Aave V3 borrow | ~350,000 | Borrow with health check |
| OpenSea NFT purchase | ~250,000 | Seaport fulfillment |
| ENS name registration | ~300,000 | Includes resolver setup |
| Safe (multisig) execute | ~150,000+ | Scales with signatures and calldata |

## Gas Optimization Quick Reference

| Technique | Savings | Mechanism |
|-----------|---------|-----------|
| Pack storage variables | Up to 15,000 per slot saved | Fewer SSTORE/SLOAD operations |
| Use `uint256` over smaller uints (unpacked) | ~3-10 per operation | Avoids masking/shifting overhead |
| Cache storage reads in memory | 2,000 per avoided SLOAD | Warm SLOAD still costs 100 |
| Use `calldata` over `memory` for read-only params | ~60+ per parameter | Avoids memory copy |
| Use custom errors over require strings | ~50+ per revert path | No ABI-encoded string storage |
| Use `unchecked` for safe arithmetic | ~20-80 per operation | Skips overflow checks |
| Short-circuit with early revert | Variable | Avoids unnecessary computation |
| Use mappings over arrays for lookups | ~2,000+ | O(1) vs O(n) storage access |
| Batch operations in single transaction | 21,000 per avoided tx | Amortize base transaction cost |
| Use EIP-2930 access lists | 100-200 per pre-declared slot | Reduces cold access surcharge |
