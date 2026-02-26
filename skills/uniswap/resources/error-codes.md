# Uniswap Error Codes

Common revert reasons from Uniswap V3 and V4 contracts with causes and fixes.

## V3 Pool Errors

| Error | Full Name | Cause | Fix |
|-------|-----------|-------|-----|
| `STF` | SafeTransferFrom | Token transfer into the pool failed. Either the caller has insufficient balance or the pool/router is not approved to spend the token. | Check `balanceOf` for the sender. Ensure `approve(router, amount)` was called. For fee-on-transfer tokens, approve extra to cover the fee. |
| `TF` | Transfer Failed | Token transfer out of the pool to the recipient failed. | Verify the recipient address can receive ERC-20 tokens. Some contracts reject incoming transfers. |
| `AS` | Already Started | V4: Pool has already been initialized. `initialize` was called on a pool that already exists. | Check if pool exists before calling `initialize`. Use `getPool` on V3 factory or check PoolManager state for V4. |
| `LOK` | Locked | Pool reentrancy guard is active. A callback attempted to re-enter the pool. | Do not call pool functions from within a swap/mint callback. Restructure to perform operations sequentially. |
| `SPL` | SqrtPriceLimitX96 | The swap would push the price past the specified `sqrtPriceLimitX96` bound. | Set `sqrtPriceLimitX96` to `0` to remove the limit. Or widen the bound to allow more price movement. |
| `TLU` | Tick Lower >= Upper | `tickLower` is not strictly less than `tickUpper`. | Ensure `tickLower < tickUpper`. Both must be within `[-887272, 887272]`. |
| `TLM` | Tick Lower Minimum | `tickLower` is below `MIN_TICK` (-887272). | Use `tickLower >= -887272`. |
| `TUM` | Tick Upper Maximum | `tickUpper` is above `MAX_TICK` (887272). | Use `tickUpper <= 887272`. |
| `AI` | Already Initialized | V3: Pool at this (token0, token1, fee) combination already exists. | Query the factory with `getPool(tokenA, tokenB, fee)` before creating. |

## V3 Router Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Too little received` | The swap output is less than `amountOutMinimum`. Slippage exceeded. | Increase slippage tolerance or re-quote before swapping. Price may have moved. |
| `Too much requested` | For exact output swaps, the required input exceeds `amountInMaximum`. | Increase `amountInMaximum` or re-quote. |
| `Transaction too old` | The `deadline` timestamp has passed. The transaction sat in the mempool too long. | Use a longer deadline (e.g., current time + 300 seconds). Consider higher gas price for faster inclusion. |
| `Invalid swap` | The swap parameters are malformed. | Check that `amountIn > 0` or `amountOut > 0`, tokens are valid, and fee tier exists. |

## V3 NonfungiblePositionManager Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid token ID` | The NFT position does not exist or was burned. | Verify the tokenId exists via `ownerOf(tokenId)`. Positions with 0 liquidity and 0 owed tokens may have been burned. |
| `Not approved` | Caller is not the owner or approved operator of the position NFT. | Call `approve(operator, tokenId)` or `setApprovalForAll(operator, true)` on the NonfungiblePositionManager. |
| `Price slippage check` | Deposited token amounts fell below `amount0Min` / `amount1Min`. | Widen slippage tolerance or re-read pool price and recalculate expected deposits. |

## V4 PoolManager Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `PoolNotInitialized` | Operation attempted on a pool that hasn't been initialized. | Call `poolManager.initialize(key, sqrtPriceX96)` first. |
| `CurrenciesOutOfOrderOrEqual` | `currency0 >= currency1` in the PoolKey. | Ensure `currency0` address is numerically less than `currency1`. Use `address(0)` for native ETH. |
| `InvalidHookResponse` | Hook returned an unexpected selector or invalid data. | Verify hook functions return the correct `BaseHook.<function>.selector` as first return value. |
| `HookAddressNotValid` | The hook address bits do not match declared permissions. | Re-mine the hook address with `HookMiner.find` using the correct flags. |
| `InvalidCaller` | Only the PoolManager should call hook callbacks. | Hooks should check `msg.sender == address(poolManager)` via the `onlyPoolManager` modifier from BaseHook. |

## ERC-20 Errors (Common in Uniswap Context)

| Error | Cause | Fix |
|-------|-------|-----|
| `ERC20: transfer amount exceeds balance` | Sender's token balance is too low. | Check balance before swap. Account for fee-on-transfer tokens. |
| `ERC20: transfer amount exceeds allowance` | Approval to the router/Permit2 is insufficient. | Re-approve with sufficient amount. For Permit2, max approval is `type(uint160).max`. |
| `ERC20: approve to the zero address` | Attempting to approve address(0). | Verify the spender address is correct. |

## Debugging Tips

```bash
# Decode a revert reason from a failed transaction
cast run <tx_hash> --rpc-url $RPC_URL

# Simulate a swap to see the revert reason without spending gas
cast call 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45 \
  "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))" \
  "(0xC02a...,0xA0b8...,500,0xYOUR...,1000000000000000000,0,0)" \
  --rpc-url $RPC_URL --from 0xYOUR_ADDRESS
```
