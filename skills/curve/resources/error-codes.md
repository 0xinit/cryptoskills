# Curve Error Codes and Revert Reasons

Curve contracts are written in Vyper. Error messages differ from Solidity conventions. Vyper reverts are often terse or empty.

## StableSwap Pool Errors

| Error / Revert | Cause | Fix |
|----------------|-------|-----|
| `Exchange resulted in fewer coins than expected` | Swap output is below `min_dy` parameter | Increase slippage tolerance or re-quote with `get_dy()` before swapping |
| `Exceeds allowance` / `dev: exceeds allowance` | Pool contract is not approved to spend your token | Call `approve(pool, amount)` on the token contract |
| `Insufficient funds` | Token balance is below the swap amount | Check `balanceOf` before calling `exchange()` |
| `dev: unsafe value for y` | StableSwap math overflow — amount too large for pool state | Reduce swap size or check pool balances |
| `dev: unsafe value for D` | Pool invariant D calculation overflow | Pool is in an abnormal state — avoid interacting |
| Empty revert (no data) | Wrong function signature, wrong ABI, or invalid token index | Verify ABI matches the specific pool type. Check that `i` and `j` are valid coin indices |
| `dev: initial deposit requires all coins` | First liquidity deposit to an empty pool must include all tokens | Provide non-zero amounts for every coin in the pool |
| `dev: virtual_price is not increasing` | Reentrancy protection in newer Vyper pools | Do not call the pool from a callback/fallback |

## CryptoSwap / Tricrypto Errors

| Error / Revert | Cause | Fix |
|----------------|-------|-----|
| `Slippage screwed you` | CryptoSwap output below minimum | Increase slippage tolerance for volatile pairs (50-200 bps) |
| `dev: unsafe values x[i]` | Pool balance overflow in math | Reduce trade size |
| `dev: loss of precision` | Internal math precision error | Split into smaller transactions |
| `Price impact too high` | Trade size relative to pool depth causes excessive impact | Use smaller amount or route through multiple pools |

## Gauge Errors

| Error / Revert | Cause | Fix |
|----------------|-------|-----|
| `Your token lock expires too soon` | veCRV lock expires before the next voting epoch | Extend lock duration with `increase_unlock_time()` |
| `Used too much power` | Total gauge weight allocation exceeds 10,000 (100%) | Reduce weight on other gauges first. Total of all votes must be <= 10,000 |
| `Cannot vote so often` | 10-day cooldown between vote changes on the same gauge | Wait for the cooldown to expire. Check `last_user_vote(user, gauge)` |
| `No existing lock found` | Trying to vote or increase lock without an active veCRV position | Create a lock with `create_lock()` first |

## veCRV Errors

| Error / Revert | Cause | Fix |
|----------------|-------|-----|
| `Withdraw old tokens first` | Trying to `create_lock()` when a lock already exists | Call `withdraw()` on the expired lock, then create a new one |
| `Lock expired` | Trying to `increase_amount()` on an expired lock | Withdraw expired tokens, then create a new lock |
| `Can only lock until time in the future` | Unlock time is in the past | Set unlock time to a future timestamp (rounded to week) |
| `Voting lock can be 4 years max` | Unlock time exceeds 4 years from now | Reduce lock duration to <= 4 years |
| `Can only increase lock duration` | New unlock time is before the current unlock time | Set a later unlock time than the existing one |

## crvUSD / LLAMMA Errors

| Error / Revert | Cause | Fix |
|----------------|-------|-----|
| `Loan already exists` | Calling `create_loan()` when user already has a position | Use `borrow_more()` to increase debt, or `repay()` first |
| `Loan doesn't exist` | Calling `repay()` or `add_collateral()` with no active loan | Create a loan first with `create_loan()` |
| `Debt too high` | Requested debt exceeds max borrowable for the collateral/bands | Reduce debt amount or increase collateral. Check `max_borrowable()` |
| `Need more ticks` | N (bands) is too low for the requested debt amount | Increase N parameter (more bands) |
| `Too deep` | N (bands) exceeds the maximum allowed (50) | Use N <= 50 |
| `Amount too low` | Collateral or debt amount is below minimum threshold | Increase the amount |

## Meta Pool Errors

| Error / Revert | Cause | Fix |
|----------------|-------|-----|
| Empty revert on `exchange()` | Using `exchange()` when `exchange_underlying()` is needed | Meta pools require `exchange_underlying()` for cross-pool swaps |
| Index out of range | Using underlying index >= total underlying coins | Meta pool underlying indices: 0 = meta-asset, 1..N = basepool coins |

## Factory Pool Errors

| Error / Revert | Cause | Fix |
|----------------|-------|-----|
| `dev: fee receiver is not set` | Factory pool missing fee receiver configuration | This is a pool deployment issue — avoid this pool |
| Wrong index type revert | Factory pools use `uint256` for indices, not `int128` | Check if pool uses `uint256` or `int128` for `i`/`j` parameters |

## Debugging Tips

1. **Always simulate first** — Use `simulateContract` to get the revert reason before sending a transaction.

2. **Check ABI matches pool type** — Different pool types have different function signatures. A 3pool ABI will not work on a CryptoSwap pool.

3. **Verify coin indices** — Call `coins(i)` on the pool to confirm which token is at which index.

4. **Use Tenderly or cast for traces:**
   ```bash
   cast run <tx_hash> --rpc-url $RPC_URL
   ```

5. **Vyper reverts** — Some Vyper contracts emit `dev:` prefix errors only when compiled with `--optimize none`. On mainnet, you may get empty reverts. Simulation is the best way to diagnose.
