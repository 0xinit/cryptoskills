# wagmi Error Reference

Errors encountered when using wagmi v2, organized by source. wagmi surfaces viem errors for contract interactions and adds its own errors for configuration and connector issues.

## Configuration Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ChainNotConfiguredError` | Attempted to use a chain not in `createConfig({ chains })` | Add the chain to `chains` array and add a matching `transports` entry |
| `ConnectorNotConnectedError` | Hook called that requires connection, but no wallet connected | Check `useAccount().isConnected` before calling write hooks |
| `ProviderNotFoundError` | `useAccount`/`useConnect` used outside `WagmiProvider` | Wrap component tree in `<WagmiProvider config={config}>` |
| `ConnectorAlreadyConnectedError` | Calling `connect()` when already connected | Check `isConnected` before calling `connect()` |

## Connector Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ConnectorNotFoundError` | Wallet extension not installed | Show install instructions for the target wallet |
| `UserRejectedRequestError` | User rejected the connection or transaction in wallet | Reset pending state, allow retry |
| `SwitchChainError` | Chain switch failed (wallet doesn't support the chain) | Add chain to wallet first, or prompt user to add it manually |
| `ResourceUnavailableRpcError` | Wallet is locked or busy with another request | Prompt user to unlock wallet or dismiss pending request |

## Contract Read Errors (from viem)

| Error | Cause | Fix |
|-------|-------|-----|
| `ContractFunctionExecutionError` | Contract call reverted | Check function args, account state, contract conditions |
| `AbiFunctionNotFoundError` | `functionName` not in provided ABI | Verify ABI contains the function; check for typos |
| `AbiEncodingLengthMismatchError` | Wrong number of args for the function | Match `args` array length to ABI `inputs` |
| `AbiDecodingZeroDataError` | Call returned empty data (contract not deployed at address) | Verify contract address exists on the target chain |

## Contract Write Errors (from viem)

| Error | Cause | Fix |
|-------|-------|-----|
| `ContractFunctionRevertedError` | Simulation or execution reverted with a reason | Parse `error.data.errorName` and `error.data.args` for custom error details |
| `EstimateGasExecutionError` | Gas estimation failed (likely a revert) | Simulation catches this; check contract preconditions |
| `InsufficientFundsError` | Account lacks ETH for gas + value | Check balance before writing |
| `NonceTooLowError` | Pending transaction with same nonce | Wait for pending tx or speed up/cancel it in wallet |

## Transaction Receipt Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `TransactionNotFoundError` | Transaction hash not found on-chain | Transaction may have been dropped; retry or check explorer |
| `TransactionReceiptNotFoundError` | Receipt not available yet | Increase `confirmations` parameter or retry |
| `WaitForTransactionReceiptTimeoutError` | Polling timed out waiting for confirmation | Transaction may be stuck; check gas price |

## Common Error Patterns

### Extracting Revert Reason

```typescript
import { BaseError, ContractFunctionRevertedError } from "viem";

function getRevertReason(error: Error): string {
  if (!(error instanceof BaseError)) return error.message;

  const revert = error.walk(
    (e) => e instanceof ContractFunctionRevertedError
  );

  if (revert instanceof ContractFunctionRevertedError) {
    // Custom error: InsufficientBalance(uint256 available, uint256 required)
    if (revert.data?.errorName) {
      const args = revert.data.args?.map(String).join(", ") ?? "";
      return `${revert.data.errorName}(${args})`;
    }
    // require("message") or revert("message")
    if (revert.reason) return revert.reason;
  }

  return error.shortMessage;
}
```

### Detecting User Rejection

```typescript
import { UserRejectedRequestError } from "viem";

function isUserRejection(error: Error): boolean {
  if (error instanceof UserRejectedRequestError) return true;
  // Some wallets return non-standard error messages
  const msg = error.message.toLowerCase();
  return msg.includes("user rejected") || msg.includes("user denied");
}
```

### Handling Chain Mismatch

```typescript
import { useChainId, useSwitchChain } from "wagmi";

function useEnsureChain(requiredChainId: number) {
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isCorrectChain = currentChainId === requiredChainId;

  function switchToRequired() {
    if (!isCorrectChain) {
      switchChain({ chainId: requiredChainId });
    }
  }

  return { isCorrectChain, switchToRequired };
}
```

## Error Hierarchy

```
BaseError (viem)
  |
  +-- ContractFunctionExecutionError
  |     +-- ContractFunctionRevertedError
  |     +-- ContractFunctionZeroDataError
  |
  +-- EstimateGasExecutionError
  |
  +-- TransactionExecutionError
  |     +-- InsufficientFundsError
  |     +-- NonceTooLowError
  |     +-- UserRejectedRequestError
  |
  +-- WaitForTransactionReceiptTimeoutError
```

## References

- viem error types: https://viem.sh/docs/glossary/errors
- wagmi error handling: https://wagmi.sh/react/guides/error-handling
