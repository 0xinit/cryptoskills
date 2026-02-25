# Hyperlane Error Codes

Common revert reasons when interacting with Hyperlane contracts, with causes and fixes.

## Mailbox Errors

| Error / Revert Reason | Cause | Fix |
|----------------------|-------|-----|
| `!msg.value` | `dispatch()` called without sufficient ETH for interchain gas payment | Call `quoteDispatch()` first and send the returned fee as `msg.value` |
| `!recipient` | Recipient address is zero bytes32 | Provide a valid `bytes32` recipient address (left-pad EVM address with zeros) |
| `!paused` | Mailbox is paused by the owner | Wait for the Mailbox owner to unpause. Cannot be bypassed |
| `delivered` | `process()` called for a message that was already delivered | This is idempotent — the message was successfully delivered previously. No action needed |
| `!module` | ISM `verify()` returned false — message verification failed | Check that validator signatures are correct and the ISM's validator set matches. Ensure relayer is submitting the right metadata |
| `!process` | Message processing failed during `handle()` execution | The recipient contract's `handle()` reverted. Debug the recipient's logic |

## ISM Errors

| Error / Revert Reason | Cause | Fix |
|----------------------|-------|-----|
| `!threshold` | MultisigISM: Not enough valid validator signatures provided | Ensure at least `threshold` validators have signed the checkpoint. Check that validators are in the ISM's configured set |
| `!signer` | MultisigISM: A provided signature does not match any configured validator | Verify the signing address is in the ISM's validator set. Validator sets are immutable for static ISMs |
| `!merkleProof` | Merkle proof verification failed | The message's Merkle proof does not match the signed root. Likely a relayer bug or stale checkpoint |
| `!module` | AggregationISM: One or more sub-modules failed verification | Check each sub-module's requirements. All modules up to the threshold must pass |

## Warp Route Errors

| Error / Revert Reason | Cause | Fix |
|----------------------|-------|-----|
| `!router` | The source domain's router is not enrolled on the destination Warp Route contract | Enroll the source chain's Warp Route contract via `enrollRemoteRouter()` |
| `!amount` | Transfer amount is zero | Provide a non-zero transfer amount |
| `!balance` | Insufficient token balance for the transfer | Ensure the sender has enough tokens (for collateral) or synthetic tokens (for bridge-back) |
| `ERC20: transfer amount exceeds allowance` | Collateral Warp Route does not have approval to spend tokens | Approve the Warp Route contract to spend your ERC-20 tokens before calling `transferRemote()` |
| `ERC20: burn amount exceeds balance` | Trying to bridge back more synthetic tokens than held | Check synthetic token balance before calling `transferRemote()` from the synthetic side |

## InterchainGasPaymaster Errors

| Error / Revert Reason | Cause | Fix |
|----------------------|-------|-----|
| `!gasConfig` | No gas configuration set for the destination domain | The IGP does not have gas oracle data for this destination. Check if the chain is supported or deploy a custom gas config |
| `insufficient interchain gas payment` | ETH sent is less than the required gas payment | Use `quoteGasPayment()` to get the exact required fee and send it as `msg.value` |

## Hook Errors

| Error / Revert Reason | Cause | Fix |
|----------------------|-------|-----|
| `!postDispatch` | Post-dispatch hook execution failed | Check the hook contract's requirements. For IGP hooks, ensure sufficient `msg.value` |
| `!metadata` | Hook does not support the provided metadata format | Verify metadata encoding matches what the hook expects |

## Interchain Account Errors

| Error / Revert Reason | Cause | Fix |
|----------------------|-------|-----|
| `!owner` | The caller is not the authorized ICA owner | Only the origin chain sender (via Hyperlane message) can control the ICA. Cannot be called directly |
| `call failed` | One of the batched calls on the destination chain reverted | Debug the individual call — check target contract, calldata, and whether the ICA has sufficient balance/approvals |

## Debugging Tips

### Get the Revert Reason from a Failed Transaction

```bash
# Trace a failed transaction
cast run <tx_hash> --rpc-url $RPC_URL

# Decode a revert reason from raw bytes
cast 4byte-decode <error_selector>
```

### Check If a Message Was Delivered

```bash
# Query the Mailbox for message delivery status
cast call <MAILBOX_ADDRESS> \
  "delivered(bytes32)(bool)" \
  <message_id> \
  --rpc-url $DESTINATION_RPC_URL
```

### Verify ISM Configuration

```bash
# Check what ISM a recipient uses
cast call <RECIPIENT_ADDRESS> \
  "interchainSecurityModule()(address)" \
  --rpc-url $RPC_URL

# Check the Mailbox's default ISM
cast call <MAILBOX_ADDRESS> \
  "defaultIsm()(address)" \
  --rpc-url $RPC_URL
```
