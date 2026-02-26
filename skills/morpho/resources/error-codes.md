# Morpho Blue Error Codes

Morpho Blue uses custom errors (not require strings). These are the errors defined in the contract.

## Core Errors

| Error | Signature | Cause | Fix |
|-------|-----------|-------|-----|
| `MarketNotCreated` | `MarketNotCreated()` | Operating on a market that does not exist | Verify market ID or create the market first |
| `MarketAlreadyCreated` | `MarketAlreadyCreated()` | Calling `createMarket` with params that already exist | This market already exists -- use it directly |
| `IrmNotEnabled` | `IrmNotEnabled()` | IRM address not approved by governance | Use the AdaptiveCurveIRM at `0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC` or another enabled IRM |
| `LltvNotEnabled` | `LltvNotEnabled()` | LLTV value not approved by governance | Use one of the governance-enabled LLTVs (see contract-addresses.md) |
| `InsufficientCollateral` | `InsufficientCollateral()` | Borrow would exceed collateral capacity | Supply more collateral or borrow less |
| `InsufficientLiquidity` | `InsufficientLiquidity()` | Not enough liquidity in the market to borrow or withdraw | Wait for more supply or reduce the amount |
| `NotAuthorized` | `NotAuthorized()` | Caller not authorized to act on behalf of the user | Call `setAuthorization(address, true)` from the position owner |
| `MaxUint128Exceeded` | `MaxUint128Exceeded()` | Amount exceeds `type(uint128).max` | Reduce the amount -- Morpho uses uint128 internally |
| `ZeroAssets` | `ZeroAssets()` | Supply/borrow/repay of zero assets | Pass a nonzero amount |
| `ZeroAddress` | `ZeroAddress()` | Address parameter is zero | Pass a valid nonzero address |
| `InconsistentInput` | `InconsistentInput()` | Both `assets` and `shares` are nonzero | Set one to zero. Use `assets` for exact amounts, `shares` for proportional amounts |
| `HealthyPosition` | `HealthyPosition()` | Attempting to liquidate a position that is not underwater | Position's LTV is below LLTV -- it cannot be liquidated |

## Interpreting Reverts

### TypeScript

```typescript
import { BaseError, ContractFunctionRevertedError } from "viem";

try {
  await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "borrow",
    args: [marketParams, borrowAmount, 0n, account.address, account.address],
    account: account.address,
  });
} catch (err) {
  if (err instanceof BaseError) {
    const revertError = err.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;

      switch (errorName) {
        case "InsufficientCollateral":
          console.error("Not enough collateral for this borrow amount");
          break;
        case "InsufficientLiquidity":
          console.error("Market does not have enough supply liquidity");
          break;
        case "InconsistentInput":
          console.error("Both assets and shares are nonzero -- set one to 0");
          break;
        case "NotAuthorized":
          console.error("Not authorized to act on behalf of this user");
          break;
        default:
          console.error(`Morpho revert: ${errorName}`);
      }
    }
  }
}
```

### Foundry

```bash
# Decode a revert from a failed transaction
cast run <tx_hash> --rpc-url $RPC_URL

# Manually decode error selector
cast sig "InsufficientCollateral()"
# Returns: 0x...

# Check error by selector
cast 4byte <selector>
```

## Common Mistakes That Cause Reverts

| Mistake | Error You Get | Fix |
|---------|--------------|-----|
| Passing both `assets` and `shares` as nonzero | `InconsistentInput` | Set one to `0n` |
| Using a non-enabled LLTV in `createMarket` | `LltvNotEnabled` | Check enabled LLTVs on-chain |
| Borrowing without supplying collateral first | `InsufficientCollateral` | Call `supplyCollateral` before `borrow` |
| Withdrawing more than available liquidity | `InsufficientLiquidity` | Check `totalSupplyAssets - totalBorrowAssets` |
| Liquidating a healthy position | `HealthyPosition` | Check LTV against LLTV before calling `liquidate` |
| Acting on behalf of another without authorization | `NotAuthorized` | Have the user call `setAuthorization(yourAddress, true)` |
| Supplying to a market that has not been created | `MarketNotCreated` | Verify market exists via `idToMarketParams` first |
