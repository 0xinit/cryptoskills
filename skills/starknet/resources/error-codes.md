# StarkNet Error Codes

## Transaction Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `TRANSACTION_REVERTED` | Contract execution failed | Check revert reason in receipt. Usually a failed `assert` in Cairo. |
| `INSUFFICIENT_MAX_FEE` | Max fee too low for execution | Increase max fee. Use `estimate_fee` before submitting. |
| `INSUFFICIENT_ACCOUNT_BALANCE` | Account can't cover tx fee | Fund account with STRK or ETH. |
| `INVALID_TRANSACTION_NONCE` | Nonce mismatch | Fetch current nonce with `get_nonce`. Pending txs increment nonce. |
| `DUPLICATE_TX` | Same transaction already submitted | Transaction with identical hash already in mempool. |
| `VALIDATION_FAILURE` | Account's `__validate__` rejected tx | Signature is wrong, or account validation logic failed. |
| `ACTUAL_FEE_EXCEEDS_MAX_FEE` | Execution cost exceeded declared max | Set higher max fee or optimize contract. |

## Contract Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `CONTRACT_NOT_FOUND` | Address has no deployed contract | Wrong address, or contract not yet deployed. Check explorer. |
| `CLASS_HASH_NOT_FOUND` | Class hash not declared | Declare the contract class first with `starkli declare` or `sncast declare`. |
| `CLASS_ALREADY_DECLARED` | Class hash already exists on-chain | Not an error — use the existing class hash for deployment. |
| `ENTRY_POINT_NOT_FOUND` | Function selector doesn't exist on contract | Wrong function name or calling wrong contract. Verify ABI. |
| `ENTRY_POINT_FAILED` | Function execution panicked | An `assert` or arithmetic overflow occurred in the called function. |

## Sierra / Compilation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Sierra gas exceeded` | Contract execution ran out of Sierra gas | Optimize contract logic. Reduce loop iterations or storage reads. |
| `Failed to compile Sierra to CASM` | Invalid Sierra bytecode | Likely a Scarb/compiler version mismatch. Update Scarb. |
| `Contract class size is too large` | Compiled class exceeds size limit | Split into multiple contracts or libraries. |

## Scarb Build Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Unexpected token` | Cairo syntax error | Check Cairo 2.x syntax. Common: missing semicolons, wrong attribute format. |
| `Trait has no implementation` | Missing impl block | Ensure all interface methods are implemented in `impl` block. |
| `Variable not mutable` | Writing to non-`ref` parameter | Use `ref self: ContractState` for state-mutating functions. |
| `Type mismatch` | Wrong type passed | Cairo is strictly typed. Convert explicitly: `.into()`, `.try_into().unwrap()`. |
| `Unresolved import` | Missing dependency | Add the crate to `Scarb.toml` dependencies. |
| `Plugin diagnostic: Contract storage must be a struct` | Storage not defined as struct | Ensure `#[storage] struct Storage { ... }` exists in contract module. |

## starkli Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Account not found on network` | Account address not deployed | Deploy the account first or check the correct network. |
| `Invalid JSON` | Malformed contract artifact | Rebuild with `scarb build`. Ensure using `.contract_class.json`, not `.compiled_contract_class.json`. |
| `Keystore file not found` | Wrong keystore path | Verify `STARKNET_KEYSTORE` path or `--keystore` flag. |
| `RPC error: method not found` | RPC version mismatch | Use correct RPC API version (v0_7). |

## snforge Test Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `panicked with 'error message'` | Contract assert failed in test | Expected behavior for `#[should_panic]` tests. Otherwise, fix the assert condition. |
| `Contract not declared` | Missing `declare("ContractName")` | Call `declare("ContractName")` before deploying in test. Name must match the module name. |
| `Deploy failed` | Constructor calldata mismatch | Ensure calldata matches constructor parameter types and order. |
| `Blockchain storage access error` | Cheatcode state conflict | Reset cheatcodes between tests with `stop_cheat_*` functions. |

## starknet.js Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `LibraryError: RPC: starknet_*` | RPC method failed | Check network connectivity and RPC URL. Verify the endpoint version. |
| `Could not estimate fee` | Transaction would revert | Contract call would fail. Debug the contract logic. |
| `Signature verification failed` | Wrong private key for account | Verify the private key matches the account's public key. |
| `TypeError: Cannot read property` | ABI mismatch | Ensure the ABI matches the deployed contract version. |
