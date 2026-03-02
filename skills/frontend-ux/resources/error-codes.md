# dApp Error Code Reference

Complete reference of error codes encountered in dApp frontends, organized by source. Each entry includes the recommended UX response.

## EIP-1193 Provider Errors

Errors from the wallet provider (MetaMask, Coinbase Wallet, etc.).

| Code | Name | Cause | UX Response |
|------|------|-------|-------------|
| 4001 | User Rejected Request | User clicked "Reject" in wallet | Silent reset to idle. Do NOT show error toast. |
| 4100 | Unauthorized | Account not authorized or wallet locked | Show "Please unlock your wallet" with reconnect button |
| 4200 | Unsupported Method | Wallet does not support the requested method | Fall back to alternative method or show wallet upgrade prompt |
| 4900 | Disconnected | Provider is disconnected from all chains | Show reconnect button, check if wallet extension is running |
| 4901 | Chain Disconnected | Provider is disconnected from the requested chain | Prompt user to switch chain in wallet settings |

Last verified: February 2026. Source: https://eips.ethereum.org/EIPS/eip-1193

## JSON-RPC Errors

Errors from the RPC node.

| Code | Name | Cause | UX Response |
|------|------|-------|-------------|
| -32700 | Parse Error | Invalid JSON in request | Internal bug. Log to monitoring, show "Something went wrong" |
| -32600 | Invalid Request | Request object is malformed | Internal bug. Log to monitoring, show "Something went wrong" |
| -32601 | Method Not Found | RPC does not support the called method | Try alternative RPC endpoint |
| -32602 | Invalid Params | Wrong parameters for RPC method | Internal bug. Fix the code. |
| -32603 | Internal Error | Generic RPC error (often insufficient funds) | Parse inner message. If "insufficient funds", show balance. |
| -32000 | Server Error (Execution Reverted) | Transaction simulation failed | Decode revert reason from data field |
| -32001 | Resource Not Found | Requested resource does not exist | Check contract address and chain |
| -32002 | Resource Unavailable | Resource exists but is not available | Wallet may have a pending request. Prompt user to check wallet. |
| -32003 | Transaction Rejected | Transaction rejected by node (gas too low, etc.) | Show specific reason from error message |

Last verified: February 2026. Source: https://www.jsonrpc.org/specification

## Common Custom Revert Reasons

Decoded from `ContractFunctionRevertedError` in viem.

| Error Name | Typical Cause | UX Response |
|------------|---------------|-------------|
| `InsufficientBalance` | Token balance too low | Show current balance and required amount |
| `InsufficientAllowance` | Approval amount too low | Prompt approval flow |
| `TransferFailed` | ERC-20 transfer returned false | Check recipient address and token contract |
| `SlippageExceeded` | Price moved beyond tolerance | Show current price, suggest wider slippage |
| `DeadlineExpired` | Transaction not mined before deadline | Auto-retry with new deadline |
| `Paused` | Contract is paused | Show "Protocol is temporarily paused" |
| `InvalidSignature` | EIP-712 signature verification failed | Re-sign the message |
| `Unauthorized` | Caller not authorized for this action | Check connected account permissions |

## Error Detection Patterns

### Detecting User Rejection

```typescript
import { UserRejectedRequestError } from "viem";

function isUserRejection(error: Error): boolean {
  if (error instanceof UserRejectedRequestError) return true;
  const msg = error.message.toLowerCase();
  return msg.includes("user rejected") || msg.includes("user denied");
}
```

### Detecting Insufficient Funds

```typescript
import { BaseError, InsufficientFundsError } from "viem";

function isInsufficientFunds(error: Error): boolean {
  if (error instanceof BaseError) {
    return !!error.walk((e) => e instanceof InsufficientFundsError);
  }
  return error.message.toLowerCase().includes("insufficient funds");
}
```

### Decoding Custom Reverts

```typescript
import { BaseError, ContractFunctionRevertedError } from "viem";

function getRevertReason(error: Error): string | null {
  if (!(error instanceof BaseError)) return null;

  const revert = error.walk(
    (e) => e instanceof ContractFunctionRevertedError
  );

  if (revert instanceof ContractFunctionRevertedError) {
    if (revert.data?.errorName) {
      const args = revert.data.args?.map(String).join(", ") ?? "";
      return `${revert.data.errorName}(${args})`;
    }
    return revert.reason ?? null;
  }

  return null;
}
```

## References

- EIP-1193 Provider Errors: https://eips.ethereum.org/EIPS/eip-1193#provider-errors
- JSON-RPC Specification: https://www.jsonrpc.org/specification#error_object
- viem Error Types: https://viem.sh/docs/glossary/errors
