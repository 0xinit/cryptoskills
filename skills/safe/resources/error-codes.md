# Safe Error Codes

Error codes emitted by Safe smart contracts and the Transaction Service. The `GS` prefix stands for "Gnosis Safe" (pre-rebrand naming persists in the contract code).

## Contract Errors (GS prefix)

### Execution Errors

| Code | Message | Cause | Fix |
|------|---------|-------|-----|
| `GS000` | Could not finish initialization | `setup()` failed during proxy deployment | Check constructor params: owners must be non-zero, threshold must be >= 1 and <= owner count |
| `GS001` | Internal transaction failed | The inner call (target contract) reverted | The Safe executed correctly but the target reverted. Debug the target call data separately. |
| `GS002` | Could not pay gas costs | Safe cannot refund the relayer for gas | Ensure the Safe has enough ETH (or payment token) to cover `gasPrice * safeTxGas` |

### Signature Errors

| Code | Message | Cause | Fix |
|------|---------|-------|-----|
| `GS013` | Safe transaction failed | `execTransaction` reverted, typically due to invalid signatures | Verify: correct nonce, signatures sorted by signer address (ascending), signer count >= threshold |
| `GS020` | Signatures data too short | Signature bytes are shorter than expected for the number of signers | Ensure all required owners have signed. Signature data must be exactly `65 * n` bytes for `n` ECDSA signatures. |
| `GS021` | Invalid contract signature location | Contract signature (EIP-1271) offset is out of bounds | Check the dynamic part of the signature data points to a valid contract signature blob |
| `GS022` | Invalid contract signature provided | EIP-1271 `isValidSignature` returned invalid magic value | The contract signer rejected the signature. Verify the hash and signature format match the contract's expectations. |
| `GS023` | Invalid owner provided | Recovered signer from ECDSA signature is not a current owner | Check the signing key matches an address in `getOwners()` |
| `GS024` | Signature not provided by owner | A required owner's signature is missing | Collect signatures from all required owners before executing |
| `GS025` | Hash not approved | `approvedHashes[owner][hash]` is not set | When using on-chain approvals, each owner must call `approveHash(safeTxHash)` first |
| `GS026` | Invalid owner address | Zero address or sentinel value used as owner | Owner addresses must be non-zero and not the sentinel (`0x1`) |

### Module Errors

| Code | Message | Cause | Fix |
|------|---------|-------|-----|
| `GS100` | Module not authorized | Calling `execTransactionFromModule` from a non-enabled module | Enable the module first via `enableModule()` as a Safe transaction |
| `GS101` | Module already exists | Attempting to enable a module that is already enabled | Check `isModuleEnabled()` before calling `enableModule` |
| `GS102` | Invalid module address | Zero address or sentinel passed to module operations | Use a valid deployed contract address |
| `GS103` | Invalid prev module | Incorrect previous module in the linked list during removal | The Safe stores modules in a linked list. Use `getModules()` to get the correct ordering. |

### Guard Errors

| Code | Message | Cause | Fix |
|------|---------|-------|-----|
| `GS200` | Guard does not implement IERC165 | Guard contract missing ERC-165 `supportsInterface` | Guard must implement `IERC165` and return true for the guard interface ID |
| `GS201` | Transaction blocked by guard | `checkTransaction` reverted | The guard's policy rejected this transaction. Review the guard's rules. |
| `GS202` | Post-execution check failed | `checkAfterExecution` reverted | The guard detected an invalid state after execution. Review guard logic. |

### Owner Management Errors

| Code | Message | Cause | Fix |
|------|---------|-------|-----|
| `GS300` | Owner already exists | Adding an address that is already an owner | Check `getOwners()` before adding |
| `GS301` | Invalid owner address for removal | Trying to remove an address that is not an owner | Verify the address is in the current owner list |
| `GS302` | Threshold too high | New threshold exceeds owner count after removal | Set a threshold <= new owner count |

## Transaction Service API Errors

| HTTP Status | Error | Cause | Fix |
|-------------|-------|-------|-----|
| `400` | `Nonce too high` | Proposed nonce skips a pending transaction | Get next nonce from the Transaction Service, not on-chain, if there are queued txs |
| `400` | `Sender is not an owner` | Proposer address is not in the Safe's owner list | Verify the signer corresponds to a current owner |
| `400` | `Invalid safeTxHash` | Hash does not match the transaction data | Recompute the hash using `getTransactionHash()` from Protocol Kit |
| `422` | `Safe not found` | Safe address not indexed by the Transaction Service | Wait for indexing (new Safes may take a few minutes) or verify the address |
| `422` | `Invalid signature` | Signature verification failed server-side | Ensure the signature was created with the correct signer key and transaction data |
| `429` | Rate limited | Too many requests | Back off and retry. Read endpoints: ~100 req/min. Write endpoints: ~10-20 req/min. |
