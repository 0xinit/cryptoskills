# Gas Model

Sources: Gas model validated against [MegaEVM spec](https://github.com/megaeth-labs/mega-evm/blob/main/docs/DUAL_GAS_MODEL.md) and [BLOCK_AND_TX_LIMITS.md](https://github.com/megaeth-labs/mega-evm/blob/main/docs/BLOCK_AND_TX_LIMITS.md).

## Multidimensional Gas Model

MegaETH uses a dual gas model -- compute gas and storage gas are separate dimensions:

| Dimension | Description |
|-----------|-------------|
| **Compute gas** | Execution cost (opcodes, memory) |
| **Storage gas** | Persistent state modification cost |

Both are paid from your gas limit, but tracked separately for resource accounting.

## Base Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Base fee | 0.001 gwei (10^6 wei) | Fixed, no EIP-1559 adjustment |
| Priority fee | 0 | Ignored unless congested |
| Intrinsic gas | 60,000 | 21K compute + 39K storage (not 21K like Ethereum) |
| Gas forwarding | 98/100 | More gas available in nested calls than Ethereum's 63/64 |

## Per-Transaction Resource Limits (Rex)

| Resource | Limit |
|----------|-------|
| Compute gas | 200M |
| KV updates | 500K |
| State growth slots | 1,000 |
| Data size | 12.5 MB |
| Contract code | 512 KB |
| Calldata | 128 KB |

## Setting Gas Price

### Correct Approach

```javascript
const gasPrice = 1000000n; // 0.001 gwei in wei

// Or fetch from RPC (always returns 0.001 gwei)
const baseFee = await client.request({ method: 'eth_gasPrice' });
```

### Common Mistakes

```javascript
// Viem adds 20% buffer
const gasPrice = await publicClient.getGasPrice(); // Returns 1.2M wei

// eth_maxPriorityFeePerGas returns 0 (hardcoded)
const priority = await client.request({
  method: 'eth_maxPriorityFeePerGas'
}); // Returns 0
```

## Gas Estimation

### MegaEVM Intrinsic Gas

MegaEVM has different intrinsic gas costs than standard EVM. A simple ETH transfer costs 60,000 gas on MegaETH, not 21,000.

```javascript
const gasLimits = {
  transfer: 60000n,
  erc20Transfer: 100000n,
  erc20Approve: 80000n,
  swap: 350000n,
};

await wallet.sendTransaction({
  to: recipient,
  value: amount,
  gasLimit: 60000n,
  maxFeePerGas: 1000000n,
});
```

### When to Use Remote Estimation

For any non-trivial operation, use `eth_estimateGas` -- MegaEVM opcode costs differ from standard EVM:

```javascript
const gas = await client.request({
  method: 'eth_estimateGas',
  params: [{ from, to, data }]
});
```

For Foundry:
```bash
forge script Deploy.s.sol --gas-limit 5000000 --skip-simulation
```

## Volatile Data Access Limit

After accessing block metadata, tx is limited to 20M additional compute gas:

```solidity
// Operations that trigger the limit:
block.timestamp
block.number
blockhash(n)

// After any of these, only 20M gas remaining for compute
```

Workaround: Access block metadata late in execution, or use the high-precision timestamp oracle which has separate accounting.

## Fee History

```javascript
const history = await client.request({
  method: 'eth_feeHistory',
  params: ['0x10', 'latest', [25, 50, 75]]
});
```

## Priority Fees in Practice

Priority fees only matter during congestion:

```javascript
const tx = {
  maxFeePerGas: 1000000n,      // 0.001 gwei
  maxPriorityFeePerGas: 0n,    // Usually sufficient
};
```

## SSTORE Costs (Storage Gas)

The most important gas difference from standard EVM. SSTORE 0-to-nonzero costs:

```
Compute gas: 22,100
Storage gas: 20,000 x (bucket_multiplier - 1)
```

| Bucket Multiplier | Storage Gas | Total Gas |
|-------------------|-------------|-----------|
| 1 | 0 | 22,100 |
| 2 | 20,000 | 42,100 |
| 10 | 180,000 | 202,100 |
| 100 | 1,980,000 | 2,002,100 |

When multiplier = 1, storage gas is zero. This is why slot reuse patterns (RedBlackTreeLib, transient storage) are critical.

### Transient Storage (EIP-1153)

Use `TSTORE`/`TLOAD` for temporary data within a transaction -- avoids storage gas entirely:

```solidity
assembly {
    tstore(0, value)
    let v := tload(0)
}
// Cleared after transaction
```

## Gas Forwarding Ratio

MegaETH uses 98/100 gas forwarding (vs Ethereum's 63/64):

```solidity
// Each call depth loses only 2%, not ~1.5%
// Budget accordingly for deep call chains
```

## Gas Refunds

Standard EVM refunds apply (SSTORE clear), but:
- Refund capped at 50% of gas used
- SELFDESTRUCT is disabled on MegaETH

## LOG Opcode Costs

After a DoS attack, LOG opcodes have quadratic cost above 4KB data:

```solidity
// Gas cost for log data:
// < 4KB: linear
// > 4KB: quadratic growth
```

## Contract Deployment

| Resource | Limit |
|----------|-------|
| Contract code | 512 KB |
| Calldata | 128 KB |
| Deployment gas | Effectively unlimited |

For large contracts, may need VIP endpoint (higher gas limit on `eth_estimateGas`).
