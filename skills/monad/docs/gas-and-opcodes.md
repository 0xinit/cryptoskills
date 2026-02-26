# Monad Gas Pricing & Opcode Reference

## Gas Charging Model

Monad charges **gas limit**, not gas used. This is fundamental to deferred/asynchronous execution.

```
total_deduction = value + gas_limit * price_per_gas
price_per_gas = min(base_price_per_gas + priority_price_per_gas, max_price_per_gas)
```

### Why Gas Limit?

During asynchronous execution, the actual gas used isn't known at consensus time. If the protocol charged gas_used, a user could submit a transaction with a large gas_limit that consumes very little gas, opening a DoS vector by reserving block space without paying for it.

### Developer Impact

- Set gas limits **explicitly** for fixed-cost operations (e.g., 21000 for simple transfers)
- Avoid inflated gas limits — you pay for the limit, not actual usage
- Wallet estimates may overestimate; override when you know the cost

## EIP-1559 Parameters

| Parameter | Value |
|-----------|-------|
| Block gas limit | 200M |
| Block gas target | 160M (80% of limit) |
| Per-transaction gas limit | 30M |
| Gas throughput | 500M gas/sec |
| Minimum base fee | 100 MON-gwei (100 x 10^-9 MON) |
| Base fee max step size | 1/28 |
| Base fee decay factor | 0.96 |

The base fee controller increases **slower** and decreases **faster** than Ethereum's to prevent blockspace underutilization on a high-throughput chain.

## Reserve Balance

Every account maintains a **~10 MON** reserve to cover gas for the next 3 blocks during asynchronous execution. Transactions that would reduce balance below this are rejected at the consensus level.

- Applies to all accounts, not just validators
- Prevents DoS from pending transactions that would fail at execution time
- EIP-7702 delegated EOAs also cannot drop below 10 MON

## Opcode Repricing

Monad reprices opcodes where the cost/performance ratio differs significantly from Ethereum due to architectural optimizations.

### Cold Access Costs (State Reads)

| Access Type | Ethereum | Monad | Delta |
|-------------|----------|-------|-------|
| Account (cold) | 2,600 | **10,100** | +7,500 |
| Storage slot (cold) | 2,100 | **8,100** | +6,000 |
| Account (warm) | 100 | 100 | unchanged |
| Storage slot (warm) | 100 | 100 | unchanged |

**Affected opcodes** (cold access cost change):
- `BALANCE`
- `EXTCODESIZE`
- `EXTCODECOPY`
- `EXTCODEHASH`
- `CALL`
- `CALLCODE`
- `DELEGATECALL`
- `STATICCALL`
- `SELFDESTRUCT`
- `SLOAD`
- `SSTORE`

**Rationale**: State reads from disk carry disproportionate cost in Monad's architecture compared to pure computation. Cold access is ~4x more expensive to prevent state-read DoS.

### Precompile Repricing

| Precompile | Address | Ethereum Cost | Monad Cost | Multiplier |
|------------|---------|---------------|------------|------------|
| ecRecover | 0x01 | 3,000 | **6,000** | 2x |
| ecAdd | 0x06 | 150* | **300*** | 2x |
| ecMul | 0x07 | 6,000* | **30,000*** | 5x |
| ecPairing | 0x08 | 45,000* | **225,000*** | 5x |
| blake2f | 0x09 | rounds x 1* | **rounds x 2*** | 2x |
| point evaluation | 0x0a | 50,000 | **200,000** | 4x |

\* Per input/operation as specified in precompile docs.

### Monad-Specific Precompile

| Precompile | Address | Purpose |
|------------|---------|---------|
| secp256r1 (P256) | **0x0100** | EIP-7951 — WebAuthn/passkey signature verification |

Standard Ethereum precompiles 0x01-0x11 are all supported.

## Supported Transaction Types

| Type | Name | Supported | Notes |
|------|------|-----------|-------|
| 0 | Legacy | Yes | Pre-EIP-155 allowed but discouraged |
| 1 | EIP-2930 (access list) | Yes | |
| 2 | EIP-1559 (dynamic fee) | Yes | Recommended |
| 3 | EIP-4844 (blob) | **No** | Not supported on Monad |
| 4 | EIP-7702 (delegation) | Yes | With Monad-specific restrictions |

## EIP-7702 on Monad

Allows EOAs to gain smart contract capabilities via code delegation.

### How It Works
1. EOA signs authorization tuple designating a delegation target
2. Submitted via type 0x04 transaction
3. Can be initiated by EOA or any third party (enables gasless delegation)
4. Delegated code appears as `0xef0100` + `smart_contract_address`

### Monad-Specific Restrictions

| Restriction | Detail |
|-------------|--------|
| Minimum balance | Delegated EOAs cannot drop below **10 MON** |
| CREATE/CREATE2 | **Banned** when delegated EOAs execute as smart contracts |
| Clearing delegation | Send type 0x04 pointing to `address(0)` |

## Gas Optimization Tips for Monad

1. **Warm your storage** — cold reads are 4x more expensive; use access lists (type 1/2 txns) for known slots
2. **Set explicit gas limits** — you're charged for the limit, not usage
3. **Batch operations** — high throughput means batching is less critical, but still saves gas limit overhead
4. **Avoid unnecessary cold precompile calls** — ecPairing is 5x more expensive than Ethereum
5. **Design for parallel execution** — per-user mappings over global counters where possible
6. **No blob transactions** — use calldata for data availability
