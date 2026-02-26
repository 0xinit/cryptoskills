# Viem Error Types Reference

All viem errors extend `BaseError`. Use `err.walk()` to traverse the error chain and find specific causes.

## Error Hierarchy

```
BaseError
├── ContractFunctionExecutionError
│   └── ContractFunctionRevertedError
├── TransactionExecutionError
│   ├── InsufficientFundsError
│   ├── NonceAlreadyUsedError
│   └── UserRejectedRequestError
├── HttpRequestError
├── InvalidAddressError
├── InvalidAbiError
└── ChainMismatchError
```

## ContractFunctionExecutionError

Wraps any error that occurs during `readContract`, `simulateContract`, or `writeContract`.

```typescript
import { BaseError, ContractFunctionExecutionError } from "viem";

try {
  await client.readContract({ address, abi, functionName, args });
} catch (err) {
  if (err instanceof ContractFunctionExecutionError) {
    console.error(err.contractAddress);
    console.error(err.functionName);
    console.error(err.shortMessage);
  }
}
```

## ContractFunctionRevertedError

The contract reverted with a reason string or custom error. Nested inside `ContractFunctionExecutionError`.

```typescript
import { BaseError, ContractFunctionRevertedError } from "viem";

try {
  await client.simulateContract({ address, abi, functionName, args, account });
} catch (err) {
  if (err instanceof BaseError) {
    const revertError = err.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      // Solidity custom error name (e.g., "InsufficientBalance")
      console.error("Error name:", revertError.data?.errorName);
      // Decoded custom error args
      console.error("Error args:", revertError.data?.args);
      // Raw revert reason string (if require/revert with string)
      console.error("Reason:", revertError.reason);
    }
  }
}
```

## TransactionExecutionError

Wraps errors from `sendTransaction` or `writeContract`.

```typescript
import { TransactionExecutionError } from "viem";

try {
  await walletClient.sendTransaction({ to, value });
} catch (err) {
  if (err instanceof TransactionExecutionError) {
    console.error(err.shortMessage);
    console.error("Cause:", err.cause);
  }
}
```

## InsufficientFundsError

Account does not have enough ETH to cover value + gas.

```typescript
import { BaseError, InsufficientFundsError } from "viem";

try {
  await walletClient.sendTransaction({ to, value });
} catch (err) {
  if (err instanceof BaseError) {
    const fundError = err.walk((e) => e instanceof InsufficientFundsError);
    if (fundError instanceof InsufficientFundsError) {
      console.error("Not enough ETH for value + gas");
    }
  }
}
```

## UserRejectedRequestError

The user rejected the transaction in their wallet (MetaMask, etc.).

```typescript
import { BaseError, UserRejectedRequestError } from "viem";

try {
  await walletClient.sendTransaction({ to, value });
} catch (err) {
  if (err instanceof BaseError) {
    const rejected = err.walk((e) => e instanceof UserRejectedRequestError);
    if (rejected instanceof UserRejectedRequestError) {
      console.log("User cancelled the transaction");
    }
  }
}
```

## HttpRequestError

RPC node is unreachable, timed out, or returned an HTTP error.

```typescript
import { HttpRequestError } from "viem";

try {
  await client.getBlockNumber();
} catch (err) {
  if (err instanceof HttpRequestError) {
    console.error("RPC error:", err.status, err.url);
  }
}
```

## General Pattern: Walking the Error Chain

`err.walk()` traverses `err.cause` recursively. Pass a predicate to find a specific error type.

```typescript
import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from "viem";

try {
  // any viem call
} catch (err) {
  if (!(err instanceof BaseError)) throw err;

  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError) {
    console.error("Revert:", revert.data?.errorName);
    return;
  }

  const funds = err.walk((e) => e instanceof InsufficientFundsError);
  if (funds instanceof InsufficientFundsError) {
    console.error("Insufficient funds");
    return;
  }

  const rejected = err.walk((e) => e instanceof UserRejectedRequestError);
  if (rejected instanceof UserRejectedRequestError) {
    console.error("User rejected");
    return;
  }

  console.error("Unknown error:", err.shortMessage);
}
```
