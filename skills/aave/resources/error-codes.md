# Aave V3 Error Codes

Aave V3 uses numeric error codes defined in `Errors.sol`. When a transaction reverts, the error code identifies the exact failure reason.

Source: [aave-v3-core/contracts/protocol/libraries/helpers/Errors.sol](https://github.com/aave/aave-v3-core/blob/master/contracts/protocol/libraries/helpers/Errors.sol)

## Access Control Errors

| Code | Name | Cause | Resolution |
|------|------|-------|------------|
| 1  | `CALLER_NOT_POOL_ADMIN` | Non-admin calling admin function | Use the correct admin/governance account |
| 2  | `CALLER_NOT_BRIDGE` | Caller is not authorized bridge | Only Aave-approved bridges can call portal functions |
| 3  | `CALLER_NOT_ATOKEN` | Caller is not the associated aToken | Internal protocol error; do not call Pool internals directly |
| 4  | `CALLER_NOT_ASSET_LISTING_OR_POOL_ADMIN` | Unauthorized asset listing | Contact Aave governance to list new assets |

## Supply/Withdraw Errors

| Code | Name | Cause | Resolution |
|------|------|-------|------------|
| 33 | `UNDERLYING_BALANCE_ZERO` | Withdrawing with zero supplied balance | Nothing to withdraw for this asset |
| 50 | `SUPPLY_CAP_EXCEEDED` | Asset supply cap reached | Wait for withdrawals, or use a different market |
| 60 | `NOT_ENOUGH_AVAILABLE_USER_BALANCE` | Withdrawing more than supplied | Check aToken `balanceOf()` for actual balance |

## Borrow/Repay Errors

| Code | Name | Cause | Resolution |
|------|------|-------|------------|
| 26 | `COLLATERAL_CANNOT_COVER_NEW_BORROW` | Insufficient collateral | Supply more collateral or reduce borrow amount |
| 27 | `COLLATERAL_SAME_AS_BORROWING_CURRENCY` | Same collateral and borrow asset in isolation mode | Use different collateral or borrow asset |
| 28 | `AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE` | Stable rate borrow exceeds limit | Use variable rate (`interestRateMode = 2`) |
| 29 | `NO_DEBT_OF_SELECTED_TYPE` | Repaying a debt type that does not exist | Verify `interestRateMode` matches your debt (variable = 2) |
| 30 | `NO_EXPLICIT_AMOUNT_TO_REPAY_ON_BEHALF` | `type(uint256).max` used when repaying for another user | Specify exact repay amount when `onBehalfOf != msg.sender` |
| 51 | `BORROW_CAP_EXCEEDED` | Asset borrow cap reached | Wait for repayments, or use a different market |
| 58 | `BORROWING_NOT_ENABLED` | Borrowing disabled for this reserve | This asset cannot be borrowed; choose another |
| 59 | `STABLE_BORROWING_NOT_ENABLED` | Stable rate disabled for reserve | Use variable rate (`interestRateMode = 2`) |

## Health Factor / Liquidation Errors

| Code | Name | Cause | Resolution |
|------|------|-------|------------|
| 35 | `HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD` | Action would make position liquidatable | Add collateral, reduce borrow, or repay existing debt |
| 34 | `INTEREST_RATE_REBALANCE_CONDITIONS_NOT_MET` | Rate rebalance conditions not met | Rate is not far enough from optimal for rebalance |

## E-Mode Errors

| Code | Name | Cause | Resolution |
|------|------|-------|------------|
| 36 | `INCONSISTENT_EMODE_CATEGORY` | Borrowing asset outside active E-Mode category | Switch E-Mode category or borrow a compatible asset |

## Isolation Mode Errors

| Code | Name | Cause | Resolution |
|------|------|-------|------------|
| 38 | `ASSET_NOT_BORROWABLE_IN_ISOLATION` | Asset not allowed in isolation mode | Exit isolation mode or borrow an isolation-compatible asset |
| 40 | `USER_IN_ISOLATION_MODE` | User has isolation-mode collateral active | Withdraw isolation collateral or stay within limits |
| 54 | `DEBT_CEILING_EXCEEDED` | Isolation mode debt ceiling reached | Repay isolation debt or use different collateral |

## Reserve State Errors

| Code | Name | Cause | Resolution |
|------|------|-------|------------|
| 56 | `RESERVE_FROZEN` | Reserve frozen by governance; no new supply/borrow | Wait for governance to unfreeze |
| 57 | `RESERVE_PAUSED` | Reserve fully paused; no operations allowed | Wait for governance to unpause |

## Oracle / L2 Errors

| Code | Name | Cause | Resolution |
|------|------|-------|------------|
| 37 | `PRICE_ORACLE_SENTINEL_CHECK_FAILED` | L2 sequencer is down | Wait for sequencer recovery; borrows and liquidations are paused |

## Flash Loan Errors

| Code | Name | Cause | Resolution |
|------|------|-------|------------|
| 80 | `FLASHLOAN_PREMIUM_INVALID` | Premium set to invalid value | Admin configuration error |

## Handling Errors in TypeScript

```typescript
import { BaseError, ContractFunctionRevertedError } from "viem";

try {
  await publicClient.simulateContract({
    address: POOL,
    abi: poolAbi,
    functionName: "borrow",
    args: [asset, amount, 2n, 0, account.address],
    account: account.address,
  });
} catch (err) {
  if (err instanceof BaseError) {
    const revertError = err.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      console.error(`Aave revert: ${errorName}`);
    }
  }
}
```
