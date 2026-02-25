# Wormhole Error Codes and Revert Reasons

> **Last verified:** February 2026

Common revert reasons and error codes encountered when integrating Wormhole contracts.

## Core Bridge Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `InvalidVAA` | VAA signature verification failed -- corrupted bytes or tampered payload | Refetch the VAA from the Guardian API; ensure no byte corruption during transport |
| `GuardianSetExpired` | VAA was signed by an old guardian set that has since been superseded | Refetch a new VAA; old VAAs become invalid after guardian set rotation |
| `InvalidGuardianSetIndex` | The guardian set index in the VAA does not match any known set | The VAA predates the current guardian set; refetch from Guardians |
| `VMVersionIncompatible` | VAA version is not 1 | Use VAA format version 1 (current standard) |
| `InsufficientFee` | `msg.value` is less than `messageFee()` | Read `messageFee()` dynamically and send at least that amount |
| `InvalidGuardianIndex` | A signature references a guardian index outside the current set | VAA is corrupted or from a different network (testnet vs mainnet) |
| `NoQuorum` | Fewer than 13 of 19 guardian signatures provided | Wait for more Guardians to sign; the VAA is incomplete |
| `SignaturesMustBeSorted` | Guardian signatures in the VAA are not in ascending order by index | This is a VAA construction error; use the SDK to serialize correctly |

## Token Bridge Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `TransferAmountTooSmall` | After 8-decimal normalization, the amount rounds to 0 | Send a larger amount; minimum is `10^(decimals - 8)` for tokens with >8 decimals |
| `TokenNotAttested` | Token has not been attested on the destination chain | Call `attestToken()` on the source chain, then `createWrapped()` on the destination |
| `ReplayProtection` | This VAA has already been redeemed on this chain | Each VAA can only be consumed once per chain; this transfer was already completed |
| `InvalidRecipientChain` | The transfer VAA's recipient chain does not match the chain it was submitted on | Submit the VAA to the correct destination chain |
| `InvalidEmitter` | The VAA's emitter address is not a registered Token Bridge | Ensure the VAA was emitted by a legitimate Token Bridge contract |
| `AssetNotRegistered` | Attempting to complete a transfer for an unregistered asset | Run attestation first: `attestToken` on source, `createWrapped` on destination |

## Standard Relayer Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `InsufficientRelayerFee` | `msg.value` is less than `quoteEVMDeliveryPrice()` | Re-quote the delivery price and send the quoted amount |
| `TargetChainNotSupported` | The relayer does not support the destination chain | Check supported chains; some chains require manual relaying |
| `DeliveryGasLimitExceeded` | The `receiveWormholeMessages` handler used more gas than the budget | Increase `gasLimit` in `quoteEVMDeliveryPrice` or simplify the handler logic |
| `OnlyRelayer` | A non-relayer address called `receiveWormholeMessages` | Only the Wormhole Relayer contract should call this function |
| `DeliveryProviderNotSupported` | Invalid delivery provider address | Use the default delivery provider |

## NTT Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `CallerNotMinter` | A non-NttManager address tried to mint tokens | Set the NttManager as the token's minter via `setMinter()` |
| `PeerNotRegistered` | The source chain's NttManager is not registered as a peer | Call `setPeer()` on the destination NttManager to register the source |
| `InvalidPeer` | The message came from an NttManager that is not the registered peer for that chain | Verify peer registration matches the actual deployed NttManager address |
| `RateLimitExceeded` | Transfer exceeds the configured rate limit | Wait for the rate limit window to replenish, or set `shouldQueue = true` to queue |
| `TransferQueued` | Transfer was queued due to rate limiting (when `shouldQueue = true`) | The transfer will complete automatically when capacity is available |
| `InvalidTransceiverIndex` | Transceiver index is out of bounds | Check transceiver registration on the NttManager |
| `NotEnoughTransceiverAttestations` | Not enough transceivers have attested the message | Wait for all configured transceivers to deliver their attestations |
| `AmountTooLarge` | Transfer amount exceeds the outbound rate limit entirely | Reduce the transfer amount or increase the outbound limit |

## Wormhole Queries Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `StaleResponse` | The query response is older than the staleness threshold | Submit a fresh query; the on-chain verifier rejected the stale data |
| `InvalidQuerySignatures` | Guardian signatures on the query response are invalid | Refetch the query response; ensure signatures were not corrupted |
| `UnexpectedChainId` | Query response is from a different chain than expected | Verify the chain ID in your query request matches expectations |
| `InvalidCallData` | The eth_call in the query returned an error | Check that the target contract and function selector are correct |

## Debugging Tips

### Decoding Revert Reasons

```typescript
import { decodeErrorResult, parseAbi } from "viem";

const wormholeErrors = parseAbi([
  "error InsufficientFee(uint256 required, uint256 provided)",
  "error InvalidVAA(string reason)",
  "error InvalidEmitterChain(uint16 expected, uint16 actual)",
  "error OnlyRelayer(address caller, address expected)",
  "error RateLimitExceeded(uint256 limit, uint256 requested)",
]);

function decodeWormholeError(errorData: `0x${string}`): string {
  try {
    const decoded = decodeErrorResult({
      abi: wormholeErrors,
      data: errorData,
    });
    return `${decoded.errorName}: ${JSON.stringify(decoded.args)}`;
  } catch {
    return `Unknown error: ${errorData}`;
  }
}
```

### Using Cast to Debug

```bash
# Trace a failed transaction
cast run <tx_hash> --rpc-url $RPC_URL

# Decode error data
cast 4byte-decode <error_selector>

# Check if a VAA has been consumed (replay protection)
cast call <TOKEN_BRIDGE> "isTransferCompleted(bytes32)(bool)" <vaa_hash> --rpc-url $RPC_URL
```
