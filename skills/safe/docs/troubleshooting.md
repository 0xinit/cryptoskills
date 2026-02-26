# Safe Troubleshooting Guide

Common issues and solutions when working with Safe multisig wallets.

## Transaction Execution Fails with GS013

**Symptoms:**
- `execTransaction` reverts with `GS013`
- Error: "Safe transaction failed"

**Root cause:** The combined signatures are invalid. This is the most common Safe error.

**Solutions:**

1. **Signatures must be sorted by signer address (ascending, case-insensitive)**
   ```typescript
   // Protocol Kit handles sorting automatically when you use signTransaction()
   // If constructing signatures manually, sort by address:
   const sortedSigners = signers.sort((a, b) =>
     a.address.toLowerCase().localeCompare(b.address.toLowerCase())
   );
   ```

2. **Check signer count meets threshold**
   ```typescript
   const threshold = await protocolKit.getThreshold();
   const confirmations = pendingTx.confirmations?.length ?? 0;
   if (confirmations < threshold) {
     console.error(`Need ${threshold} signatures, have ${confirmations}`);
   }
   ```

3. **Verify nonce matches**
   ```typescript
   const onChainNonce = await protocolKit.getNonce();
   console.log("On-chain nonce:", onChainNonce);
   console.log("Transaction nonce:", pendingTx.nonce);
   // These must match for the next executable transaction
   ```

4. **Ensure signers are current owners**
   ```typescript
   const owners = await protocolKit.getOwners();
   const signerAddress = "0x...";
   if (!owners.map(o => o.toLowerCase()).includes(signerAddress.toLowerCase())) {
     console.error("Signer is not an owner of this Safe");
   }
   ```

## Signature Ordering

Safe requires signatures concatenated in ascending order of the signer's address. This is enforced on-chain and is the source of most `GS013` errors when constructing signatures manually.

```typescript
// WRONG: Signatures in arbitrary order
const sigs = sigA + sigB; // if address(B) < address(A), this reverts

// RIGHT: Sort by address first
const signers = [
  { address: "0xAAA...", signature: sigA },
  { address: "0x111...", signature: sigB },
];
signers.sort((a, b) =>
  a.address.toLowerCase().localeCompare(b.address.toLowerCase())
);
const sortedSigs = signers.map(s => s.signature).join("");
```

Protocol Kit's `signTransaction()` handles this automatically. This only matters when you manually concatenate signature bytes.

## Nonce Conflicts

**Symptoms:**
- Transaction stuck as "pending" indefinitely
- New transactions cannot execute
- Error: "Nonce too high" from Transaction Service

**Cause:** Safe nonces are strictly sequential. If nonce 5 is pending, nonce 6 cannot execute until 5 is executed or replaced.

**Solutions:**

1. **Execute or reject the blocking transaction**
   ```typescript
   const apiKit = new SafeApiKit({ chainId: 1n });
   const pendingTxs = await apiKit.getPendingTransactions(SAFE_ADDRESS);

   // Find the lowest-nonce pending transaction
   const blocking = pendingTxs.results.sort((a, b) => a.nonce - b.nonce)[0];
   console.log("Blocking nonce:", blocking.nonce);
   ```

2. **Reject a stuck transaction**
   ```typescript
   const rejectionTx = await protocolKit.createRejectionTransaction(
     blocking.nonce
   );
   const signed = await protocolKit.signTransaction(rejectionTx);
   await protocolKit.executeTransaction(signed);
   ```

3. **Use Transaction Service nonce, not on-chain nonce**
   ```typescript
   // On-chain nonce only reflects executed transactions
   const onChainNonce = await protocolKit.getNonce();

   // Transaction Service tracks queued transactions
   const apiKit = new SafeApiKit({ chainId: 1n });
   const nextNonce = await apiKit.getNextNonce(SAFE_ADDRESS);
   // Use nextNonce when proposing new transactions
   ```

## Module Not Enabled

**Symptoms:**
- `execTransactionFromModule` reverts with `GS100`
- Module calls fail silently

**Solutions:**

1. **Check if module is enabled**
   ```typescript
   const isEnabled = await protocolKit.isModuleEnabled("0xModuleAddress");
   console.log("Module enabled:", isEnabled);
   ```

2. **Enable the module (requires threshold signatures)**
   ```typescript
   const enableTx = await protocolKit.createEnableModuleTx("0xModuleAddress");
   const signed = await protocolKit.signTransaction(enableTx);
   await protocolKit.executeTransaction(signed);
   ```

3. **Verify module address is correct**
   ```bash
   # Check contract exists at the module address
   cast code 0xModuleAddress --rpc-url $RPC_URL
   ```

## Transaction Service Not Syncing

**Symptoms:**
- Newly proposed transactions don't appear in the UI
- Transaction history is stale
- API returns old data

**Solutions:**

1. **Wait for indexing** -- new Safes may take 1-5 minutes to appear
2. **Verify you're using the correct chain URL**
   ```typescript
   // Each chain has its own Transaction Service
   const apiKit = new SafeApiKit({ chainId: 1n }); // mainnet
   // NOT chainId: 42161n for Arbitrum data on mainnet service
   ```
3. **Check service status** -- visit the service URL directly:
   `https://safe-transaction-mainnet.safe.global/`
4. **Try re-proposing** -- if a transaction was lost during service downtime

## Gas Estimation for Batched Transactions

**Symptoms:**
- Batch transactions fail with out-of-gas
- Gas estimate seems too low

**Solutions:**

1. **MultiSend overhead**: Each sub-transaction in a batch adds ~5,000-10,000 gas for encoding and call routing
2. **Estimate on a fork**
   ```typescript
   // Use Protocol Kit's estimateGas for the safeTxGas value
   const batchTx = await protocolKit.createTransaction({ transactions });
   const gasEstimate = await protocolKit.estimateGas(batchTx);
   console.log("Estimated safeTxGas:", gasEstimate);
   ```
3. **Set safeTxGas manually if estimation is unreliable**
   ```typescript
   const safeTx = await protocolKit.createTransaction({
     transactions,
     options: {
       safeTxGas: "500000", // manual override
     },
   });
   ```

## Safe Creation with Deterministic Address

**Symptoms:**
- Predicted address does not match deployed address
- Same parameters produce different addresses on different calls

**Solutions:**

1. **Salt nonce must be identical** -- the predicted address changes with any salt nonce difference
   ```typescript
   const FIXED_SALT = "12345"; // use the same value for predict and deploy

   const kit = await Safe.init({
     provider: RPC_URL,
     signer: DEPLOYER_KEY,
     predictedSafe: {
       safeAccountConfig: { owners, threshold },
       safeDeploymentConfig: {
         saltNonce: FIXED_SALT,
         safeVersion: "1.4.1",
       },
     },
   });
   ```

2. **Safe version must match** -- v1.3.0 and v1.4.1 produce different addresses for the same owners/threshold/salt

3. **Owner order matters** -- `["0xA", "0xB"]` produces a different address than `["0xB", "0xA"]`

4. **Fallback handler affects address** -- specifying a custom fallback handler changes the init data and therefore the predicted address

## Old SDK Patterns (Migration)

**Symptom:** Code using `EthersAdapter`, `@gnosis.pm/safe-*`, or `@safe-global/safe-ethers-lib` fails.

**Fix:** Migrate to Protocol Kit v4+:

```typescript
// OLD (deprecated)
import { EthersAdapter } from "@safe-global/safe-ethers-lib";
const adapter = new EthersAdapter({ ethers, signerOrProvider });
const safeSdk = await Safe.create({ ethAdapter: adapter, safeAddress });

// NEW (current)
import Safe from "@safe-global/protocol-kit";
const protocolKit = await Safe.init({
  provider: process.env.RPC_URL!,
  signer: process.env.PRIVATE_KEY!,
  safeAddress: "0x...",
});
```

## Debug Checklist

- [ ] Using `@safe-global/protocol-kit` v4+ (not deprecated packages)
- [ ] Correct chain ID for API Kit
- [ ] Signer address is a current Safe owner
- [ ] Transaction nonce matches on-chain nonce
- [ ] Signatures sorted by signer address (ascending)
- [ ] Signature count >= threshold
- [ ] Safe has enough ETH for gas
- [ ] Module is enabled before calling it
- [ ] Using `SafeL2` singleton on L2 chains
- [ ] Salt nonce, owner order, and version match when predicting addresses
