# Polygon Error Codes and Common Errors

## PoS Bridge Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `EXIT_ALREADY_PROCESSED` | Exit proof already submitted for this burn tx | Check if withdrawal was already claimed on L1 |
| `BURN_TX_NOT_CHECKPOINTED` | Checkpoint not yet submitted to Ethereum | Wait ~30 minutes for the next checkpoint, then retry |
| `INVALID_EXIT_PAYLOAD` | Malformed exit proof data | Re-fetch exit payload from proof generator API |
| `PREDICATE_CALL_FAILED` | Token predicate couldn't process the deposit | Verify token is mapped in RootChainManager and allowance is sufficient |
| `NOT_ENOUGH_ALLOWANCE` | ERC20Predicate not approved to spend tokens | Call `approve(ERC20_PREDICATE, amount)` on the token contract |

## zkEVM Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `INVALID_BATCH_HASH` | Batch hash mismatch during proof | Usually a sequencer issue; wait for resubmission |
| `PROOF_VERIFICATION_FAILED` | ZK proof did not verify on L1 | Internal aggregator issue; transactions will be re-proven |
| `SEQUENCER_OVERLOADED` | Sequencer at capacity | Retry with exponential backoff |
| `GAS_PRICE_TOO_LOW` | Gas price below minimum accepted by sequencer | Increase gas price; check `eth_gasPrice` for current minimum |
| `NONCE_TOO_LOW` | Transaction nonce already used | Fetch fresh nonce with `eth_getTransactionCount` using `pending` tag |
| `TRANSACTION_REVERTED` | Contract execution failed | Debug with `cast run <TX_HASH> --rpc-url https://zkevm-rpc.com` |

## zkEVM Bridge Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ALREADY_CLAIMED` | Bridge deposit already claimed on destination | Check claim status via bridge API |
| `NOT_READY_FOR_CLAIM` | Proof not yet generated for the deposit | Wait for proof generation (~10-30 minutes) |
| `INVALID_SMT_PROOF` | Merkle proof is invalid or stale | Re-fetch proof from bridge API; exit root may have updated |
| `GLOBAL_EXIT_ROOT_MISMATCH` | Exit root on L1 doesn't match proof | Wait for exit root update and re-fetch proof |
| `INSUFFICIENT_BRIDGE_BALANCE` | Bridge contract lacks funds on destination | Rare; indicates a bridge solvency issue, contact Polygon team |

## POL Migration Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `INSUFFICIENT_ALLOWANCE` | Migration contract not approved for MATIC | Approve MATIC to migration contract before calling `migrate()` |
| `INSUFFICIENT_BALANCE` | Wallet has less MATIC than migration amount | Check MATIC balance; reduce migration amount |
| `TRANSFER_FAILED` | POL minting failed (extremely rare) | Retry; if persistent, check migration contract state |

## PoS Gas Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `REPLACEMENT_TX_UNDERPRICED` | Replacement tx has lower gas than pending | Set gas price at least 10% higher than the pending transaction |
| `MAX_FEE_PER_GAS_LESS_THAN_BASE` | EIP-1559 maxFeePerGas too low | Set maxFeePerGas above current block baseFeePerGas |
| `TRANSACTION_UNDERPRICED` | Gas price below network minimum | Fetch current gas price and add a buffer |
| `INSUFFICIENT_FUNDS` | Not enough POL for gas | Top up POL balance on Polygon PoS |

## RPC Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `429 Too Many Requests` | Rate limit exceeded on public RPC | Use authenticated RPC (Alchemy, Infura) or reduce request frequency |
| `502 Bad Gateway` | RPC node temporarily unavailable | Switch to backup RPC endpoint |
| `execution reverted` | Contract call failed | Use `cast call` with `--trace` to debug the revert reason |
| `header not found` | Querying a block that doesn't exist or is pruned | Use a full/archive node or query a recent block |
