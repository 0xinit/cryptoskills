# StarkNet Troubleshooting

## Scarb Build Fails

### Version Mismatch

```
error: Package `my_contract` specifies edition `2024_07`, which requires scarb >= 2.9.0
```

**Fix**: Update Scarb to match the edition.

```bash
asdf install scarb 2.9.2
asdf global scarb 2.9.2

# Or reinstall via installer
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh
```

### Missing starknet Dependency

```
error: Unresolved import `starknet::ContractAddress`
```

**Fix**: Add the starknet dependency to `Scarb.toml`.

```toml
[dependencies]
starknet = ">=2.9.0"
```

### Wrong Contract Target

```
error: Contract not found in compilation output
```

**Fix**: Add the starknet-contract target to `Scarb.toml`.

```toml
[[target.starknet-contract]]
sierra = true
```

### Storage Access Imports

```
error: Method `read` not found on type `...`
```

**Fix**: Import the storage access traits.

```cairo
use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
```

For `Map` storage:
```cairo
use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
```

## Declaration Fails

### Class Already Declared

```
Error: Class hash already declared
```

This is not a real error. The class is already on-chain. Use the existing class hash for deployment. starkli returns the hash.

### Sierra Compilation Error on Sequencer

```
Error: Failed to compile Sierra to CASM
```

**Fix**: This usually means a Scarb/Cairo version produced Sierra that the sequencer can't compile. Update Scarb to the latest stable version and rebuild.

```bash
scarb --version  # Check current
snfoundryup      # Update snforge/sncast too
scarb build      # Rebuild
```

## Transaction Stuck in PENDING

StarkNet transactions can remain in PENDING status for minutes during high load.

**Diagnosis**:
```bash
starkli tx-status <TX_HASH> --rpc <RPC_URL>
```

**Common causes**:
1. Low fee — the sequencer deprioritizes low-fee txs
2. Network congestion
3. Sequencer backlog

**Fix**: Wait. If stuck for > 30 minutes, the tx may have been dropped. Resubmit with a higher max fee.

```typescript
// In starknet.js, increase fee
const tx = await account.execute(calls, undefined, {
  maxFee: estimatedFee * 2n, // 2x safety margin
});
```

## Account Deployment Fails

### Insufficient Funds

The account address must be funded BEFORE deploying the account contract.

```
Error: INSUFFICIENT_ACCOUNT_BALANCE
```

**Fix**:
1. Compute the account address (deterministic from class hash + salt + constructor args)
2. Send STRK or ETH to that address from another funded account or faucet
3. Then call `deployAccount`

### Wrong Class Hash

```
Error: CLASS_HASH_NOT_FOUND
```

**Fix**: Verify the account class hash is declared on the target network. Popular account class hashes differ between mainnet and testnet as implementations are updated.

## starknet.js Connection Errors

### RPC Version Mismatch

```
Error: RPC method not found
```

**Fix**: Ensure the RPC URL includes the correct version path. StarkNet RPC has versioned endpoints.

```typescript
// Correct — includes version
const provider = new RpcProvider({
  nodeUrl: "https://starknet-mainnet.public.blastapi.io/rpc/v0_7",
});

// Wrong — missing version
const provider = new RpcProvider({
  nodeUrl: "https://starknet-mainnet.public.blastapi.io",
});
```

### CORS Errors in Browser

```
Access to fetch has been blocked by CORS policy
```

**Fix**: Use an RPC provider that supports CORS headers, or proxy through your backend. Public Blast API endpoints support CORS. Self-hosted nodes may need CORS configuration.

### Timeout on waitForTransaction

```
Error: waitForTransaction timed out
```

**Fix**: Increase the timeout and retry interval.

```typescript
const receipt = await provider.waitForTransaction(txHash, {
  retryInterval: 5000,  // Check every 5 seconds
  successStates: ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"],
});
```

## L1-L2 Message Not Arriving

### L1->L2 Message Delay

L1->L2 messages require the L1 transaction to be finalized and then picked up by the StarkNet sequencer. This can take minutes to hours.

**Diagnosis**: Check the L1 transaction on Etherscan. If confirmed, the message is queued. The sequencer will process it.

### L2->L1 Message Not Consumable

L2->L1 messages require a state update to be proven and posted to L1. This can take hours.

**Diagnosis**: Check the L2 transaction on Voyager. If ACCEPTED_ON_L2, wait for the state update containing this block to be posted to L1.

### Wrong from_address in L1 Handler

```
Error: Unauthorized L1 sender
```

**Fix**: The `from_address` in `#[l1_handler]` is the L1 contract that called `sendMessageToL2`, NOT the EOA that sent the L1 transaction. Verify you're comparing against the correct L1 contract address.

## snforge Testing Issues

### Test Discovery

```
No tests found
```

**Fix**: Ensure tests are in a `#[cfg(test)]` module and functions have the `#[test]` attribute.

```cairo
#[cfg(test)]
mod tests {
    #[test]
    fn test_something() {
        assert(1 == 1, 'Math works');
    }
}
```

### Contract Name in declare()

```
Error: Contract "MyContract" not found
```

**Fix**: The name passed to `declare()` must match the Cairo module name, not the file name.

```cairo
// If your contract is:
#[starknet::contract]
pub mod Counter { ... }

// Then declare with:
let contract = declare("Counter").unwrap().contract_class();
```

### Cheatcode Cleanup

Tests that modify caller address or block state can leak into subsequent tests.

**Fix**: Always clean up cheatcodes.

```cairo
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};

#[test]
fn test_with_prank() {
    start_cheat_caller_address(contract_address, fake_caller);
    // ... test logic ...
    stop_cheat_caller_address(contract_address);
}
```

## Sierra Gas Exceeded

```
Error: Sierra gas exceeded
```

**Fix**:
1. Reduce loop iteration counts
2. Minimize storage reads/writes inside loops
3. Break large operations into multiple transactions
4. Use `storage_read` batching where possible

Sierra gas is an internal metering mechanism. It limits computation per transaction to ensure provability. There is no direct mapping to L1 gas units.
