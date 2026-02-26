# EigenLayer Troubleshooting Guide

Common issues and solutions when integrating EigenLayer restaking.

## Deposit Reverts with No Clear Error

**Symptoms:**
- `depositIntoStrategy` reverts with empty data or generic "execution reverted"
- Transaction simulation fails without a readable revert reason

**Solutions:**

1. **Strategy deposit cap reached.** Each strategy has a maximum TVL. Check before depositing:
   ```typescript
   const strategyAbi = parseAbi([
     "function getTVLLimits() external view returns (uint256 maxPerDeposit, uint256 maxTotalDeposits)",
     "function totalShares() external view returns (uint256)",
   ]);

   const [limits, totalShares] = await Promise.all([
     publicClient.readContract({
       address: strategyAddress,
       abi: strategyAbi,
       functionName: "getTVLLimits",
     }),
     publicClient.readContract({
       address: strategyAddress,
       abi: strategyAbi,
       functionName: "totalShares",
     }),
   ]);
   ```

2. **Strategy not whitelisted for deposits.** The strategy may have been removed from the whitelist:
   ```typescript
   const isWhitelisted = await publicClient.readContract({
     address: STRATEGY_MANAGER,
     abi: parseAbi([
       "function strategyIsWhitelistedForDeposit(address strategy) external view returns (bool)",
     ]),
     functionName: "strategyIsWhitelistedForDeposit",
     args: [strategyAddress],
   });
   ```

3. **Deposits are paused.** EigenLayer contracts have granular pause functionality:
   ```typescript
   const isPaused = await publicClient.readContract({
     address: STRATEGY_MANAGER,
     abi: parseAbi(["function paused(uint8 index) external view returns (bool)"]),
     functionName: "paused",
     args: [0], // 0 = deposits pause index
   });
   ```

4. **Insufficient token approval.** The StrategyManager needs approval to spend your LST. Approve the StrategyManager proxy address (`0x858646372CC42E1A627fcE94aa7A7033e7CF075A`), not the strategy contract.

5. **stETH rounding.** If depositing stETH, the rebasing math can cause the actual transferred amount to differ by 1-2 wei. Approve slightly more than the intended deposit.

## Delegation Fails

**Symptoms:**
- `delegateTo` reverts
- "staker is already actively delegated" error

**Solutions:**

1. **Already delegated.** Check current delegation status:
   ```typescript
   const [isDelegated, delegatedTo] = await Promise.all([
     publicClient.readContract({
       address: DELEGATION_MANAGER,
       abi: parseAbi(["function isDelegated(address) view returns (bool)"]),
       functionName: "isDelegated",
       args: [stakerAddress],
     }),
     publicClient.readContract({
       address: DELEGATION_MANAGER,
       abi: parseAbi(["function delegatedTo(address) view returns (address)"]),
       functionName: "delegatedTo",
       args: [stakerAddress],
     }),
   ]);
   ```

2. **Operator not registered.** Verify the target is a registered operator:
   ```typescript
   const isOperator = await publicClient.readContract({
     address: DELEGATION_MANAGER,
     abi: parseAbi(["function isOperator(address) view returns (bool)"]),
     functionName: "isOperator",
     args: [operatorAddress],
   });
   ```

3. **Delegation approver required.** Some operators set a `delegationApprover`. If non-zero, you need a valid EIP-712 signature from the approver:
   ```typescript
   const details = await publicClient.readContract({
     address: DELEGATION_MANAGER,
     abi: parseAbi([
       "function operatorDetails(address) view returns ((address earningsReceiver, address delegationApprover, uint32 stakerOptOutWindowBlocks))",
     ]),
     functionName: "operatorDetails",
     args: [operatorAddress],
   });

   if (details.delegationApprover !== "0x0000000000000000000000000000000000000000") {
     // Need approval signature from delegationApprover
   }
   ```

4. **Signature expired.** The `approverSignatureAndExpiry.expiry` must be in the future. Generate fresh signatures close to submission time.

## Withdrawal Completion Fails

**Symptoms:**
- `completeQueuedWithdrawals` reverts
- "withdrawal not pending" or "minWithdrawalDelayBlocks period has not yet passed"

**Solutions:**

1. **Escrow period not elapsed.** Check how many blocks remain:
   ```typescript
   const minDelay = await publicClient.readContract({
     address: DELEGATION_MANAGER,
     abi: parseAbi(["function minWithdrawalDelayBlocks() view returns (uint256)"]),
     functionName: "minWithdrawalDelayBlocks",
   });

   const currentBlock = await publicClient.getBlockNumber();
   const blocksRemaining = (BigInt(startBlock) + minDelay) - currentBlock;
   if (blocksRemaining > 0n) {
     console.log(`Wait ${blocksRemaining} more blocks`);
   }
   ```

2. **Withdrawal struct mismatch.** The `Withdrawal` struct passed to `completeQueuedWithdrawals` must EXACTLY match the original queued withdrawal, including `staker`, `delegatedTo`, `withdrawer`, `nonce`, `startBlock`, `strategies`, and `shares`. Any mismatch causes the withdrawal root hash to differ, resulting in "not pending."

3. **Already completed.** A withdrawal can only be completed once. Verify it has not already been claimed.

4. **Wrong `middlewareTimesIndex`.** For most cases, pass `0`. This parameter relates to legacy slashing middleware and is typically unused.

5. **Token array mismatch.** The `tokens` array must correspond 1:1 with the `strategies` array in the withdrawal struct. Each token must be the underlying token of the corresponding strategy.

## EigenPod Issues

**Symptoms:**
- `verifyWithdrawalCredentials` reverts with "proof is not valid"
- Pod creation succeeds but validator is not recognized

**Solutions:**

1. **Stale beacon state proofs.** Proofs must reference a recent beacon state root that the EigenPod contract can verify. Regenerate proofs using the latest beacon block:
   ```bash
   # Use the eigenpod-proofs-generation CLI
   eigenpod-proofs-generation \
     --beacon-node-url $BEACON_URL \
     --validator-index $VALIDATOR_INDEX \
     --pod-address $EIGENPOD_ADDRESS
   ```

2. **Withdrawal credentials mismatch.** Your validator's withdrawal credentials must be set to your EigenPod address (0x01 prefix + pod address). Verify:
   ```bash
   # Check validator withdrawal credentials on beacon chain
   curl -s "$BEACON_URL/eth/v1/beacon/states/head/validators/$VALIDATOR_INDEX" | jq '.data.validator.withdrawal_credentials'
   ```

3. **Validator already verified.** Each validator can only be verified once per EigenPod. Check if already verified before attempting.

4. **BLS-to-execution-layer change not processed.** If you changed withdrawal credentials from 0x00 (BLS) to 0x01 (execution layer), wait for the change to be included in a beacon block before verifying.

## Rewards Not Appearing

**Symptoms:**
- Expected rewards are not claimable
- `processClaim` reverts

**Solutions:**

1. **Reward root not yet activated.** Reward distribution roots have an activation delay. Check the `activatedAt` timestamp of the latest root.

2. **Invalid Merkle proof.** Claim data (proofs, indices, leaf values) must match the specific reward root. Re-fetch claim data from the EigenLayer API or app.

3. **Already claimed.** Check `cumulativeClaimed(earner, token)` -- if it equals or exceeds the cumulative earnings in the claim, there is nothing new to claim.

4. **Not the correct earner.** Rewards accrue to the address that was delegated at the time the AVS submitted the reward. If you recently delegated, your rewards may only appear in future distribution roots.

## Operator Registration to AVS Fails

**Symptoms:**
- `registerOperatorToAVS` reverts on AVSDirectory

**Solutions:**

1. **Not registered as EigenLayer operator.** Must call `DelegationManager.registerAsOperator()` before registering to any AVS.

2. **Salt already spent.** Each (operator, salt) pair can only be used once. Generate a unique salt for each registration attempt.

3. **Signature expired.** The operator's registration signature has a timestamp expiry. Ensure `expiry > block.timestamp`.

4. **Signature verification failed.** The signature must be over the exact EIP-712 digest from `calculateOperatorAVSRegistrationDigestHash`. Verify the signer matches the operator address.

## Gas Estimation Failures

**Symptoms:**
- Gas estimation returns unreasonably high values
- "Gas estimation failed" in wallet

**Solutions:**

1. **The underlying transaction would revert.** Gas estimation simulates the full transaction. If it fails, fix the root cause first (check the sections above).

2. **Typical gas costs:**
   - `depositIntoStrategy`: ~150,000-200,000 gas
   - `delegateTo`: ~100,000-150,000 gas
   - `queueWithdrawals`: ~150,000-200,000 gas per strategy
   - `completeQueuedWithdrawals`: ~200,000-300,000 gas per strategy
   - `registerAsOperator`: ~150,000 gas
   - `createPod`: ~300,000-400,000 gas (deploys a new contract)

3. **Add a gas buffer for multi-strategy operations:**
   ```typescript
   const estimatedGas = await publicClient.estimateContractGas({ ... });
   const gasLimit = (estimatedGas * 120n) / 100n; // 20% buffer
   ```

## Debug Checklist

- [ ] Using proxy addresses, not implementation addresses
- [ ] Token approval granted to StrategyManager (not strategy contract)
- [ ] Strategy is whitelisted and not at capacity
- [ ] Operator is registered in DelegationManager
- [ ] Not already delegated (or undelegated first)
- [ ] Withdrawal escrow period has elapsed before completing
- [ ] Withdrawal struct matches exactly (all fields, including nonce)
- [ ] Contract is not paused for the target function
- [ ] Transaction simulated successfully before broadcasting
- [ ] EigenPod proofs generated from recent beacon state
