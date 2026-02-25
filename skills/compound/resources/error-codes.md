# Compound V3 Error Codes

> **Last verified:** February 2026

Compound V3 (Comet) uses custom Solidity errors instead of revert reason strings. These are the error selectors you will encounter.

## Custom Errors

| Error | Selector | Cause | Fix |
|-------|----------|-------|-----|
| `Absurd` | `0xe8a38e05` | Internal math produced an impossible result | Check input amounts are within valid ranges |
| `AlreadyInitialized` | `0x0dc149f0` | Proxy already initialized | Use the existing deployment; do not re-initialize |
| `BadAsset` | `0xe6c4247b` | Asset is not configured as collateral in this Comet | Verify the asset address is a valid collateral for this market |
| `BadDecimals` | `0xba5ba5f5` | Asset decimals do not match expected config | Check token decimals match what Comet expects |
| `BadDiscount` | `0x657e46cf` | Invalid discount factor in liquidation | Should not occur in normal operation |
| `BadMinimum` | `0xbfea1102` | Minimum amount parameter invalid | Increase the `minAmount` in `buyCollateral` |
| `BadPrice` | `0xf3a1ed77` | Chainlink price feed returned zero or stale data | Wait for oracle update; check feed address and heartbeat |
| `BorrowCFTooLarge` | `0xb3a86e1b` | Borrow collateral factor exceeds maximum | Governance configuration error |
| `BorrowTooSmall` | `0x07a6929e` | Borrow amount below minimum base borrow | Increase the borrow amount above `baseBorrowMin` |
| `InsufficientReserves` | `0x67db5b8b` | Protocol reserves cannot cover operation | Wait for reserves to accrue or reduce withdrawal |
| `InvalidInt128` | `0x1d4a2867` | Value overflows int128 | Reduce the amount |
| `InvalidInt256` | `0x2a1c0733` | Value overflows int256 | Reduce the amount |
| `InvalidUInt64` | `0x40838d42` | Value overflows uint64 | Reduce the amount |
| `InvalidUInt128` | `0xeb66227e` | Value overflows uint128 | Reduce the amount |
| `LiquidateCFTooLarge` | `0xbab07e7b` | Liquidation collateral factor exceeds maximum | Governance configuration error |
| `NegativeNumber` | `0xc0d15b62` | Unexpected negative value in unsigned context | Check operation ordering (e.g., withdrawing before supplying) |
| `NoSelfTransfer` | `0xa8f87c64` | Cannot transfer to self | Use a different recipient address |
| `NotCollateralized` | `0xdc7e73f1` | Position would be undercollateralized after operation | Add more collateral or reduce borrow amount |
| `NotForSale` | `0x7a7e1a5d` | No absorbed collateral available for this asset | Wait for an `absorb()` to occur, or check asset address |
| `Paused` | `0x9e87fac8` | Market is paused by governance | Wait for governance to unpause |
| `SupplyCapExceeded` | `0x2c75f996` | Collateral supply exceeds configured cap | Wait for other users to withdraw, or use different collateral |
| `TimestampTooLarge` | `0xb2c0a10c` | Block timestamp exceeds uint40 max | Should not occur in practice (year 36812) |
| `TooManyAssets` | `0xfbe4e68f` | Too many collateral assets configured | Governance configuration limit |
| `TooMuchSlippage` | `0x8199f5f3` | `buyCollateral` price moved beyond minAmount | Increase slippage tolerance or retry with fresh quote |
| `TransferInFailed` | `0x7274b16c` | ERC-20 `transferFrom` to Comet failed | Check: (1) token approved for Comet, (2) sufficient balance, (3) token not paused |
| `TransferOutFailed` | `0xd04a3660` | ERC-20 `transfer` from Comet failed | Check Comet has sufficient tokens; may indicate protocol issue |
| `Unauthorized` | `0x82b42900` | Caller is not the owner or an allowed manager | Call `allow(manager, true)` from the account owner first |

## Decoding Custom Errors in TypeScript

```typescript
import { BaseError, ContractFunctionRevertedError } from "viem";

try {
  await publicClient.simulateContract({
    address: COMET_USDC,
    abi: cometAbi,
    functionName: "withdraw",
    args: [USDC, amount],
    account: account.address,
  });
} catch (err) {
  if (err instanceof BaseError) {
    const revertError = err.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      console.error(`Comet error: ${errorName}`);

      // Match against known errors
      switch (errorName) {
        case "NotCollateralized":
          console.error("Add more collateral or reduce borrow amount");
          break;
        case "SupplyCapExceeded":
          console.error("Collateral supply cap is full");
          break;
        case "Paused":
          console.error("Market is paused");
          break;
        case "Unauthorized":
          console.error("Caller lacks permission");
          break;
        case "BadAsset":
          console.error("Asset not configured as collateral");
          break;
        case "TransferInFailed":
          console.error("Check approval and balance");
          break;
        default:
          console.error(`Unhandled error: ${errorName}`);
      }
    }
  }
}
```

## Decoding Custom Errors with cast

```bash
# Decode a revert from a failed transaction
cast run <tx_hash> --rpc-url $RPC_URL

# Look up error selector
cast sig "NotCollateralized()"
# Returns: 0xdc7e73f1

# Decode raw error data
cast 4byte-decode 0xdc7e73f1
```

## Reference

- [Comet Source: CometMainInterface.sol](https://github.com/compound-finance/comet/blob/main/contracts/CometMainInterface.sol)
- [Custom Error Definitions](https://github.com/compound-finance/comet/blob/main/contracts/CometCore.sol)
