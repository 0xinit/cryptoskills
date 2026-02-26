# Monad Troubleshooting

## Deployment Fails on Monad Testnet

**Symptom**: `forge create` or `forge script` reverts with no clear error.

**Common causes**:

1. **Insufficient balance (reserve)** — Monad requires ~10 MON reserve per account. Your balance must cover `value + gas_limit * gas_price + 10 MON`. Check with `cast balance <address> --rpc-url https://testnet-rpc.monad.xyz`.

2. **Wrong EVM version** — Monad runs the Pectra fork. Set `evm_version = "prague"` in `foundry.toml` or `evmVersion: "prague"` in Hardhat config. Compiling with an older EVM version can produce incompatible bytecode.

3. **Not using Monad Foundry fork** — Standard Foundry may miscalculate gas due to opcode repricing. Install with `foundryup --network monad`.

4. **Gas limit too low** — Monad charges gas_limit, not gas_used. If your gas limit is tight and estimation is off, the transaction is rejected at consensus. Increase the gas limit or use `--gas-limit` flag.

5. **Type 3 (blob) transaction** — Monad does not support EIP-4844 blob transactions. Ensure your tooling sends type 0, 1, 2, or 4.

## Contract Verification Fails

**Symptom**: `forge verify-contract` returns error or contract shows as unverified.

**MonadVision (Sourcify)**:
- Ensure `metadata = true` and `metadata_hash = "none"` in foundry.toml
- Use the correct Sourcify API URL: `https://sourcify-api-monad.blockvision.org/`
- Compiler version, optimization settings, and EVM version must match exactly

**Monadscan (Etherscan)**:
- Requires a valid Etherscan API key (same key works for Monad via Etherscan v2 API)
- API URL: `https://api.etherscan.io/v2/api?chainid=143` (mainnet) or `chainid=10143` (testnet)
- Constructor arguments must be ABI-encoded and match deployment

**Socialscan**:
- Requires a separate Socialscan API key
- API URL: `https://api.socialscan.io/monad-mainnet/v1/explorer/command_api/contract`

**General tips**:
- Verify immediately after deployment — waiting too long can cause RPC state mismatches
- Use `--watch` flag with Foundry to poll verification status
- If using libraries, flatten or provide library addresses

## Gas Estimation Differs from Ethereum

**Symptom**: Gas costs are higher than expected, or transactions cost more than estimated.

**Root cause**: Monad charges `gas_limit * gas_price`, not `gas_used * gas_price`.

**Fix**:
- For known-cost operations (transfers, simple calls), set gas limit explicitly: `--gas-limit 21000`
- Wallet UIs may overestimate gas limits; override in your code
- Cold storage/account access costs ~4x more than Ethereum (10,100 vs 2,600 for accounts, 8,100 vs 2,100 for storage)
- Precompiles are 2-5x more expensive (ecPairing is 5x)

**Debugging**:
```bash
# Check actual gas used vs limit
cast receipt <tx_hash> --rpc-url https://rpc.monad.xyz | grep -E "gas(Used|Limit)"
```

## Parallel Execution Gotchas

**Symptom**: Contract works on Ethereum but behaves unexpectedly under high concurrency on Monad.

**Clarification**: Parallel execution is transparent. Your contract logic is NOT affected — Monad guarantees the same deterministic result as serial execution. However:

1. **Global state contention** — Contracts with global counters or shared state will serialize under load, reducing throughput. This is a performance issue, not a correctness issue. Prefer per-user mappings.

2. **`block.timestamp` precision** — 2-3 consecutive blocks may share the same second due to 400ms block times. Time-dependent logic (auctions, vesting cliffs) should account for this.

3. **Nonce management** — At 10,000+ TPS, nonce collisions are more likely when submitting rapid-fire transactions from the same account. Use nonce management or batch via multicall.

4. **Event ordering** — Events within a block are ordered by transaction index, same as Ethereum. But with 400ms blocks, indexers need to process events faster.

## Staking Precompile Call Failures

**Symptom**: Call to `0x0000000000000000000000000000000000001000` reverts.

**Common causes**:

1. **Using STATICCALL or DELEGATECALL** — The staking precompile only accepts standard `CALL`. Solidity `view` functions use STATICCALL by default; you must use low-level `.call()`.

2. **Below dust threshold** — Minimum delegation is 1e9 wei (1 Gwei of MON). Amounts below this are rejected.

3. **Invalid validator ID** — Check that the validator exists with `getValidator(uint64)`.

4. **Withdrawal not ready** — `withdraw()` fails if the withdrawal epoch hasn't passed. Check with `getWithdrawalRequest()` and `getEpoch()`.

5. **Epoch boundary timing** — Stake changes queue for the next epoch. If called too close to an epoch boundary, the change may queue for the epoch after next.

**Debugging**:
```bash
# Check current epoch
cast call 0x0000000000000000000000000000000000001000 "getEpoch()" --rpc-url https://rpc.monad.xyz

# Check delegator state
cast call 0x0000000000000000000000000000000000001000 "getDelegator(uint64,address)(uint256,uint256,uint256)" 1 <your_address> --rpc-url https://rpc.monad.xyz
```

## RPC Endpoint Issues

**Symptom**: Requests timeout, rate-limited, or return unexpected errors.

**Rate limits by provider**:

| Provider | Limit |
|----------|-------|
| QuickNode (rpc.monad.xyz) | 25 rps |
| Alchemy (rpc1.monad.xyz) | 15 rps |
| Goldsky (rpc2.monad.xyz) | 300/10s |
| Ankr (rpc3.monad.xyz) | 300/10s |
| MF (rpc-mainnet.monadinfra.com) | 20 rps |

**Fixes**:
- Rotate between public RPCs to distribute load
- Use WebSocket (`wss://`) for subscriptions instead of polling
- For production, use a dedicated RPC plan from QuickNode, Alchemy, Ankr, Goldsky, Chainstack, or dRPC
- Some providers (Alchemy, Ankr) do not support `debug_*` or `trace_*` methods — use QuickNode or Goldsky for those
- Batch size limits vary: QuickNode allows 100, MF allows 1
