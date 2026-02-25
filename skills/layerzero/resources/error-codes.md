# LayerZero V2 Error Codes

Common V2 revert reasons with explanations and fixes.

## EndpointV2 Errors

| Error | Signature | Cause | Fix |
|-------|-----------|-------|-----|
| `InvalidEid` | `InvalidEid()` | Endpoint ID does not exist or is not supported | Use correct eid from the endpoint address list (NOT chain ID) |
| `LzTokenUnavailable` | `LzTokenUnavailable()` | Attempting to pay with ZRO token when not enabled | Pass `false` for `payInLzToken` in `_quote()` |
| `InvalidAmount` | `InvalidAmount(uint256 actual, uint256 expected)` | Fee amount mismatch or zero-amount send | Pass the exact `MessagingFee` returned by `_quote()` as `msg.value` |
| `Unauthorized` | `Unauthorized()` | Caller is not the registered delegate for this OApp | Call from the OApp's delegate address (set during construction or via `setDelegate`) |
| `InvalidReceiveLibrary` | `InvalidReceiveLibrary()` | Receive library not set or mismatch | Configure the receive library for the (srcEid, oapp) pair |

## OApp Errors

| Error | Signature | Cause | Fix |
|-------|-----------|-------|-----|
| `NoPeer` | `NoPeer(uint32 eid)` | No peer registered for this endpoint ID | Call `setPeer(eid, bytes32(peerAddress))` on the sending OApp |
| `OnlyPeer` | `OnlyPeer(uint32 eid, bytes32 sender)` | Incoming message from address that is not the registered peer | Call `setPeer(srcEid, bytes32(senderAddress))` on the receiving OApp |
| `InvalidEndpointCall` | `InvalidEndpointCall()` | `lzReceive` called directly instead of through EndpointV2 | Only `EndpointV2` should call `lzReceive` — do not call it directly |
| `InvalidDelegate` | `InvalidDelegate()` | Zero address passed as delegate | Pass a valid delegate address in constructor |
| `InvalidOptions` | `InvalidOptions(bytes options)` | Malformed or empty options bytes | Use `OptionsBuilder` to construct valid options |

## OFT Errors

| Error | Signature | Cause | Fix |
|-------|-----------|-------|-----|
| `SlippageExceeded` | `SlippageExceeded(uint256 amountLD, uint256 minAmountLD)` | Received amount after shared decimal conversion is below minimum | Increase `minAmountLD` tolerance or send a larger amount |
| `InvalidLocalDecimals` | `InvalidLocalDecimals()` | Token decimals less than shared decimals | Override `sharedDecimals()` to return a value <= token decimals |
| `InvalidAmount` | `InvalidAmount(uint256 amountLD)` | Amount rounds to zero in shared decimals | Send a larger amount — minimum is `10^(localDecimals - sharedDecimals)` |

## MessageLib (ULN302) Errors

| Error | Signature | Cause | Fix |
|-------|-----------|-------|-----|
| `InvalidConfirmations` | `InvalidConfirmations()` | Block confirmations set to 0 or invalid | Set confirmations >= 1 in ULN config |
| `InvalidRequiredDVNCount` | `InvalidRequiredDVNCount()` | Required DVN count is 0 | Set at least 1 required DVN |
| `InvalidOptionalDVNThreshold` | `InvalidOptionalDVNThreshold()` | Optional threshold > optional DVN count | Ensure `optionalDVNThreshold <= optionalDVNCount` |
| `UnsortedDVNs` | `UnsortedDVNs()` | DVN address arrays not sorted ascending | Sort DVN addresses in ascending order before passing to config |
| `DVNAlreadySet` | `DVNAlreadySet(address dvn)` | Duplicate DVN in required or optional array | Remove duplicate DVN addresses |

## Executor Errors

| Error | Signature | Cause | Fix |
|-------|-----------|-------|-----|
| `InsufficientFee` | `InsufficientFee(uint256 required, uint256 supplied)` | `msg.value` below the quoted native fee | Re-quote and send the exact `nativeFee` as `msg.value` |
| `NativeTransferFailed` | `NativeTransferFailed()` | Failed to refund excess native token | Ensure refund address can receive native tokens (not a contract that rejects) |

## Common Revert Patterns

### Transaction Reverts on Source Chain

```
Cause: Fee, peer, or options issue on the sending side.
Debug steps:
1. Check `msg.value >= quotedFee.nativeFee`
2. Verify peer is set: `cast call <oapp> "peers(uint32)(bytes32)" <dstEid>`
3. Verify options are well-formed (use OptionsBuilder)
4. Simulate before broadcasting
```

### Message Stuck at "Verifying"

```
Cause: DVNs have not yet confirmed the message.
Debug steps:
1. Check block confirmations setting vs current block height
2. Verify DVN config is valid for this pathway
3. Check layerzeroscan.com for DVN verification status
4. Wait — Ethereum requires 15+ confirmations by default
```

### `lzReceive` Reverts on Destination

```
Cause: Insufficient gas in options, or custom logic failure in _lzReceive.
Debug steps:
1. Increase gas limit in options (start with 500k, optimize down)
2. Check _lzReceive implementation for reverts
3. Message is stored — can be retried after fixing
```

## Debug Commands

```bash
# Check if peer is set
cast call <oapp_address> "peers(uint32)(bytes32)" 30110 --rpc-url $RPC_URL

# Check endpoint address
cast call <oapp_address> "endpoint()(address)" --rpc-url $RPC_URL

# Check OApp owner/delegate
cast call <oapp_address> "owner()(address)" --rpc-url $RPC_URL

# Read send library for pathway
cast call 0x1a44076050125825900e736c501f859c50fE728c \
  "getSendLibrary(address,uint32)(address)" \
  <oapp_address> 30110 --rpc-url $RPC_URL

# Verify contract deployment
cast code <address> --rpc-url $RPC_URL
```
