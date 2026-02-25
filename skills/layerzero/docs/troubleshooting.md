# LayerZero V2 Troubleshooting Guide

Common issues and solutions when integrating LayerZero V2 OApp, OFT, and cross-chain messaging.

## Message Reverts on Source Chain with `NoPeer`

**Symptoms:**
- Transaction reverts with `NoPeer(uint32 eid)`
- `_lzSend` fails immediately

**Solutions:**

1. **Set the peer for the destination chain:**
   ```typescript
   function addressToBytes32(addr: Address): `0x${string}` {
     return `0x${addr.slice(2).padStart(64, "0")}` as `0x${string}`;
   }

   const { request } = await publicClient.simulateContract({
     address: sourceOApp,
     abi: parseAbi(["function setPeer(uint32 eid, bytes32 peer) external"]),
     functionName: "setPeer",
     args: [30110, addressToBytes32(destinationOApp)],
     account: account.address,
   });
   ```

2. **Verify the peer is set correctly:**
   ```bash
   cast call <oapp_address> "peers(uint32)(bytes32)" 30110 --rpc-url $RPC_URL
   ```
   If the result is `0x0000...0000`, the peer is not set.

3. **Ensure you are using the correct eid.** Endpoint IDs are NOT chain IDs. Ethereum is `30101`, Arbitrum is `30110`. See the endpoint addresses resource for the full list.

## Message Reverts with `InsufficientFee`

**Symptoms:**
- Revert with `InsufficientFee(uint256 required, uint256 supplied)`
- Or generic revert when `msg.value` is too low

**Solutions:**

1. **Always quote immediately before sending:**
   ```typescript
   const fee = await publicClient.readContract({
     address: oappAddress,
     abi: parseAbi([
       "function quote(uint32 dstEid, bytes calldata payload, bytes calldata options) view returns ((uint256 nativeFee, uint256 lzTokenFee) fee)"
     ]),
     functionName: "quote",
     args: [dstEid, payload, options],
   });

   // Pass fee.nativeFee as msg.value
   ```

2. **Do not cache fees.** Gas prices on both source and destination fluctuate. Always re-quote before each send.

3. **Add a small buffer for gas price spikes:**
   ```typescript
   // 5% buffer
   const valueToSend = (fee.nativeFee * 105n) / 100n;
   ```
   Excess is refunded to the `refundAddress`.

## Message Stuck at "Verifying" on LayerZero Scan

**Symptoms:**
- Source transaction succeeded
- LayerZero Scan shows "Verifying" for extended period
- Message never reaches "Delivered"

**Solutions:**

1. **Wait for block confirmations.** DVNs wait for the configured `confirmations` count before verifying. Ethereum defaults to 15 confirmations (~3 minutes). If you set 64 confirmations, wait ~13 minutes.

2. **Check DVN configuration is valid for this pathway:**
   ```bash
   # Read send config
   cast call 0x1a44076050125825900e736c501f859c50fE728c \
     "getConfig(address,address,uint32,uint32)(bytes)" \
     <oapp> <send_lib> <dst_eid> 2 --rpc-url $RPC_URL
   ```

3. **Verify the DVNs support this chain pair.** Not all DVNs support all pathways. If you configured a DVN that does not operate on your destination chain, messages will never verify.

4. **Check if using default config.** If you never explicitly set DVN config, the default (LayerZero Labs DVN) applies. This usually works, but verify on LayerZero Scan.

## `lzReceive` Reverts on Destination

**Symptoms:**
- Message verified and delivered
- LayerZero Scan shows "Failed" on destination
- `lzReceive` execution reverted

**Solutions:**

1. **Increase gas limit in options.** The most common cause. Start with 500k gas and optimize down:
   ```solidity
   bytes memory options = OptionsBuilder.newOptions()
       .addExecutorLzReceiveOption(500_000, 0);
   ```

2. **Debug the `_lzReceive` implementation.** Simulate the call locally:
   ```bash
   cast call <destination_oapp> \
     "lzReceive((uint32,bytes32,uint64),bytes32,bytes,address,bytes)" \
     "(30101,0x...sender,1)" "0x...guid" "0x...payload" "0x...executor" "0x" \
     --rpc-url $DEST_RPC_URL
   ```

3. **Check payload encoding.** If source encodes with `abi.encode(uint256, string)` but destination decodes with `abi.decode(payload, (string, uint256))` (wrong order), it will revert.

4. **Retry the failed message.** Failed messages are stored by EndpointV2 and can be retried:
   ```typescript
   const retryAbi = parseAbi([
     "function retryPayload(uint32 srcEid, bytes32 sender, uint64 nonce, bytes calldata payload) external payable",
   ]);
   ```

## OFT `SlippageExceeded` Revert

**Symptoms:**
- OFT `send` reverts with `SlippageExceeded(uint256, uint256)`

**Solutions:**

1. **Increase `minAmountLD` tolerance.** The shared decimals conversion removes dust. For an 18-decimal token with 6 shared decimals, 12 decimal places are truncated:
   ```typescript
   const sendParam = {
     // ...
     amountLD: 1000_123456789012345678n, // 1000.123456789...
     // After shared decimal conversion: 1000.123456000...
     // minAmountLD must be <= the post-conversion amount
     minAmountLD: 1000_000000000000000000n, // safe minimum
   };
   ```

2. **Understand shared decimal math:**
   ```
   amountSD = amountLD / (10 ** (localDecimals - sharedDecimals))
   amountReceivedLD = amountSD * (10 ** (localDecimals - sharedDecimals))
   ```
   Always set `minAmountLD` based on the post-conversion amount.

## Peer Address Mismatch (`OnlyPeer`)

**Symptoms:**
- Message arrives on destination but `lzReceive` reverts with `OnlyPeer`
- Source transaction succeeded, destination rejects

**Solutions:**

1. **Peers must be set BIDIRECTIONALLY.** On chain A, set the peer to chain B's address. On chain B, set the peer to chain A's address. Missing either side causes `OnlyPeer`.

2. **Peer addresses are bytes32, not address.** Ensure correct left-padding:
   ```typescript
   // CORRECT: left-pad to 32 bytes
   function addressToBytes32(addr: Address): `0x${string}` {
     return `0x${addr.slice(2).padStart(64, "0")}` as `0x${string}`;
   }

   // WRONG: using raw address without padding
   // setPeer(30110, "0x1234...") // This will NOT work
   ```

3. **Verify peers on both sides:**
   ```bash
   # On source chain
   cast call <source_oapp> "peers(uint32)(bytes32)" <dst_eid> --rpc-url $SRC_RPC

   # On destination chain
   cast call <dest_oapp> "peers(uint32)(bytes32)" <src_eid> --rpc-url $DST_RPC
   ```

## Using V1 Imports Instead of V2

**Symptoms:**
- Compilation errors mentioning `ILayerZeroEndpoint`, `LZApp`, or `NonblockingLZApp`
- Functions like `lzSend` instead of `_lzSend`

**Solutions:**

1. **Remove V1 packages:**
   ```bash
   npm uninstall @layerzerolabs/solidity-examples
   ```

2. **Install V2 packages:**
   ```bash
   npm install @layerzerolabs/oapp-evm @layerzerolabs/oft-evm
   ```

3. **V1 to V2 import mapping:**
   | V1 Import | V2 Import |
   |-----------|-----------|
   | `@layerzerolabs/solidity-examples/.../LZApp.sol` | `@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol` |
   | `@layerzerolabs/solidity-examples/.../NonblockingLZApp.sol` | `@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol` |
   | `@layerzerolabs/solidity-examples/.../OFT.sol` | `@layerzerolabs/oft-evm/contracts/OFT.sol` |
   | `ILayerZeroEndpoint` | `ILayerZeroEndpointV2` |

## Fee Estimation Returns Zero

**Symptoms:**
- `_quote()` or `quoteSend()` returns `{nativeFee: 0, lzTokenFee: 0}`

**Solutions:**

1. **Check that the send library is configured.** If no send library is set for the OApp + destination eid pair, the quote may return zero.

2. **Verify the peer is set.** Some quote implementations check peers internally.

3. **Ensure options are not empty.** Pass at least a basic `lzReceive` gas option:
   ```solidity
   bytes memory options = OptionsBuilder.newOptions()
       .addExecutorLzReceiveOption(200_000, 0);
   ```

## Gas Estimation Too High or Failing

**Symptoms:**
- `estimateGas` returns unreasonably high value for `sendMessage`
- Gas estimation reverts

**Solutions:**

1. **The send itself would revert.** Gas estimation simulates the full transaction. If peers are not set, fees are insufficient, or payload is invalid, the estimation fails.

2. **Include the correct `msg.value`.** Gas estimation needs the fee to be provided:
   ```typescript
   const fee = await publicClient.readContract({ /* quote call */ });
   const gas = await publicClient.estimateContractGas({
     // ... send params
     value: fee.nativeFee,
   });
   ```

3. **Add a 20% gas buffer** for cross-chain sends, which may interact with multiple internal contracts:
   ```typescript
   const gasLimit = (estimatedGas * 120n) / 100n;
   ```

## Debug Checklist

- [ ] Using V2 packages (`@layerzerolabs/oapp-evm`), not V1 (`solidity-examples`)
- [ ] EndpointV2 address is correct for the chain (`0x1a44076050125825900e736c501f859c50fE728c`)
- [ ] Using eid (Endpoint ID), not chain ID
- [ ] Peers set bidirectionally on both source and destination
- [ ] Peer addresses are `bytes32` (left-padded), not raw `address`
- [ ] Fee quoted immediately before sending and passed as `msg.value`
- [ ] Options include sufficient gas for `lzReceive` on destination
- [ ] DVN config valid for the source->destination pathway
- [ ] Sender is the OApp delegate/owner for admin operations
- [ ] Transaction simulated before broadcasting
