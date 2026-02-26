# EigenLayer Error Codes and Revert Reasons

Common revert reasons when interacting with EigenLayer contracts. These are custom errors and require string matching from the revert data.

## StrategyManager

| Error | Cause | Fix |
|-------|-------|-----|
| `StrategyManager.depositIntoStrategyOnBehalfOf: strategy not whitelisted` | Strategy address is not approved by governance | Verify you are using a valid strategy address from the official deployment |
| `StrategyManager.depositIntoStrategy: deposit would exceed MAX_TOTAL_DEPOSITS` | Strategy's total deposit cap reached | Wait for cap increase or choose a different strategy. Check `getTVLLimits()` |
| `StrategyManager.onlyStrategiesWhitelistedForDeposit` | Deposits are paused or strategy removed from whitelist | Check `strategyIsWhitelistedForDeposit(strategy)` before depositing |
| `StrategyManager.onlyDelegationManager` | Function called by unauthorized address | These functions can only be called by the DelegationManager contract |
| `StrategyBase.deposit: newShares cannot be zero` | Deposit amount too small to mint any shares | Increase deposit amount |
| `StrategyBase.deposit: deposit paused` | Strategy deposits are paused | Wait for unpausing or check `paused(0)` on the strategy |

## DelegationManager

| Error | Cause | Fix |
|-------|-------|-----|
| `DelegationManager.delegateTo: staker is already actively delegated` | Staker already delegated to an operator | Call `undelegate()` first, wait for escrow, then redelegate |
| `DelegationManager.delegateTo: operator is not registered in EigenLayer` | Target address has not called `registerAsOperator()` | Verify the operator address is registered via `isOperator()` |
| `DelegationManager._delegate: approver signature expired` | The delegation approver's signature has expired | Generate a new signature with a future expiry |
| `DelegationManager._delegate: approverSalt already spent` | The salt in the approver signature was already used | Use a fresh salt value |
| `DelegationManager.undelegate: staker is not delegated` | Staker is not currently delegated | No action needed -- staker is already undelegated |
| `DelegationManager.undelegate: operators cannot be undelegated` | Operators cannot undelegate themselves | Operators are permanently self-delegated. Deregister instead |
| `DelegationManager.registerAsOperator: operator has already registered` | Address already registered as operator | No action needed -- already registered |
| `DelegationManager.queueWithdrawals: shares cannot be 0` | Zero shares specified in withdrawal | Specify a non-zero share amount |
| `DelegationManager.completeQueuedWithdrawal: withdrawal not pending` | Withdrawal root does not match any pending withdrawal | Verify the withdrawal struct matches exactly (including nonce and startBlock) |
| `DelegationManager.completeQueuedWithdrawal: minWithdrawalDelayBlocks period has not yet passed` | Escrow period not yet elapsed | Wait for `minWithdrawalDelayBlocks` to pass since `startBlock` |
| `DelegationManager.completeQueuedWithdrawal: action is not in queue` | Withdrawal already completed or never queued | Check if already completed, or verify withdrawal root |

## EigenPodManager

| Error | Cause | Fix |
|-------|-------|-----|
| `EigenPodManager.createPod: Sender already has a pod` | Address already has an EigenPod deployed | Use `getPod(address)` to get your existing pod address |
| `EigenPod.verifyWithdrawalCredentials: validator already verified` | Validator credentials already verified for this pod | No action needed |
| `EigenPod.verifyWithdrawalCredentials: proof is not valid` | Beacon chain state proof is invalid or stale | Regenerate proofs using the latest beacon state. Use `eigenpod-proofs-generation` tool |
| `EigenPod.verifyWithdrawalCredentials: withdrawal credentials do not match` | Validator's withdrawal credentials do not point to this EigenPod | Update validator withdrawal credentials to the EigenPod address |

## AVSDirectory

| Error | Cause | Fix |
|-------|-------|-----|
| `AVSDirectory.registerOperatorToAVS: operator not registered as operator in EigenLayer` | Operator has not registered in DelegationManager | Register as operator first via `DelegationManager.registerAsOperator()` |
| `AVSDirectory.registerOperatorToAVS: salt already spent` | The registration salt was already used | Generate a new unique salt |
| `AVSDirectory.registerOperatorToAVS: operator signature expired` | Operator's registration signature expired | Generate a new signature with a future expiry timestamp |
| `AVSDirectory.registerOperatorToAVS: operator already registered` | Operator is already registered to this AVS | No action needed |

## RewardsCoordinator

| Error | Cause | Fix |
|-------|-------|-----|
| `RewardsCoordinator.processClaim: invalid token claim proof` | Merkle proof does not match the submitted root | Verify proof data matches the current distribution root. Re-fetch claim data from EigenLayer API |
| `RewardsCoordinator.processClaim: root not activated` | Reward root has not been activated yet | Wait for the root activation delay to pass |
| `RewardsCoordinator.processClaim: cumulativeEarnings must be gt cumulativeClaimed` | Already claimed up to or past this amount | Nothing new to claim for this token |

## AllocationManager (Slashing)

| Error | Cause | Fix |
|-------|-------|-----|
| `AllocationManager.slashOperator: operator not allocated to operator set` | Operator has no allocation to the slashing AVS's operator set | Operator must allocate magnitude to the AVS's operator set first |
| `AllocationManager.modifyAllocations: allocation delay not yet passed` | Trying to modify allocations before the allocation delay | Wait for the allocation configuration delay to elapse |

## General / Pausing

| Error | Cause | Fix |
|-------|-------|-----|
| `Pausable: index is paused` | The specific function index is paused by governance | Wait for unpausing. Check `paused(index)` for the relevant function's pause index |
| `Initializable: contract is already initialized` | Trying to initialize an already-initialized proxy | No action needed -- proxy is already initialized |
| `Ownable: caller is not the owner` | Non-owner calling owner-restricted function | Only the contract owner (governance multisig) can call this function |

## Debugging Tips

1. **Simulate before sending:** Always use `simulateContract` to get the exact revert reason before broadcasting.
2. **Decode custom errors:** EigenLayer uses custom errors. Decode revert data with the contract ABI.
3. **Check pause state:** Many EigenLayer functions can be individually paused. Call `paused(index)` to check.
4. **Trace failed transactions:**
   ```bash
   cast run <tx_hash> --rpc-url $RPC_URL
   ```
5. **Verify proxy state:** If a function behaves unexpectedly, the implementation may have been upgraded. Check the implementation address via the EIP-1967 storage slot.
