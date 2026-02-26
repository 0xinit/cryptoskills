# Arbitrum Error Codes

## Retryable Ticket Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `NOT_ENOUGH_FUNDS` | `msg.value` on L1 does not cover `l2CallValue + maxSubmissionCost + (gasLimit * maxFeePerGas)` | Increase `msg.value` to cover all three components |
| `RETRYABLE_TICKET_CREATION_FAILED` | Retryable ticket parameters invalid or underfunded | Check `maxSubmissionCost` is sufficient (query via `NodeInterface`) |
| `NO_TICKET_WITH_ID` | Attempting to redeem a ticket that does not exist or has expired | Verify ticket ID and check `getTimeout()` on `ArbRetryableTx` |
| `ALREADY_REDEEMED` | Ticket was already successfully executed | No action needed — the message was delivered |
| `LIFETIME_NOT_EXTENDABLE` | Trying to extend a ticket that has already been redeemed or expired | Cannot recover — create a new retryable ticket |

## Gas Estimation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `GAS_ESTIMATION_FAILED` | `eth_estimateGas` returned incorrect value due to L1 data cost not included | Use `NodeInterface.gasEstimateComponents()` instead of raw `eth_estimateGas` |
| `INSUFFICIENT_FUNDS_FOR_GAS` | Account cannot cover L2 gas + L1 data posting cost | Ensure balance covers both gas components; use `gasEstimateComponents` for accurate estimate |
| `MAX_FEE_PER_GAS_TOO_LOW` | Gas price below sequencer minimum | Increase `maxFeePerGas` or use the L2 gas price from `ArbGasInfo.getPricesInWei()` |

## Bridge Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `TOKEN_NOT_REGISTERED` | Token has no registered gateway on the Gateway Router | Check `getGateway()` returns a non-zero address; register if needed |
| `GATEWAY_MISMATCH` | Calling the wrong gateway for a token | Use `GatewayRouter.getGateway(token)` to find the correct gateway |
| `L1_MSG_NOT_CONFIRMED` | Trying to execute an L2→L1 message before the challenge period ends | Wait for the full 7-day challenge period to elapse |
| `ALREADY_SPENT` | L2→L1 message already executed on L1 | No action needed — the withdrawal was already claimed |
| `PROOF_INVALID` | Invalid Merkle proof for Outbox execution | Fetch a fresh proof from `NodeInterface` or Arbitrum SDK |

## ArbOS Revert Reasons

| Error | Cause | Fix |
|-------|-------|-----|
| `ONLY_ROLLUP_OR_OWNER` | Calling an admin-only precompile function (e.g., `ArbOwner`) | These functions are restricted to the chain owner; cannot be called by regular users |
| `NOT_CALLABLE_FROM_CONTRACT` | Calling `NodeInterface` from a smart contract | `NodeInterface` is a virtual precompile — only callable via `eth_call` or `eth_estimateGas`, not from contracts |
| `BLOCK_NUM_TOO_OLD` | Requesting `arbBlockHash` for a block too far in the past | Only recent L2 block hashes are available (last 256 blocks) |
| `INVALID_NONCE` | Transaction nonce mismatch with sequencer state | Reset nonce or wait for pending transactions to confirm |

## Deployment Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid transaction type` / RPC error | Sending EIP-1559 (type-2) transaction to Arbitrum via Foundry | Add `--legacy` flag to `forge create` or `forge script` |
| `execution reverted` (no reason) | Contract constructor reverted on Arbitrum | Debug locally with `forge test --fork-url $ARBITRUM_RPC_URL -vvvv` |
| `contract size exceeds limit` | Bytecode exceeds 24KB (same as Ethereum EIP-170) | Split contract into libraries or use proxy pattern |

## Verification Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `unable to verify` | Arbiscan API key invalid or rate limited | Check API key at `arbiscan.io/myapikey`; wait and retry |
| `compiler version mismatch` | Verification compiler version differs from deployment | Pass exact `--compiler-version` used during build |
| `constructor arguments mismatch` | Incorrect constructor args encoding | Use `cast abi-encode` to generate the correct encoding |

## Cross-Chain Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `WRONG_SENDER_ALIAS` | L2 contract expected a specific L1 sender but received different aliased address | Verify the alias calculation: `L2 = L1 + 0x1111000000000000000000000000000000001111` |
| `SUBMISSION_COST_TOO_LOW` | `maxSubmissionCost` does not cover the base submission cost | Query current submission cost via `NodeInterface.estimateRetryableTicket()` |
| `CALL_VALUE_REFUND_FAILED` | L2 refund address cannot receive ETH | Ensure refund addresses are EOAs or contracts that accept ETH |
| `TICKET_EXPIRED` | Attempting to redeem or keepalive an expired retryable | Ticket TTL is 7 days; must resend from L1 |

## Sequencer Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `SEQUENCER_OFFLINE` | Sequencer is temporarily unavailable | Retry after a short delay; check status at `status.arbitrum.io` |
| `TRANSACTION_REJECTED` | Sequencer rejected the transaction (bad nonce, low gas) | Check nonce and gas parameters |
| `DELAYED_INBOX_TIMEOUT` | L1 transaction submitted via delayed inbox, not yet processed | Wait for sequencer to include delayed inbox messages (up to 24 hours) |
