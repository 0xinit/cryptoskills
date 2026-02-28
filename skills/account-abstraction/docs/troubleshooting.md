# Account Abstraction Troubleshooting Guide

Common issues and solutions when working with ERC-4337 smart accounts, bundlers, and paymasters.

## UserOp Reverted During Validation

**Symptoms:**
- Bundler returns `AA23: reverted (or OOG)` or `AA24: signature error`
- UserOp is rejected before execution

**Solutions:**

1. **Signature format mismatch.** EntryPoint v0.7 hashes the UserOp differently than v0.6. Ensure your SDK targets the correct EntryPoint version:
   ```typescript
   // Correct: specify version explicitly
   const account = await toSimpleSmartAccount({
     client: publicClient,
     owner,
     entryPoint: {
       address: entryPoint07Address,
       version: "0.7", // Must match your EntryPoint deployment
     },
   });
   ```

2. **Wrong chain ID in signature.** The `userOpHash` includes the chain ID and EntryPoint address. Signing on a different chain or against a different EntryPoint produces an invalid signature.

3. **Account not deployed and no initCode.** If the smart account has not been deployed yet, the UserOp must include `initCode` with the factory address and creation calldata. Most SDKs handle this automatically.

4. **Insufficient verificationGasLimit.** Complex validation logic (session keys, multisig) needs more gas. Increase `verificationGasLimit` or let the bundler estimate it.

## Paymaster Validation Failed

**Symptoms:**
- `AA33: reverted (or OOG)` or `AA34: signature error`
- `rejected by paymaster` from bundler

**Solutions:**

1. **Paymaster deposit depleted.** Check the paymaster's EntryPoint balance:
   ```bash
   cast call 0x0000000071727De22E5E9d8BAf0edAc6f37da032 "balanceOf(address)(uint256)" $PAYMASTER_ADDRESS --rpc-url $RPC_URL
   ```

2. **Stale paymaster signature.** Verifying paymasters issue signatures with expiry timestamps. Regenerate the paymaster signature close to submission time.

3. **Wrong paymasterAndData encoding.** v0.7 packs paymaster data differently than v0.6. The format is: `paymaster address (20 bytes) || paymasterVerificationGasLimit (16 bytes) || paymasterPostOpGasLimit (16 bytes) || paymasterData`. Use SDK helpers instead of manual encoding.

4. **ERC-20 paymaster: insufficient token approval.** The smart account must approve the paymaster to spend the payment token before sending the UserOp.

## Nonce Too Low

**Symptoms:**
- `AA25: invalid account nonce`
- UserOp accepted but not included

**Solutions:**

1. **Concurrent UserOps on the same nonce key.** ERC-4337 uses 2D nonces (192-bit key + 64-bit sequence). Use different nonce keys for parallel submissions:
   ```typescript
   // Key 0 for normal operations, key 1 for another parallel stream
   const nonce = await publicClient.readContract({
     address: entryPoint07Address,
     abi: parseAbi(["function getNonce(address,uint192) view returns (uint256)"]),
     functionName: "getNonce",
     args: [accountAddress, 1n], // key = 1
   });
   ```

2. **UserOp already included.** The previous UserOp was mined between your nonce fetch and submission. Re-fetch the nonce and resubmit.

## Gas Estimation Failed

**Symptoms:**
- `eth_estimateUserOperationGas` returns an error
- Bundler rejects with "gas estimation failed"

**Solutions:**

1. **The underlying call would revert.** Gas estimation simulates the full UserOp. If the inner `callData` execution reverts, estimation fails. Test the call independently:
   ```typescript
   await publicClient.simulateContract({
     address: targetContract,
     abi: targetAbi,
     functionName: "targetFunction",
     args: [...],
     account: smartAccountAddress,
   });
   ```

2. **Paymaster rejects during estimation.** Some paymasters validate the UserOp during gas estimation. Ensure paymaster data is included in the estimation request.

3. **L2 preVerificationGas too low.** On L2s (Arbitrum, Optimism, Base), `preVerificationGas` must account for L1 data posting costs. Always use the bundler's gas estimation rather than manual calculation.

## Bundler Rejected UserOp

**Symptoms:**
- `-32502: opcode not allowed` or `-32505: stake too low`
- UserOp passes local simulation but bundler rejects it

**Solutions:**

1. **Banned opcodes in validation.** The ERC-4337 spec restricts opcodes during validation (no `TIMESTAMP`, `BLOCKHASH`, `GASPRICE`, etc. relative to other accounts' storage). Move any logic using these opcodes to the execution phase.

2. **Unstaked paymaster or factory.** Bundlers require paymasters and factories to stake ETH in the EntryPoint (at least 1 ETH with 1-day unstake delay for most bundlers). Stake via `entryPoint.addStake{value: stakeAmount}(unstakeDelaySec)`.

3. **Storage access violation.** During validation, the account can only access its own storage and the storage associated with its address. Accessing other accounts' storage is banned.

## Session Key Expired or Over-Limit

**Symptoms:**
- Session key UserOps fail at validation
- "permission denied" or "session expired" from validator module

**Solutions:**

1. **Time window expired.** Session keys have `validAfter` and `validUntil` constraints. Create a new session key with an extended time window.

2. **Usage count exhausted.** If the session key has a max usage count policy, the count has been reached. Create a new session key.

3. **Contract or function not whitelisted.** The session key can only call contracts and functions specified in its policy. Verify the target contract and function selector are included in the permission set.

## Debug Checklist

- [ ] EntryPoint version matches SDK configuration (v0.6 vs v0.7)
- [ ] Account is deployed or initCode is provided
- [ ] Nonce fetched from EntryPoint (not from account directly)
- [ ] Signature generated against correct userOpHash (includes chainId + EntryPoint)
- [ ] Paymaster has sufficient EntryPoint deposit
- [ ] paymasterAndData format matches EntryPoint version
- [ ] Gas limits estimated by bundler (not hardcoded)
- [ ] No banned opcodes in validation phase
- [ ] Token approval granted to paymaster (for ERC-20 paymasters)
- [ ] Transaction simulated successfully before UserOp submission
