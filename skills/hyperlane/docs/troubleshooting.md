# Hyperlane Troubleshooting Guide

Common issues and solutions when integrating Hyperlane messaging, Warp Routes, and ISMs.

## Message Not Delivered on Destination Chain

**Symptoms:**
- `dispatch()` succeeded on origin chain
- Minutes/hours pass with no `handle()` execution on destination
- Hyperlane Explorer shows message as "pending"

**Solutions:**

1. **Check if the interchain gas fee was paid.** If you dispatched without sending ETH as `msg.value`, the default relayer has no incentive to deliver.
   ```typescript
   // Always quote and pay
   const fee = await publicClient.readContract({
     address: MAILBOX,
     abi: mailboxAbi,
     functionName: "quoteDispatch",
     args: [destinationDomain, recipientBytes32, messageBody],
   });
   // fee MUST be sent as msg.value in dispatch()
   ```

2. **Verify the relayer is running for the destination chain.** For chains in the Hyperlane registry, the default relayer covers delivery. For custom-deployed chains, you must run your own relayer.
   ```bash
   # Check if validators have signed for your message
   # Use the Hyperlane Explorer API
   curl https://explorer.hyperlane.xyz/api/v1/messages/<message_id>
   ```

3. **Check if the ISM verification will pass.** The relayer may skip messages that will fail ISM verification. Ensure the correct validator set has signed.

4. **Verify the recipient contract exists on the destination chain.**
   ```bash
   cast code <recipient_address> --rpc-url $DESTINATION_RPC_URL
   ```

5. **Check destination chain gas price.** If gas prices spike, the relayer may delay delivery until the pre-paid gas covers the cost. Overpay on `quoteDispatch()` to ensure delivery during volatile gas markets.

## dispatch() Reverts

**Symptoms:**
- Transaction reverts when calling `mailbox.dispatch()`
- Error is `!msg.value`, `!paused`, or empty revert

**Solutions:**

1. **`!msg.value` — Insufficient gas payment:**
   ```typescript
   // Quote the exact fee needed
   const fee = await publicClient.readContract({
     address: MAILBOX,
     abi: mailboxAbi,
     functionName: "quoteDispatch",
     args: [destinationDomain, recipientBytes32, messageBody],
   });
   // Pass fee as value
   const { request } = await publicClient.simulateContract({
     address: MAILBOX,
     abi: mailboxAbi,
     functionName: "dispatch",
     args: [destinationDomain, recipientBytes32, messageBody],
     value: fee, // this was missing
     account: account.address,
   });
   ```

2. **`!paused` — Mailbox is paused:**
   Check if the Mailbox is paused:
   ```bash
   cast call <MAILBOX> "paused()(bool)" --rpc-url $RPC_URL
   ```
   If paused, wait for the Mailbox owner to unpause. This cannot be bypassed.

3. **Simulate first to get the revert reason:**
   ```typescript
   try {
     const { request } = await publicClient.simulateContract({
       address: MAILBOX,
       abi: mailboxAbi,
       functionName: "dispatch",
       args: [destinationDomain, recipientBytes32, messageBody],
       value: fee,
       account: account.address,
     });
   } catch (error) {
     console.error("Revert reason:", error.message);
   }
   ```

## handle() Reverts on Destination

**Symptoms:**
- Relayer submits `process()` but it reverts
- Message shows as "failed" in Hyperlane Explorer
- Destination chain transaction fails

**Solutions:**

1. **Verify `msg.sender` check in handle().** The only valid caller is the Mailbox contract. If you check against the wrong address, all messages revert.
   ```solidity
   function handle(uint32 _origin, bytes32 _sender, bytes calldata _body)
       external payable override
   {
       // Must be the Mailbox on THIS chain, not the origin chain's Mailbox
       if (msg.sender != address(mailbox)) revert Unauthorized();
   }
   ```

2. **Decode the message body correctly.** If your `handle()` expects a specific ABI-encoded structure but receives different data, decoding will revert.
   ```solidity
   // Ensure encoding matches between dispatch and handle
   // Origin: abi.encode(uint8(1), uint256(amount), address(recipient))
   // Destination: (uint8 action, uint256 amount, address recipient) = abi.decode(_body, (uint8, uint256, address))
   ```

3. **Check the sender bytes32 conversion.** If you validate `_sender` but convert it wrong, legitimate messages get rejected.
   ```solidity
   // Correct conversion from bytes32 to address
   address sender = address(uint160(uint256(_sender)));
   // NOT: address sender = address(bytes20(_sender)); // WRONG — reads first 20 bytes, not last 20
   ```

4. **Fork-test your handle() logic:**
   ```bash
   # Simulate message delivery on a fork
   cast call <MAILBOX> \
     "process(bytes,bytes)" \
     <metadata_hex> <message_hex> \
     --rpc-url $(cast rpc-url --fork-url $DESTINATION_RPC_URL)
   ```

## Warp Route Transfer Stuck

**Symptoms:**
- `transferRemote()` succeeded on origin
- Tokens locked/burned on origin chain
- No tokens minted on destination

**Solutions:**

1. **Same root cause as message not delivered** — check gas payment, relayer status, and ISM verification (see first section).

2. **Verify Warp Route enrollment.** Both sides must know about each other:
   ```bash
   # Check if origin is enrolled on destination
   cast call <DESTINATION_WARP_ROUTE> \
     "routers(uint32)(bytes32)" <ORIGIN_DOMAIN> \
     --rpc-url $DESTINATION_RPC_URL
   # Should return the origin warp route address as bytes32, not zero
   ```

3. **Check if the destination Warp Route has minting authority.** For synthetic tokens (`HypERC20`), the Warp Route contract IS the token — it mints directly. For native tokens, the contract must hold sufficient balance.

## ISM Verification Failures

**Symptoms:**
- `process()` reverts with `!module`, `!threshold`, or `!signer`
- Relayer reports verification failure

**Solutions:**

1. **`!threshold` — Not enough validator signatures:**
   - Check how many validators have signed the checkpoint
   - Verify the MultisigISM's threshold:
     ```bash
     cast call <ISM_ADDRESS> "threshold()(uint8)" --rpc-url $RPC_URL
     ```
   - Ensure enough validators are online and signing

2. **`!signer` — Wrong validator set:**
   - The signing validator is not in the ISM's configured set
   - For static ISMs, the validator set is immutable — redeploy if needed
   - Check validators:
     ```bash
     cast call <ISM_ADDRESS> "validators()(address[])" --rpc-url $RPC_URL
     ```

3. **Recipient uses a custom ISM that you are not satisfying:**
   ```bash
   # Check what ISM the recipient uses
   cast call <RECIPIENT> \
     "interchainSecurityModule()(address)" \
     --rpc-url $RPC_URL
   ```
   If it returns a non-zero address, that ISM's requirements must be met, not the Mailbox's default.

## Gas Estimation Too High or Fails

**Symptoms:**
- `quoteDispatch()` returns an unexpectedly high value
- Gas estimation for `dispatch()` reverts

**Solutions:**

1. **Large message body increases gas cost.** Interchain gas is proportional to the message size and the destination chain's gas price. Keep payloads small.

2. **Destination chain gas price spike.** The gas oracle may reflect high gas prices. Wait for prices to normalize, or accept the higher fee.

3. **Gas estimation reverts because dispatch would revert.** Fix the underlying dispatch issue first (see "dispatch() Reverts" section).

## Interchain Account Call Fails

**Symptoms:**
- ICA `callRemote()` dispatched successfully
- The call on the destination chain reverts

**Solutions:**

1. **ICA has insufficient balance.** Fund your ICA on the destination chain before executing calls that require ETH or tokens.
   ```typescript
   // Get your ICA address
   const icaAddress = await publicClient.readContract({
     address: ICA_ROUTER,
     abi: icaRouterAbi,
     functionName: "getRemoteInterchainAccount",
     args: [destinationDomain, account.address, ICA_ROUTER, ZERO_ADDRESS],
   });
   // Fund it before executing calls
   ```

2. **Calldata encoding mismatch.** The encoded function call does not match the target contract's interface. Double-check ABI encoding.

3. **Target contract has access control.** If the target checks `msg.sender`, it will see the ICA contract address, not your EOA. Whitelist the ICA address on the target contract.

## Debug Checklist

- [ ] `quoteDispatch()` called and fee sent as `msg.value`
- [ ] Recipient contract deployed on destination chain
- [ ] Recipient implements `IMessageRecipient.handle()`
- [ ] Recipient's `handle()` checks `msg.sender == mailbox` (destination Mailbox)
- [ ] Sender address correctly converted between `address` and `bytes32`
- [ ] Message body encoding matches between `dispatch()` and `handle()`
- [ ] Warp Route contracts enrolled on both chains (if using Warp Routes)
- [ ] ERC-20 approved to Warp Route collateral contract (if bridging tokens)
- [ ] Relayer running for destination chain
- [ ] Validators online and signing for origin chain
- [ ] ISM configuration matches the validator set providing signatures
- [ ] Transaction simulated successfully before broadcast
