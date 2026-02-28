# Axelar Error Codes

Common revert reasons and error codes for Axelar Gateway, GasService, AxelarExecutable, and ITS contracts.

## Gateway Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `NotApprovedByGateway` | `execute()` called but the command has not been approved by validators | Wait for Axelar consensus; check status on axelarscan.io |
| `AlreadyExecuted` | The command has already been executed on this chain | Expected behavior for replay protection -- no action needed |
| `InvalidAddress` | Empty or malformed address string passed to `callContract` | Pass a valid lowercase hex address string |
| `TokenDoesNotExist` | Token symbol not registered in the Gateway | Use only Axelar-supported token symbols (axlUSDC, axlWETH, etc.) |
| `NotSelf` | External call to an internal-only Gateway function | Do not call internal Gateway functions directly |
| `InvalidAmount` | Zero amount passed to `callContractWithToken` | Pass a non-zero token amount |
| `InvalidCodeHash` | Contract upgrade attempted with invalid code | Internal Gateway error -- should not occur in normal usage |

## AxelarExecutable Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `InvalidAddress` | Zero address passed for Gateway in constructor | Pass the correct Gateway address for this chain |
| `NotApprovedByGateway` | The `execute()` function's validation failed | The command ID is not approved -- wait for validator consensus |

## GasService Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `NothingReceived` | `payNativeGasForContractCall` called with `msg.value == 0` | Send native tokens as `msg.value` |
| `InvalidAddress` | Zero address for sender or refundAddress | Pass valid addresses for all parameters |
| `NotCollector` | Non-collector address calling `collectFees` | Only the designated collector can call admin functions |

## ITS (Interchain Token Service) Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `TokenAlreadyRegistered` | Attempting to register a token that already has a tokenId | Use the existing tokenId returned from previous registration |
| `NotTokenManager` | Function called by an address that is not the token manager | Only the token manager contract can call certain ITS functions |
| `NotOperator` | Caller is not the operator of the token manager | Use the operator address set during token deployment |
| `ZeroAddress` | Zero address passed where a valid address is required | Pass a valid non-zero address |
| `LengthMismatch` | Array parameters have different lengths | Ensure all array parameters have the same length |
| `AlreadyDeployed` | Token with this tokenId already deployed on this chain | Use the existing deployment -- no need to redeploy |
| `NotRemoteService` | Message received from an address that is not ITS on the source chain | Ensure ITS addresses are correctly linked across chains |

## Interchain Token Factory Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `InvalidDeployer` | The deployer parameter does not match the original deployer | Use the same address that deployed the token initially |
| `NotOwner` | Caller does not own the token manager for this tokenId | Call from the address that originally deployed the token |
| `GatewayToken` | Attempting to register a Gateway-native token via Factory | Use `registerCanonicalInterchainToken` for Gateway tokens |

## Common Revert Patterns

### Source Chain Reverts

```
Symptoms: Transaction reverts immediately on the source chain.
Causes:
  - msg.value == 0 (no gas payment)
  - Token not approved for transfer
  - Invalid chain name string
  - Token symbol not registered in Gateway
Debug:
  1. Check msg.value is non-zero
  2. Check token allowance if using callContractWithToken
  3. Verify chain name matches Axelar registry exactly
  4. Check token symbol with gateway.tokenAddresses(symbol)
```

### Message Submitted But Not Executed

```
Symptoms: Source tx succeeded, axelarscan shows "confirmed" but not "executed".
Causes:
  - Insufficient gas payment
  - Destination _execute() reverts
  - Relayer issue
Debug:
  1. Check GasPaidForContractCall event in source tx
  2. If missing, gas was not paid
  3. If present, check destination contract logic
  4. Use manualRelayToDestChain() from Axelar SDK
```

### `_execute()` Reverts on Destination

```
Symptoms: axelarscan shows "error" status on destination.
Causes:
  - UntrustedRemote check failed
  - Payload decode mismatch
  - Insufficient gas limit
  - Custom logic error
Debug:
  1. Verify trustedRemotes mapping has correct (chain, address) pair
  2. Verify payload encoding matches decoding (same types, same order)
  3. Increase gas estimate
  4. Test _execute logic in isolation
```

## Debug Commands

```bash
# Check Gateway contract exists
cast code 0x4F4495243837681061C4743b74B3eEdf548D56A5 --rpc-url $ETH_RPC_URL

# Check if a command was executed
cast call 0x4F4495243837681061C4743b74B3eEdf548D56A5 \
  "isCommandExecuted(bytes32)(bool)" <commandId> --rpc-url $ETH_RPC_URL

# Check token address for symbol
cast call 0x4F4495243837681061C4743b74B3eEdf548D56A5 \
  "tokenAddresses(string)(address)" "axlUSDC" --rpc-url $ETH_RPC_URL

# Check GasService balance
cast balance 0x2d5d7d31F671F86C782533cc367F14109a082712 --rpc-url $ETH_RPC_URL

# Read ITS token manager for a tokenId
cast call 0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C \
  "tokenManagerAddress(bytes32)(address)" <tokenId> --rpc-url $ETH_RPC_URL
```

## Reference

- [Axelar GMP SDK Source](https://github.com/axelarnetwork/axelar-gmp-sdk-solidity)
- [ITS Contracts Source](https://github.com/axelarnetwork/interchain-token-service)
- [Axelar Documentation](https://docs.axelar.dev/)
