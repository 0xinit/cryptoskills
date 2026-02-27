# zkSync Era Common Errors

## Compilation Errors

### "zksolc compilation failed"

**Cause**: Version mismatch between `zksolc` and `solc`, or unsupported Solidity features.

**Fix**:
```bash
# Ensure zksolc is installed and up to date
npx hardhat compile --force

# Or specify version explicitly in hardhat.config.ts
zksolc: {
  version: "1.5.0", // pin to specific version instead of "latest"
},
```

### "Unsupported opcode: SELFDESTRUCT"

**Cause**: `zksolc` with strict mode flags rejects `SELFDESTRUCT`. By default it compiles to a no-op, but some configurations error.

**Fix**: Remove `SELFDESTRUCT` from your contract. The opcode does nothing on zkSync anyway.

### "Unsupported opcode: EXTCODECOPY"

**Cause**: Using `EXTCODECOPY` on an address other than `address(this)`.

**Fix**: Only use `EXTCODECOPY` on your own contract. To inspect other contracts, use `EXTCODEHASH` or `EXTCODESIZE` instead.

### "enableEraVMExtensions required"

**Cause**: Calling system contracts without enabling the flag.

**Fix**:
```typescript
// hardhat.config.ts
zksolc: {
  version: "latest",
  settings: {
    enableEraVMExtensions: true,
  },
},
```

## Deployment Errors

### "Transaction is not executable"

**Cause**: Nonce mismatch, insufficient balance, or invalid transaction format.

**Fix**:
- Check account nonce: `await provider.getTransactionCount(address)`
- Ensure sufficient ETH for gas
- For smart account deployments, use `"createAccount"` deployment type

### "Failed to submit transaction: not enough gas"

**Cause**: Gas limit too low. zkSync gas includes L1 pubdata costs, which can be significant.

**Fix**:
```typescript
// Let the provider estimate gas (includes pubdata)
const gasEstimate = await provider.estimateGas(tx);

// Add a buffer for safety
tx.gasLimit = (gasEstimate * 120n) / 100n; // 20% buffer
```

### "Bytecode hash is not known"

**Cause**: Deploying a contract whose bytecode hash is not registered in `KnownCodesStorage`.

**Fix**: Use the standard deployment flow via `Deployer` class or `ContractDeployer` system contract. Do not try to deploy raw bytecode manually.

## Paymaster Errors

### "Paymaster validation failed"

**Cause**: The paymaster's `validateAndPayForPaymasterTransaction` reverted or returned wrong magic value.

**Fix**:
- Check paymaster has sufficient ETH balance
- Verify the paymaster input format (general vs approval-based)
- Ensure the paymaster allows the target contract
- Check that `PAYMASTER_VALIDATION_SUCCESS_MAGIC` is returned

### "Paymaster returned invalid magic value"

**Cause**: `validateAndPayForPaymasterTransaction` did not return `PAYMASTER_VALIDATION_SUCCESS_MAGIC`.

**Fix**: Ensure the function returns `bytes4(PAYMASTER_VALIDATION_SUCCESS_MAGIC)` on success. Check all `require` conditions are passing.

### "Insufficient allowance" (approval-based paymaster)

**Cause**: User has not approved the paymaster to spend their ERC-20 tokens.

**Fix**: The `ApprovalBased` flow in `utils.getPaymasterParams` sets the `minimalAllowance`. The bootloader auto-approves during validation. Ensure `processPaymasterInput()` is called in `prepareForPaymaster`.

## Account Abstraction Errors

### "Account validation failed"

**Cause**: `validateTransaction` reverted or returned wrong magic value.

**Fix**:
- Verify signature format matches what the account expects
- Check the `customSignature` field is set in `customData`
- Ensure transaction type is `113` (EIP-712)
- Debug the signature recovery logic

### "Account execution failed"

**Cause**: `executeTransaction` reverted.

**Fix**:
- Check the target contract call is valid
- For contract deployments from the account, use `SystemContractsCaller.systemCallWithPropagatedRevert`
- Verify sufficient value is being forwarded

### "Only bootloader can call this function"

**Cause**: A function restricted to the bootloader was called by another address.

**Fix**: `validateTransaction`, `executeTransaction`, `payForTransaction`, and `prepareForPaymaster` can only be called by `BOOTLOADER_FORMAL_ADDRESS`. Do not call these directly.

## Gas Errors

### "Not enough gas for pubdata"

**Cause**: `gas_per_pubdata_byte_limit` is set too low for the transaction's pubdata requirements.

**Fix**:
```typescript
import { utils } from "zksync-ethers";

// Use the default (50000)
customData: {
  gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
}
```

### "max fee per gas less than block base fee"

**Cause**: The specified `maxFeePerGas` is lower than the current base fee.

**Fix**:
```typescript
const gasPrice = await provider.getGasPrice();
tx.maxFeePerGas = gasPrice;
tx.maxPriorityFeePerGas = gasPrice; // priority fee is not used on zkSync
```

## CREATE/CREATE2 Errors

### "CREATE2 address mismatch"

**Cause**: Using Ethereum's CREATE2 address formula instead of zkSync's.

**Fix**: zkSync CREATE2 includes the constructor input hash. Use `utils.create2Address()`:
```typescript
import { utils } from "zksync-ethers";

const address = utils.create2Address(
  deployerAddress,
  bytecodeHash,
  salt,
  constructorInput // this parameter does not exist in Ethereum CREATE2
);
```

### "Code hash is not known"

**Cause**: Trying to deploy bytecode that has not been published to `KnownCodesStorage`.

**Fix**: Use the standard deployment pipeline. The `Deployer` class handles bytecode publishing automatically.

## Bridge Errors

### "Deposit not appearing on L2"

**Cause**: Normal — deposits take 1-3 minutes.

**Fix**: Wait and check the L1 tx on Etherscan. If it succeeded, the L2 deposit is processing.

### "Withdrawal finalization failed"

**Cause**: ZK proof not yet verified on L1.

**Fix**: Check `wallet.isWithdrawalFinalized(txHash)`. Proof generation takes 1-3 hours.
