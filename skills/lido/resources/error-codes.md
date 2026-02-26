# Lido Error Codes

Common errors encountered when interacting with Lido contracts.

## Staking Errors (Lido / stETH)

| Error | Cause | Fix |
|-------|-------|-----|
| `STAKE_LIMIT` | Daily staking limit reached | Check `getCurrentStakeLimit()` before submitting. Wait for limit to replenish. |
| `ZERO_DEPOSIT` | Sent 0 ETH with `submit()` | Ensure `msg.value > 0`. |
| `STAKING_PAUSED` | Protocol staking is paused by DAO | Wait for DAO to unpause. Monitor Lido governance. |

## Withdrawal Queue Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `REQUEST_AMOUNT_TOO_SMALL` | Withdrawal amount below 100 wei | Each request must be >= 100 wei of stETH. |
| `REQUEST_AMOUNT_TOO_LARGE` | Single request exceeds 1000 stETH | Split into multiple requests of <= 1000 stETH. |
| `EMPTY_WITHDRAWAL` | Passed empty amounts array | Provide at least one withdrawal amount. |
| `NOT_FINALIZED` | Claiming a request that is not yet finalized | Check `getWithdrawalStatus()` — wait for `isFinalized == true`. |
| `ALREADY_CLAIMED` | Withdrawal NFT already claimed | Check `isClaimed` in `getWithdrawalStatus()`. |
| `NOT_OWNER` | Caller is not the withdrawal NFT owner | Only the NFT owner can claim. Transfer the NFT first if needed. |
| `REQUEST_NOT_FOUND` | Invalid request ID | Verify the request ID exists (must be <= `getLastRequestId()`). |

## ERC-20 / Approval Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ALLOWANCE_EXCEEDED` | Insufficient stETH approval for wstETH or WithdrawalQueue | Call `approve()` before `wrap()` or `requestWithdrawals()`. |
| `TRANSFER_AMOUNT_EXCEEDS_BALANCE` | Trying to transfer/wrap more stETH than held | Check `balanceOf()`. Account for 1-2 wei rounding. |
| `TRANSFER_AMOUNT_EXCEEDS_ALLOWANCE` | Standard ERC-20 allowance error | Increase approval amount. |

## wstETH Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `WRAP_ZERO` | Calling `wrap(0)` | Pass a non-zero stETH amount. |
| `UNWRAP_ZERO` | Calling `unwrap(0)` | Pass a non-zero wstETH amount. |

## Oracle / Checkpoint Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `INVALID_HINT` | Checkpoint hint out of range | Use `findCheckpointHints(requestIds, 1, getLastCheckpointIndex())`. |
| `EMPTY_HINTS` | No valid hints found for request IDs | Ensure requests exist and checkpoint index range is valid. |

## Common Revert Patterns

```typescript
// Check for revert reason in failed transactions
try {
  await publicClient.simulateContract({ ... });
} catch (error) {
  // Viem includes the revert reason in the error message
  console.error("Revert reason:", error.message);
}
```
