# ethers.js v6 Error Codes

ethers.js v6 uses structured error codes with the `isError(error, code)` type guard. These replace the v5 pattern of checking `error.code` directly.

## Error Code Reference

| Code | Description | Common Cause |
|------|-------------|-------------|
| `CALL_EXCEPTION` | Contract call reverted | Insufficient balance, access control, invalid state |
| `INSUFFICIENT_FUNDS` | Not enough ETH for gas + value | Wallet balance too low |
| `NONCE_EXPIRED` | Nonce already used | Duplicate transaction or stale nonce |
| `REPLACEMENT_UNDERPRICED` | Gas too low to replace pending tx | Speed-up or cancel with higher gas |
| `TRANSACTION_REPLACED` | Transaction replaced by another | Speed-up or cancel succeeded |
| `UNPREDICTABLE_GAS_LIMIT` | Gas estimation failed | Contract will revert; fix input params |
| `ACTION_REJECTED` | User rejected in wallet | User clicked "Reject" in MetaMask/wallet |
| `NETWORK_ERROR` | Network connectivity failure | RPC endpoint down, DNS failure, timeout |
| `SERVER_ERROR` | RPC server returned an error | Rate limiting, invalid request, node error |
| `TIMEOUT` | Request timed out | Slow RPC, network congestion |
| `BUFFER_OVERRUN` | Data decoding overflow | Corrupted ABI data or wrong ABI |
| `NUMERIC_FAULT` | Numeric operation error | Overflow, underflow, division by zero |
| `INVALID_ARGUMENT` | Invalid function argument | Wrong type, out of range, null where non-null expected |
| `MISSING_ARGUMENT` | Required argument not provided | Function called with too few arguments |
| `UNEXPECTED_ARGUMENT` | Extra argument provided | Function called with too many arguments |
| `NOT_IMPLEMENTED` | Feature not implemented | Using unsupported provider feature |
| `UNSUPPORTED_OPERATION` | Operation not supported | Read operation on signer, write on provider |
| `BAD_DATA` | Malformed data from network | Corrupted response, wrong chain, incompatible node |
| `CANCELLED` | Operation was cancelled | User or code cancelled the operation |
| `UNKNOWN_ERROR` | Unclassified error | Catch-all for unexpected failures |

## Using isError

```typescript
import { isError } from "ethers";

try {
  const tx = await contract.transfer(to, amount);
  const receipt = await tx.wait();
  if (receipt === null) throw new Error("TX dropped");
  if (receipt.status !== 1) throw new Error("TX reverted");
} catch (error: unknown) {
  if (isError(error, "CALL_EXCEPTION")) {
    // Contract revert -- has .reason and .data
    console.error(`Revert: ${error.reason}`);
    console.error(`Data: ${error.data}`);
    console.error(`Method: ${error.method}`);
  } else if (isError(error, "INSUFFICIENT_FUNDS")) {
    console.error("Not enough ETH for gas + value");
  } else if (isError(error, "ACTION_REJECTED")) {
    console.error("User rejected the transaction in wallet");
  } else if (isError(error, "NETWORK_ERROR")) {
    console.error("RPC connection failed -- check endpoint");
  } else if (isError(error, "TIMEOUT")) {
    console.error("Request timed out -- try again or use a faster RPC");
  } else if (isError(error, "NONCE_EXPIRED")) {
    console.error("Nonce already used -- refetch nonce and retry");
  } else if (isError(error, "REPLACEMENT_UNDERPRICED")) {
    console.error("Increase gas to replace pending transaction");
  } else if (isError(error, "UNPREDICTABLE_GAS_LIMIT")) {
    console.error("Gas estimation failed -- transaction would revert");
  } else if (isError(error, "INVALID_ARGUMENT")) {
    console.error(`Bad argument: ${error.argument} = ${error.value}`);
  } else if (isError(error, "SERVER_ERROR")) {
    console.error(`RPC error: ${JSON.stringify(error.info)}`);
  } else {
    throw error;
  }
}
```

## CALL_EXCEPTION Details

The `CALL_EXCEPTION` error is the most common and has extra properties:

```typescript
if (isError(error, "CALL_EXCEPTION")) {
  error.reason;     // string | null -- revert reason string
  error.data;       // string | null -- raw revert data (for custom errors)
  error.method;     // string | null -- the method that was called
  error.transaction; // object | null -- the transaction that caused it
}
```

### Decoding Custom Errors from CALL_EXCEPTION

```typescript
import { Interface, isError } from "ethers";

const iface = new Interface([
  "error InsufficientBalance(uint256 available, uint256 required)",
  "error Unauthorized(address caller)",
]);

try {
  await contract.withdraw(amount);
} catch (error: unknown) {
  if (isError(error, "CALL_EXCEPTION") && error.data) {
    try {
      const decoded = iface.parseError(error.data);
      if (decoded) {
        console.error(`Custom error: ${decoded.name}`);
        console.error(`Args: ${JSON.stringify(decoded.args)}`);
      }
    } catch {
      console.error(`Raw revert data: ${error.data}`);
    }
  } else {
    throw error;
  }
}
```

## Frontend Error Handling Pattern

```typescript
import { isError } from "ethers";

function getUserFriendlyError(error: unknown): string {
  if (isError(error, "ACTION_REJECTED")) {
    return "Transaction rejected. Please try again.";
  }
  if (isError(error, "INSUFFICIENT_FUNDS")) {
    return "Insufficient funds for gas. Please add ETH to your wallet.";
  }
  if (isError(error, "CALL_EXCEPTION")) {
    return error.reason ?? "Transaction would fail. Check your inputs.";
  }
  if (isError(error, "NETWORK_ERROR")) {
    return "Network error. Please check your connection.";
  }
  if (isError(error, "TIMEOUT")) {
    return "Request timed out. Please try again.";
  }
  if (isError(error, "NONCE_EXPIRED")) {
    return "Transaction conflict. Please refresh and try again.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred.";
}
```

## Common Mistakes

| Mistake | Error You Get | Fix |
|---------|--------------|-----|
| Checking `error.code` directly instead of `isError()` | Type errors or missed cases | Use `isError(error, "CODE")` |
| Not handling `tx.wait()` returning `null` | Unhandled null receipt | Check `receipt === null` |
| Passing `number` where `bigint` expected | `INVALID_ARGUMENT` | Use `BigInt(n)` or `123n` literal |
| Wrong ABI for contract | `CALL_EXCEPTION` with garbled data | Verify ABI matches deployed contract |
| Calling write method on provider-connected contract | `UNSUPPORTED_OPERATION` | Connect contract to a signer |
| Using ENS name on non-mainnet | Returns `null`, not an error | Check for null after `resolveName()` |
