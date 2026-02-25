# Wormhole Troubleshooting Guide

Common issues and solutions when integrating Wormhole cross-chain messaging, NTT, and Token Bridge.

## VAA Not Found After Publishing Message

**Symptoms:**
- `fetchVaa()` returns 404 repeatedly after calling `publishMessage()`
- Wormholescan explorer does not show the message

**Solutions:**

1. **Wait for finality.** If you used `consistencyLevel = 15` on Ethereum, Guardians wait for 15 block confirmations (~3 minutes) before signing. The full process (finality + observation + 13/19 signatures) takes 13-15 minutes.

2. **Verify the emitter address.** The emitter is the contract that called `publishMessage()`, not the EOA that sent the transaction. If your contract calls the Core Bridge, the emitter is your contract address, not `msg.sender`.
   ```typescript
   // If your contract at 0xABC... calls publishMessage:
   // Emitter = 0x000000000000000000000000ABC...
   // NOT your EOA address

   const emitterAddress = evmAddressToBytes32(contractAddress).slice(2);
   ```

3. **Use the correct API endpoint.** Mainnet and testnet use different endpoints:
   ```typescript
   // Mainnet
   const MAINNET_API = "https://api.wormholescan.io/api/v1";

   // Testnet
   const TESTNET_API = "https://api.testnet.wormholescan.io/api/v1";
   ```

4. **Check the transaction actually succeeded.** A reverted `publishMessage()` call emits no event and produces no VAA:
   ```typescript
   const receipt = await client.waitForTransactionReceipt({ hash });
   if (receipt.status !== "success") {
     throw new Error("publishMessage reverted -- no VAA will be produced");
   }
   ```

## Transfer Stuck -- VAA Signed But Not Redeemed

**Symptoms:**
- VAA is available on Wormholescan
- Tokens are locked on the source chain
- No corresponding mint on the destination chain

**Solutions:**

1. **Manual redemption required.** If you did not use the Standard Relayer, you must manually submit the VAA to the destination chain:
   ```typescript
   const vaaBytes = await fetchVaa(emitterChain, emitterAddress, sequence);
   const encodedVaa = `0x${Buffer.from(vaaBytes).toString("hex")}` as `0x${string}`;

   const { request } = await destClient.simulateContract({
     address: DEST_TOKEN_BRIDGE,
     abi: tokenBridgeAbi,
     functionName: "completeTransfer",
     args: [encodedVaa],
     account: account.address,
   });

   const hash = await destWallet.writeContract(request);
   ```

2. **Check if already redeemed.** Each VAA can only be consumed once:
   ```bash
   cast call <TOKEN_BRIDGE> "isTransferCompleted(bytes32)(bool)" <vaa_hash> --rpc-url $RPC_URL
   ```

3. **Use the Wormhole Portal UI for manual recovery.** Visit [https://portalbridge.com](https://portalbridge.com) and use the recovery feature with your source transaction hash.

## Standard Relayer Delivery Failed

**Symptoms:**
- Paid for relay on source chain
- Message not delivered on destination chain
- Wormholescan shows delivery status as "failed"

**Solutions:**

1. **Gas limit too low.** Your `receiveWormholeMessages` handler exceeded the gas budget. Increase the gas limit:
   ```typescript
   // Default 200k may not be enough for complex handlers
   const GAS_LIMIT = 500_000n;

   const [deliveryCost] = await client.readContract({
     address: WORMHOLE_RELAYER,
     abi: relayerAbi,
     functionName: "quoteEVMDeliveryPrice",
     args: [targetChain, 0n, GAS_LIMIT],
   });
   ```

2. **Receiver contract reverted.** Simulate the `receiveWormholeMessages` call locally to find the revert reason:
   ```typescript
   try {
     await destClient.simulateContract({
       address: receiverContract,
       abi: receiverAbi,
       functionName: "receiveWormholeMessages",
       args: [payload, [], sourceAddress, sourceChain, deliveryHash],
       account: WORMHOLE_RELAYER, // simulate as relayer
     });
   } catch (error) {
     console.error("Receiver would revert:", error.message);
   }
   ```

3. **Request re-delivery.** If the initial delivery failed, you can request re-delivery with a higher gas limit:
   ```typescript
   const redeliveryAbi = [
     {
       name: "resendToEvm",
       type: "function",
       stateMutability: "payable",
       inputs: [
         { name: "deliveryVaaKey", type: "tuple", components: [
           { name: "chainId", type: "uint16" },
           { name: "emitterAddress", type: "bytes32" },
           { name: "sequence", type: "uint64" },
         ]},
         { name: "targetChain", type: "uint16" },
         { name: "newReceiverValue", type: "uint256" },
         { name: "newGasLimit", type: "uint256" },
         { name: "newDeliveryProviderAddress", type: "address" },
       ],
       outputs: [],
     },
   ] as const;
   ```

## NTT Transfer Queued (Rate Limited)

**Symptoms:**
- `transfer()` succeeds but tokens do not arrive on the destination
- Event shows `TransferQueued`

**Solutions:**

1. **This is expected behavior.** NTT rate limiting protects against exploits. The transfer will complete when the rate limit window replenishes.

2. **Check current rate limit status:**
   ```typescript
   const rateLimitAbi = [
     {
       name: "getInboundLimitParams",
       type: "function",
       stateMutability: "view",
       inputs: [{ name: "chainId", type: "uint16" }],
       outputs: [{ name: "limit", type: "uint256" }],
     },
     {
       name: "getCurrentInboundCapacity",
       type: "function",
       stateMutability: "view",
       inputs: [{ name: "chainId", type: "uint16" }],
       outputs: [{ name: "capacity", type: "uint256" }],
     },
   ] as const;

   const capacity = await destClient.readContract({
     address: DEST_NTT_MANAGER,
     abi: rateLimitAbi,
     functionName: "getCurrentInboundCapacity",
     args: [sourceWormholeChainId],
   });
   ```

3. **If you set `shouldQueue = false`,** the transfer reverts instead of queuing. Use `shouldQueue = true` for non-critical transfers that can tolerate delay.

## Wrong Chain ID Used

**Symptoms:**
- Transaction succeeds but message goes to the wrong chain
- Destination chain shows no incoming message
- `InvalidRecipientChain` revert on redemption

**Solutions:**

1. **Use Wormhole chain IDs, not EVM chain IDs:**
   ```typescript
   // WRONG -- these are EVM chain IDs
   const ARBITRUM = 42161;
   const OPTIMISM = 10; // This is actually Fantom in Wormhole!

   // CORRECT -- these are Wormhole chain IDs
   const ARBITRUM = 23;
   const OPTIMISM = 24;
   ```

2. **Use the chain ID constants from the SDK:**
   ```typescript
   import { chainToChainId } from "@wormhole-foundation/sdk";

   const arbChainId = chainToChainId("Arbitrum"); // 23
   const optChainId = chainToChainId("Optimism"); // 24
   ```

3. **Validate chain IDs before sending:**
   ```typescript
   const VALID_WORMHOLE_CHAIN_IDS = new Set([1, 2, 4, 5, 6, 10, 23, 24, 30]);

   function validateChainId(chainId: number): void {
     if (!VALID_WORMHOLE_CHAIN_IDS.has(chainId)) {
       throw new Error(
         `Invalid Wormhole chain ID: ${chainId}. Did you use an EVM chain ID by mistake?`
       );
     }
   }
   ```

## Token Bridge Precision Loss

**Symptoms:**
- Transferred 100.123456789012345678 tokens (18 decimals)
- Received 100.12345678 on the destination (truncated to 8 decimals)
- Small transfers of less than 1e-8 tokens result in 0

**Solutions:**

1. **This is by design.** The Token Bridge normalizes all amounts to 8 decimal places. The truncated portion is not recoverable.

2. **Calculate the minimum transferable amount:**
   ```typescript
   function minTransferAmount(tokenDecimals: number): bigint {
     if (tokenDecimals <= 8) return 1n;
     return 10n ** BigInt(tokenDecimals - 8);
   }

   // For 18-decimal tokens: minimum = 10^10 = 0.00000001 tokens
   // For 6-decimal tokens: minimum = 1 = 0.000001 tokens (no precision loss)
   ```

3. **Use NTT instead** if you need full decimal precision and you control the token contract.

## Emitter Address Mismatch

**Symptoms:**
- `InvalidEmitterAddress` revert when receiving a message
- VAA verifies successfully but application-level checks fail

**Solutions:**

1. **EVM addresses are left-padded to 32 bytes:**
   ```typescript
   // Contract at 0xABC...123 becomes:
   // 0x000000000000000000000000ABC...123

   function evmAddressToBytes32(address: `0x${string}`): `0x${string}` {
     return `0x000000000000000000000000${address.slice(2)}` as `0x${string}`;
   }
   ```

2. **Solana emitter addresses are program-derived.** The emitter for a Solana program is its emitter PDA, not the program ID itself. Check the program's documentation for the correct emitter derivation.

3. **Register the correct emitter on the receiver contract:**
   ```solidity
   // Deploy sender on Ethereum at 0xABC...
   // On the Arbitrum receiver, register:
   bytes32 sourceEmitter = bytes32(uint256(uint160(0xABC...)));
   ```

## Guardian Set Rotation

**Symptoms:**
- VAAs that were valid yesterday now fail verification
- `GuardianSetExpired` error

**Solutions:**

1. **Refetch the VAA.** Guardian set rotations invalidate VAAs signed by the old set. The Guardian API returns VAAs signed by the current set.

2. **Do not cache VAAs long-term.** VAAs should be consumed promptly. If you need to store them, verify they are still valid before submission:
   ```typescript
   const [, valid, reason] = await client.readContract({
     address: CORE_BRIDGE,
     abi: coreBridgeAbi,
     functionName: "parseAndVerifyVM",
     args: [encodedVaa],
   });

   if (!valid) {
     // Refetch from Guardian API
   }
   ```

## Debug Checklist

- [ ] Using Wormhole chain IDs (not EVM chain IDs)
- [ ] Emitter address is left-padded bytes32 (for EVM)
- [ ] `msg.value` >= `messageFee()` on publishMessage
- [ ] `msg.value` >= `quoteEVMDeliveryPrice()` on relay
- [ ] Correct API endpoint (mainnet vs testnet)
- [ ] Transaction confirmed before fetching VAA
- [ ] Sufficient wait time for Guardian signing (~15 minutes on Ethereum)
- [ ] Peer registration is bidirectional (for NTT)
- [ ] NttManager set as minter on token contracts (for NTT)
- [ ] Rate limits configured with appropriate thresholds (for NTT)
- [ ] Token attested on destination chain (for Token Bridge)
- [ ] VAA not already consumed (replay protection)
