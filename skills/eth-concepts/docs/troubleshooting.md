# Ethereum Concepts Troubleshooting

Common issues when working with gas, storage, transactions, and EVM fundamentals.

## Gas Estimation Returns Wrong Value

**Symptoms:** `eth_estimateGas` returns a value, but the transaction reverts with out-of-gas when sent with that exact gas limit.

**Why it happens:** Gas estimation simulates against current state. If state changes between estimation and inclusion (another transaction modifies the same storage), the actual gas cost can differ. State-dependent paths (e.g., first-time vs repeat SSTORE) cause the largest swings.

**Solutions:**
1. Add a 20-30% buffer to estimated gas:
   ```bash
   cast estimate 0xContract "transfer(address,uint256)" 0xTo 1000000 --rpc-url $RPC
   # Multiply result by 1.2-1.3 for your gas limit
   ```
2. Use access lists to lock in warm/cold pricing:
   ```bash
   cast access-list 0xContract "swap(address,uint256)" 0xToken 1000 --rpc-url $RPC
   ```
3. For time-sensitive transactions, estimate and send in the same block using a private mempool (Flashbots).

## Storage Slot Read Returns Unexpected Value

**Symptoms:** `cast storage` returns a value that does not match what you expect from the contract's state.

**Causes:**
- **Wrong slot number.** Mappings and dynamic arrays do not store values at their declared slot. Compute the derived slot using `cast index` or manual `keccak256`.
- **Packed variables.** Multiple variables share one slot. The raw 32-byte value contains all packed values. Decode the specific byte range for your target variable.
- **Proxy contract.** You are reading the proxy's storage, but the variable layout is defined in the implementation. Verify the implementation address first:
  ```bash
  cast storage 0xProxy 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
  ```
- **Reading at wrong block.** State was different at a previous block:
  ```bash
  cast storage 0xContract 0 --block 18000000
  ```

## Variable Packing Not Saving Gas

**Symptoms:** You reordered variables to pack them, but gas usage did not decrease.

**Causes:**
1. **Variables accessed in different transactions.** Packing saves gas only when packed variables are read or written in the same transaction. If `a` and `b` are packed but only `a` is accessed, there is no benefit.
2. **Wrong declaration order.** Packing depends on declaration order, not alphabetical or logical order. Use `forge inspect Contract storage-layout` to verify actual layout.
3. **Struct packing caveat.** Structs always start a new slot. A `uint128` before a struct and a `uint128` inside the struct will not pack together.
4. **Optimizer interactions.** The Solidity optimizer may rearrange reads/writes. Verify actual gas with `forge test --gas-report`.

## Transaction Reverts With Out-of-Gas

**Symptoms:** Transaction fails with "out of gas" even though gas limit seems sufficient.

**Checklist:**
1. **Infinite loop or unbounded iteration.** Loops over dynamic arrays can exceed block gas limit. Check for `for` loops over `array.length` where the array grows without bound.
2. **Cold access costs underestimated.** First access to a storage slot or external address costs 2,100-2,600 gas. A function touching 20 cold slots adds ~42,000-52,000 gas.
3. **Deep call chains.** Each external call reserves 1/64th of remaining gas for the caller (EIP-150). Deep nesting compounds this reservation.
4. **Memory expansion.** Large memory allocations grow quadratically. Allocating 1 KB costs ~96 gas, but 10 KB costs ~9,600 gas and 100 KB costs ~960,000 gas.
5. **63/64 rule.** External calls forward at most 63/64 of available gas. This means deeply nested calls receive progressively less gas.

```bash
# Trace a failed transaction to find where gas ran out
cast run 0xTxHash --rpc-url $RPC
```

## Gas Refunds Not As Large As Expected

**Symptoms:** Clearing storage (setting non-zero to zero) should give a refund, but the transaction still costs more than expected.

**Why:** EIP-3529 (London fork) capped gas refunds at 20% of total gas used. Before London, the cap was 50%. This means:
- Clearing 10 storage slots gives `10 * 4,800 = 48,000` gas refund
- But if total gas used is 100,000, the maximum refund is `100,000 * 0.2 = 20,000`
- The excess 28,000 refund is lost

SELFDESTRUCT no longer grants a gas refund (EIP-3529).

## Block Gas Limit vs Transaction Gas Limit

**Block gas limit** (~30M gas on Ethereum mainnet, target 15M) is the maximum total gas for all transactions in one block. **Transaction gas limit** is the maximum gas a single transaction can use.

A single transaction cannot exceed the block gas limit. If your transaction requires more gas than the block limit, it is impossible to execute — split it into multiple transactions.

```bash
# Check current block gas limit
cast block latest gasLimit --rpc-url $RPC
```

## Why Is Storage So Expensive?

Every `SSTORE` modifies the global state trie — a Merkle Patricia Trie that all nodes must store permanently. The high gas cost (20,000 for new slots) reflects:

1. **State growth.** Each new slot increases the trie size permanently. Nodes cannot prune active state.
2. **Proof overhead.** Every state access requires a Merkle proof path (6-7 trie nodes). Writes update multiple trie nodes.
3. **Sync burden.** New nodes must download and verify the entire state to join the network.
4. **IO cost.** Storage reads hit disk (SSD), not just memory. The 2,100 cold SLOAD cost reflects actual disk IO.

This is why L2s are cheaper: they batch state roots and only post compressed data to L1, amortizing the trie cost across thousands of transactions.

## Wei / Gwei / Ether Conversion Confusion

**Symptoms:** Token amounts are wrong by orders of magnitude, or gas price calculations produce nonsensical values.

**The three units that matter:**

| Unit | Wei | Use Case |
|------|-----|----------|
| wei | 1 | Base unit. All EVM math uses wei. `msg.value` is in wei. |
| gwei | 10^9 | Gas prices. "30 gwei" means 30,000,000,000 wei per gas unit. |
| ether | 10^18 | Human-readable amounts. "1.5 ETH" = 1,500,000,000,000,000,000 wei. |

**Common mistakes:**
- Passing `1` as `msg.value` thinking it is 1 ETH (it is 1 wei = 0.000000000000000001 ETH)
- Displaying raw wei values to users without dividing by 10^18
- Mixing up gas price (gwei) with transaction value (wei/ether)
- Using JavaScript `number` for wei amounts — use `bigint` to avoid precision loss above 2^53

```bash
# Convert between units
cast to-wei 1.5 ether    # 1500000000000000000
cast from-wei 1500000000000000000  # 1.500000000000000000
cast to-wei 30 gwei       # 30000000000
```

## Access List Transactions Not Cheaper

**Symptoms:** Added an access list but gas cost increased or stayed the same.

**Why:** Access lists have an intrinsic cost: 2,400 gas per address + 1,900 per storage key. This is only beneficial if the cold access savings exceed the list's intrinsic cost.

- Cold address access without list: 2,600 gas. With list: 2,400 + 100 = 2,500. Savings: 100.
- Cold storage key without list: 2,100 gas. With list: 1,900 + 100 = 2,000. Savings: 100.

For contracts accessing few cold slots, the list overhead exceeds savings. Access lists are most useful for contracts touching many cold addresses/slots in a single call.

```bash
# Let the node compute the optimal access list
cast access-list 0xContract "execute()" --rpc-url $RPC
```
