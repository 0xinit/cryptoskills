# zkSync Era Troubleshooting

## Compilation Fails with zksolc

### Symptoms
- `zksolc` exits with non-zero code
- "Unknown opcode" or "Unsupported feature" errors
- Compilation succeeds with `solc` but fails with `zksolc`

### Solutions

**Pin zksolc version**: `"latest"` may pull a breaking version. Pin to a known-good version.

```typescript
// hardhat.config.ts
zksolc: {
  version: "1.5.0",
},
```

**Check Solidity version compatibility**: `zksolc` may lag behind the latest `solc`. Use `0.8.24` as a safe default.

**Remove unsupported patterns**:
- `SELFDESTRUCT` — compiles but is a no-op
- `EXTCODECOPY` on external addresses — returns zeros
- Inline assembly using unsupported opcodes

**Clear cache and recompile**:
```bash
npx hardhat clean
npx hardhat compile
```

## Contract Behaves Differently Than on Ethereum

### `extcodesize` Returns Non-Zero for EOAs

On zkSync, all accounts are smart accounts. EOAs have code (the default account implementation). Code that uses `extcodesize > 0` to detect contracts will get false positives.

```solidity
// This check is unreliable on zkSync
function isContract(address a) internal view returns (bool) {
    return a.code.length > 0; // true for EOAs too
}
```

**Fix**: Do not rely on `extcodesize` to distinguish EOAs from contracts on zkSync.

### `block.coinbase` Returns Bootloader Address

On Ethereum, `block.coinbase` is the miner/validator address. On zkSync, it returns the bootloader address (`0x8001`).

### `block.difficulty` / `prevrandao` Is Not Random

Returns a constant value. Do not use it as a source of randomness. Use Chainlink VRF or a similar oracle.

### `msg.value` Has Different Gas Costs

Ether transfers go through `MsgValueSimulator`. Internal calls with `msg.value` may cost more gas than on Ethereum.

## Paymaster Rejects Transactions

### Check Paymaster ETH Balance

The most common cause. The paymaster must have enough ETH to cover `gasLimit * maxFeePerGas`.

```typescript
const paymasterBalance = await provider.getBalance(paymasterAddress);
console.log(`Paymaster balance: ${ethers.formatEther(paymasterBalance)} ETH`);
```

### Verify Paymaster Input Format

General flow:
```typescript
utils.getPaymasterParams(address, {
  type: "General",
  innerInput: new Uint8Array(),
});
```

Approval-based flow:
```typescript
utils.getPaymasterParams(address, {
  type: "ApprovalBased",
  token: tokenAddress,
  minimalAllowance: amount,
  innerInput: new Uint8Array(),
});
```

### Check `require` Conditions in Paymaster

Common issues:
- Target address not whitelisted
- Wrong token for approval-based flow
- Minimum token allowance not met
- Custom business logic rejecting the transaction

### Debug Locally

Test the paymaster on `era_test_node` before deploying to testnet:
```bash
era_test_node run
# Deploy and test paymaster against localhost:8011
```

## Gas Estimation Incorrect

### L1 Pubdata Factor

Gas estimation on zkSync includes L1 pubdata costs. These fluctuate with L1 gas prices.

```typescript
// Always set gasPerPubdata
const tx = {
  // ...
  customData: {
    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
  },
};

// Let the provider estimate — do not hardcode gas limits
const gasEstimate = await provider.estimateGas(tx);
```

### State Diff Size

Transactions that modify many storage slots generate more pubdata, increasing gas cost disproportionately compared to Ethereum.

### Buffer Gas Estimates

```typescript
// Add 20% buffer to estimates
const estimate = await provider.estimateGas(tx);
tx.gasLimit = (estimate * 120n) / 100n;
```

## Hardhat-zksync Plugin Version Conflicts

### Symptoms
- `TypeError: Cannot read properties of undefined`
- Missing methods on deployer/contract objects
- Plugin initialization failures

### Solutions

**Use the unified plugin**: The `@matterlabs/hardhat-zksync` package bundles all sub-plugins. Avoid mixing individual plugins with the unified package.

```bash
# Remove individual plugins
npm uninstall @matterlabs/hardhat-zksync-solc @matterlabs/hardhat-zksync-deploy @matterlabs/hardhat-zksync-verify

# Install the unified plugin
npm install -D @matterlabs/hardhat-zksync
```

**Match zksync-ethers version**: Ensure `zksync-ethers` version is compatible with the plugin version. Use `zksync-ethers@6.x` with the latest `@matterlabs/hardhat-zksync`.

**Lock ethers version**: `zksync-ethers@6.x` depends on `ethers@6.x`. Do not mix with `ethers@5.x`.

```bash
npm ls ethers
# Should show only one major version
```

## Testing with Local Node Issues

### era_test_node Won't Start

```bash
# Check if port 8011 is in use
lsof -i :8011

# Kill existing process if needed
kill -9 $(lsof -ti :8011)

# Reinstall
cargo install --git https://github.com/matter-labs/era-test-node --force
```

### Tests Pass Locally but Fail on Testnet

- **Gas differences**: Local node uses different gas pricing. Always test on testnet before mainnet.
- **Nonce issues**: Local node resets nonces on restart. Testnet nonces persist.
- **Missing contracts**: If your tests depend on contracts deployed on testnet (e.g., tokens), fork from testnet:
  ```bash
  era_test_node fork sepolia-testnet
  ```

### Rich Wallet Not Working

Use the correct rich wallet private keys for `era_test_node`:
```typescript
const RICH_WALLET_PK = "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110";
```

These wallets only work on the local node, not on testnet or mainnet.

## Bridge Deposit Not Appearing

### Timeline
- ETH deposits: 1-3 minutes
- ERC-20 deposits: 1-3 minutes after L1 confirmation

### Debugging Steps

1. Verify the L1 transaction succeeded on Etherscan
2. Check the correct L1 bridge contract was used
3. Wait the full 3 minutes before investigating
4. Check the L2 explorer for the deposit transaction
5. Verify recipient address is correct

```typescript
// Check L2 balance after deposit
const balance = await l2Provider.getBalance(walletAddress);
console.log(`L2 balance: ${ethers.formatEther(balance)}`);
```

## CREATE2 Address Computation Differs

### Problem
Factory contracts that precompute CREATE2 addresses get different results on zkSync vs Ethereum.

### Root Cause
zkSync CREATE2 formula includes `keccak256(constructorInput)` as an additional parameter.

### Fix
```typescript
import { utils } from "zksync-ethers";

// Do NOT use ethers.getCreate2Address — it uses Ethereum's formula
// Use the zkSync-specific helper
const address = utils.create2Address(
  factoryAddress,
  bytecodeHash,
  salt,
  abiEncodedConstructorArgs
);
```

If deploying a contract with no constructor arguments, pass empty bytes for `constructorInput`.
