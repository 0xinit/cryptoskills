# Sei Error Codes

## Deployment Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid opcode: PUSH0` | Solidity compiler targeting `shanghai` or later | Set `evmVersion: "paris"` in foundry.toml or hardhat.config.ts |
| `execution reverted` (no reason) | Constructor reverted or ran out of gas | Debug with `forge test --fork-url $SEI_RPC_URL -vvvv` or increase gas limit |
| `chain id mismatch` | Wrong chain ID in wallet or config | Mainnet = 1329, Testnet = 1328, Devnet = 713715 |
| `nonce too low` | Previous transaction still pending or nonce desync | Wait for pending transactions or reset nonce |
| `insufficient funds for gas * price + value` | Account does not have enough SEI | Fund the deployer account with SEI for gas |
| `contract creation code storage out of gas` | Contract bytecode too large for gas limit | Increase gas limit or reduce contract size (24.576 KB max) |

## Precompile Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `precompile error` (generic) | Calling precompile with `DELEGATECALL` or `CALLCODE` | Use `CALL` for all precompile interactions |
| `precompile: invalid input` | Malformed arguments to precompile function | Check ABI encoding matches the precompile interface exactly |
| `addr not found` (Address precompile) | Querying an address that has never transacted on Sei | The address must have at least one transaction to have a linked Cosmos address |
| `delegation not found` (Staking) | Querying delegation for a validator the user has not staked with | Verify the validator address is correct and the user has an active delegation |
| `proposal not found` (Governance) | Voting on a non-existent or expired proposal | Check the proposal ID exists and is in voting period |
| `ibc transfer failed` (IBC) | Invalid channel, bad timeout, or insufficient balance | Verify the IBC channel is active, timeout is in the future (nanoseconds), and sender has sufficient balance |

## Pointer Contract Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `pointer not found` | No pointer registered for the given token | Register a pointer via the Pointer precompile or Sei CLI |
| `pointer already exists` | Attempting to register a duplicate pointer | Query existing pointer with `getPointer()` first |
| `unauthorized` | Calling pointer registration without required permissions | Some pointer registrations may require governance or admin access |
| `ERC20: transfer amount exceeds balance` on pointer | Underlying CW20 balance is insufficient | The pointer mirrors CW20 state -- the user needs tokens in the CW20 contract |

## Wasm Precompile Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `query wasm contract failed` | Invalid CosmWasm contract address or malformed query JSON | Verify the contract address is a valid sei1... address and the query JSON matches the contract's schema |
| `execute wasm contract failed` | CosmWasm execution reverted or insufficient funds attached | Check the execute message matches the contract's expected format and attach required coins |
| `codeid not found` | Instantiating with a non-existent code ID | Verify the code ID exists on the current network |
| `json: cannot unmarshal` | Malformed JSON in execute/query message | Validate JSON format before sending to precompile |

## Transaction Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `transaction underpriced` | Gas price below network minimum | Let the RPC node estimate gas or increase `maxFeePerGas` |
| `replacement transaction underpriced` | Sending same nonce with insufficient gas price bump | Increase gas price by at least 10% over the pending transaction |
| `max fee per gas less than block base fee` | `maxFeePerGas` set below current base fee | Query current gas price with `eth_gasPrice` and set `maxFeePerGas` accordingly |
| `intrinsic gas too low` | Gas limit below the minimum (21000 for transfers) | Increase gas limit to at least 21000 for simple transfers, or estimate properly |
| `out of gas` | Execution consumed more gas than the limit | Increase gas limit or optimize contract code |

## Verification Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `unable to verify` | Wrong verifier URL or API key | Use `https://seitrace.com/api` as the verifier URL |
| `compiler version mismatch` | Verification compiler does not match deployment | Pass the exact `--compiler-version` used during compilation |
| `constructor arguments mismatch` | Incorrect encoding of constructor args | Use `cast abi-encode` to generate the correct ABI-encoded constructor arguments |
| `bytecode mismatch` | Optimizer settings differ between build and verification | Ensure `runs`, `evmVersion`, and other optimizer settings match exactly |

## Bridge / IBC Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `channel not found` | IBC channel does not exist or is closed | Verify the channel is open on both source and destination chains |
| `timeout` | IBC packet timed out before relay | Increase timeout (use nanoseconds, not seconds). A safe default is 10 minutes: `(block.timestamp + 600) * 1_000_000_000` |
| `acknowledgement error` | Destination chain rejected the IBC packet | Check the error in the acknowledgement data -- often due to invalid receiver address or denom |
| `insufficient funds` | Sender balance too low for the IBC transfer amount | Ensure the sender holds enough of the specified denom |

## Common Mistakes

| Mistake | Why It Fails | Correct Approach |
|---------|--------------|------------------|
| Using `tx.origin` for auth | Can be exploited via phishing contracts | Always use `msg.sender` |
| Using `number` for token amounts (TypeScript) | Loses precision above 2^53 | Use `bigint` for all amounts |
| Compiling with `shanghai` EVM target | Sei does not support PUSH0 | Set `evmVersion: "paris"` |
| Calling precompile via `DELEGATECALL` | Precompiles only support `CALL` | Use direct `CALL` or interface calls |
| Using native DEX module | Deprecated in Sei V2 | Use EVM DEXes (DragonSwap, etc.) |
| Assuming 18 decimals for Cosmos `usei` | Cosmos side uses 6 decimals | Use 18 decimals in EVM, 6 in Cosmos; the chain converts automatically |
