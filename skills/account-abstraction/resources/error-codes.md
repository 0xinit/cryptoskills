# Account Abstraction Error Codes

Common errors from EntryPoint, bundlers, and paymasters when working with ERC-4337 UserOperations.

> **Last verified:** February 2026

## EntryPoint Validation Errors (AA*)

| Code | Error | Cause | Fix |
|------|-------|-------|-----|
| AA10 | `sender already constructed` | `initCode` provided but account already exists | Remove `initCode` from UserOp (account is already deployed) |
| AA13 | `initCode failed or OOG` | Factory deployment failed or ran out of gas | Check factory address and calldata. Increase `verificationGasLimit` |
| AA14 | `initCode must return sender` | Factory did not deploy to the expected `sender` address | Ensure factory's `createAccount` returns the correct address |
| AA20 | `account not deployed` | No `initCode` and no contract at `sender` address | Include `initCode` for first-time account creation |
| AA21 | `didn't pay prefund` | Account did not pay `missingAccountFunds` to EntryPoint | Ensure account has ETH or deposits in EntryPoint |
| AA22 | `expired or not due` | UserOp time-range validation failed | Check `validAfter` and `validUntil` in validation return |
| AA23 | `reverted (or OOG)` | `validateUserOp` reverted | Debug account validation logic. Check signature format |
| AA24 | `signature error` | Signature verification failed in account | Verify signer matches account owner. Check signature encoding |
| AA25 | `invalid account nonce` | Nonce does not match expected value | Fetch current nonce from EntryPoint. Check nonce key space |
| AA30 | `paymaster not deployed` | No contract at paymaster address | Verify paymaster address is correct and deployed |
| AA31 | `paymaster deposit too low` | Paymaster's EntryPoint deposit cannot cover gas | Deposit more ETH to EntryPoint for the paymaster |
| AA32 | `paymaster expired or not due` | Paymaster time-range validation failed | Check paymaster's validAfter/validUntil |
| AA33 | `reverted (or OOG)` | `validatePaymasterUserOp` reverted | Debug paymaster validation. Check paymasterData format |
| AA34 | `signature error` | Paymaster signature verification failed | Regenerate paymaster signature with correct data |
| AA40 | `over verificationGasLimit` | Verification phase exceeded gas limit | Increase `verificationGasLimit` |
| AA41 | `too little verificationGas` | Not enough gas for verification | Increase `verificationGasLimit` |

## Bundler RPC Errors

| Code | Error | Cause | Fix |
|------|-------|-------|-----|
| -32500 | `rejected by ep.simulateValidation` | UserOp failed EntryPoint simulation | Check validation errors above |
| -32501 | `rejected by paymaster` | Paymaster rejected the UserOp during simulation | Verify paymasterData and paymaster state |
| -32502 | `opcode not allowed` | UserOp uses banned opcodes in validation | Remove TIMESTAMP, BLOCKHASH, etc. from validation path |
| -32503 | `out of time range` | UserOp is expired or not yet valid | Adjust validAfter/validUntil |
| -32504 | `paymaster throttled` | Bundler rate-limiting this paymaster | Reduce UserOp submission rate or use a different paymaster |
| -32505 | `stake or unstake-delay too low` | Entity (paymaster/factory) has insufficient stake | Increase stake amount and unstake delay on EntryPoint |
| -32506 | `unsupported signature aggregator` | Bundler does not support the aggregator | Use a bundler that supports your aggregator |
| -32507 | `wallet/paymaster signature mismatch` | Signature does not match during simulation | Regenerate signature. Ensure signing over correct userOpHash |
| -32602 | `invalid UserOperation` | Malformed UserOp fields | Check field encoding, especially packed gas fields for v0.7 |

## Paymaster Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `paymaster validation reverted` | Custom validation logic in paymaster failed | Check paymaster-specific data format |
| `paymaster postOp reverted` | postOp callback failed (e.g., token transfer failed) | Ensure account has approved paymaster for sufficient tokens |
| `paymaster deposit too low` | Paymaster's EntryPoint balance is depleted | Top up paymaster deposit via `entryPoint.depositTo(paymaster)` |

## Debugging Tips

1. **Simulate locally first:**
   ```bash
   cast call $ENTRYPOINT "simulateValidation((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes))" $USEROP_TUPLE --rpc-url $RPC_URL
   ```

2. **Check nonce on-chain:**
   ```bash
   cast call $ENTRYPOINT "getNonce(address,uint192)(uint256)" $ACCOUNT $KEY --rpc-url $RPC_URL
   ```

3. **Verify paymaster deposit:**
   ```bash
   cast call $ENTRYPOINT "balanceOf(address)(uint256)" $PAYMASTER --rpc-url $RPC_URL
   ```

4. **Use bundler debug methods:** Pimlico and Alchemy expose `debug_bundler_sendBundleNow` and simulation trace endpoints for development.
