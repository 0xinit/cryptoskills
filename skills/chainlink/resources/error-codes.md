# Chainlink Error Codes and Common Failures

## Price Feed Errors

| Error / Symptom | Cause | Fix |
|-----------------|-------|-----|
| `answer <= 0` | Feed returning invalid or negative price (possible for some commodity feeds) | Check `answer > 0` before casting to `uint256`. Revert or fall back to secondary oracle. |
| `updatedAt == 0` | Round has not completed; data is uninitialized | Reject the round. This typically happens on new or deprecated feeds. |
| `block.timestamp - updatedAt > threshold` | Oracle network stopped updating (congestion, feed deprecation, sequencer outage on L2) | Implement per-feed staleness threshold based on heartbeat. ETH/USD mainnet = 3600s, Arbitrum = 86400s. |
| `answeredInRound < roundId` | The answer is carried over from a previous round, not freshly computed | Reject stale round data. This check catches feeds that appear "updated" but are reusing old answers. |
| Wrong price magnitude | Using wrong decimals (e.g., assuming 18 when feed returns 8) | Always call `feed.decimals()` or use known constants per feed. USD pairs = 8, ETH pairs = 18. |
| Price out of expected range | Oracle manipulation, flash crash, or feed misconfiguration | Add sanity bounds (e.g., ETH between $100-$100,000). Revert or pause if breached. |
| `SequencerDown` on L2 | L2 sequencer is offline; oracle updates are paused | Check sequencer uptime feed before reading price data. See SKILL.md for implementation. |

## VRF v2.5 Errors

| Error / Symptom | Cause | Fix |
|-----------------|-------|-----|
| `InsufficientBalance` | Subscription does not have enough LINK (or native) to cover the request | Fund the subscription via the VRF Subscription Manager UI or `fundSubscription` call. |
| `InvalidConsumer` | Calling contract is not registered as a consumer on the subscription | Call `addConsumer(subId, consumerAddress)` on the VRF Coordinator. |
| `GasLimitTooBig` | `callbackGasLimit` exceeds the maximum allowed by the coordinator | Reduce `callbackGasLimit`. Max varies by chain (typically 2.5M gas). |
| `NumWordsTooBig` | Requested more than the max random words per request | Reduce `numWords`. Max is 500 per request. |
| `InvalidKeyHash` | The `keyHash` does not match any registered gas lane on this chain | Use a valid gas lane keyHash for your chain. See `vrf-config.md`. |
| Request pending indefinitely | Subscription underfunded, wrong keyHash, consumer not added, or gas price above lane max | Check all three: subscription balance, consumer registration, and keyHash validity. |
| `fulfillRandomWords` reverts | Callback logic exceeds `callbackGasLimit` or has a bug | Test callback gas usage on a fork. Increase `callbackGasLimit` if needed. Never let the callback revert — the randomness is lost. |
| `InvalidRequestConfirmations` | `requestConfirmations` below minimum (3 on mainnet) | Set to 3 or higher. |

## Automation Errors

| Error / Symptom | Cause | Fix |
|-----------------|-------|-----|
| Upkeep not triggering | `checkUpkeep` returns false, upkeep paused, or underfunded | Debug `checkUpkeep` locally with `cast call`. Check LINK balance. Verify upkeep is not paused. |
| `InsufficientFunds` | Upkeep LINK balance too low to cover execution cost | Add LINK via `addFunds(upkeepId, amount)` on the Registry. |
| `performUpkeep` reverts | State changed between `checkUpkeep` simulation and on-chain execution | Always re-validate conditions inside `performUpkeep`. |
| `checkUpkeep` exceeds gas | View function too computationally expensive for off-chain simulation | Simplify `checkUpkeep`. The simulation has a gas cap (~5M on most chains). |
| `TargetCheckReverted` | `checkUpkeep` reverted instead of returning `(false, "")` | `checkUpkeep` must never revert. Return `(false, "")` for negative cases. |
| Log trigger not firing | Event signature mismatch, or log filter does not match emitted event | Verify the event signature hash in your trigger config matches the actual event. |

## CCIP Errors

| Error / Symptom | Cause | Fix |
|-----------------|-------|-----|
| `InsufficientFeeTokenAmount` | Not enough LINK (or native) approved for the router to cover fees | Call `router.getFee()` first, approve that amount + 10% buffer, then send. |
| `UnsupportedToken` | Token is not supported on the CCIP lane for this source/destination pair | Check [CCIP Supported Tokens](https://docs.chain.link/ccip/supported-networks) for your lane. |
| `MessageTooLarge` | Encoded message exceeds the max size (~256KB) | Reduce payload size. Send data off-chain and pass a reference on-chain. |
| `InvalidChainSelector` | Destination chain selector does not match any supported CCIP lane | Verify chain selector from official docs. See `ccip-sender` example for valid selectors. |
| Message stuck in pending | Destination contract reverts, gas limit too low, or CCIP lane congestion | Check receiver contract logic. Increase `gasLimit` in `extraArgs`. Messages can be manually executed after timeout. |
| `SenderNotAllowlisted` | Receiver contract rejects the source chain/sender combination | Add the source chain + sender to the receiver's allowlist. |
| `ReceiverError` | `_ccipReceive` reverted on the destination chain | Debug the receiver's `_ccipReceive` logic. Failed messages can be retried via manual execution. |
