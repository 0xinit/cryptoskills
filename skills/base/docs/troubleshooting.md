# Base Troubleshooting Guide

Common issues and solutions when developing on Base.

## Smart Wallet Passkey Failures

### Passkey prompt does not appear

**Symptoms:** Clicking "Connect" does nothing or throws a silent error.

**Solutions:**
1. Check browser support — passkeys require Chrome 108+, Safari 16+, Firefox 122+
2. Ensure HTTPS — WebAuthn requires a secure context (`localhost` works for development)
3. Check `PublicKeyCredential` availability:
   ```typescript
   if (!window.PublicKeyCredential) {
     console.error('WebAuthn not supported in this browser');
   }
   ```
4. On mobile, ensure the device has biometrics or a PIN configured
5. Incognito/private mode may block passkey storage on some browsers

### "InvalidSignature" after passkey auth

**Cause:** The passkey does not match the wallet's registered owner.

**Solutions:**
1. User may have multiple passkeys — try disconnecting and reconnecting
2. If wallet owner was rotated, the old passkey is invalid
3. Clear the wagmi connector cache: `localStorage.removeItem('wagmi.store')`

## Paymaster Rejects Transaction

### AA32: Paymaster validation failed

**Cause:** The UserOperation is not covered by your paymaster policy.

**Checklist:**
1. Is the target contract address in your allowlist? Check CDP dashboard.
2. Is the function selector allowlisted? The 4-byte selector must match exactly.
3. Has the user exceeded their per-address rate or spend limit?
4. Is your paymaster budget exhausted? Check the CDP dashboard billing page.

```bash
# Decode function selector to verify
cast sig "mint(address,uint256)"
# 0x40c10f19
```

### POLICY_VIOLATION

**Cause:** Transaction parameters violate the configured policy.

**Check:**
- Contract address is allowlisted
- Function signature matches the policy
- Transaction value is within allowed range
- User has not exceeded daily/weekly limits

### Paymaster works on Sepolia but fails on mainnet

**Cause:** Separate paymaster policies for testnet and mainnet.

**Fix:** Configure a mainnet paymaster policy in the CDP dashboard. Testnet policies do not carry over.

## OnchainKit Issues

### Components render unstyled

**Cause:** Missing CSS import.

**Fix:** Import the OnchainKit stylesheet in your layout or global CSS:
```tsx
import '@coinbase/onchainkit/styles.css';
```

### "Missing OnchainKitProvider" error

**Cause:** Component rendered outside the provider tree.

**Fix:** Ensure your component tree is wrapped:
```tsx
<WagmiProvider config={config}>
  <QueryClientProvider client={queryClient}>
    <OnchainKitProvider apiKey={CDP_API_KEY} chain={base}>
      {/* Your components here */}
    </OnchainKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

### Identity components show address instead of name

**Cause:** The address has no ENS name, Basename, or Farcaster profile.

**Fix:** This is expected behavior. Use fallback rendering:
```tsx
<Name
  address={address}
  // Falls back to truncated address if no name found
/>
```

### Swap component shows "No quote available"

**Possible causes:**
1. Token pair has insufficient liquidity on Base
2. Token address is incorrect (verify on Basescan)
3. Amount is too small or too large for available liquidity
4. CDP API key is invalid or missing

## Gas Estimation (L1 Data Cost)

### Transaction costs more than expected

**Cause:** L1 data fee is the dominant cost on Base. Large calldata = higher L1 fee.

**Debug:**
```bash
# Check L1 data fee for your tx data
cast call 0x420000000000000000000000000000000000000F \
  "getL1Fee(bytes)(uint256)" \
  <your_serialized_tx_data> \
  --rpc-url https://mainnet.base.org
```

**Optimize:**
- Minimize calldata size (pack structs, use shorter data)
- Batch operations into fewer transactions
- Use `bytes32` instead of `string` where possible

### `eth_estimateGas` returns unexpectedly low value

**Cause:** `eth_estimateGas` returns L2 gas only. It does not include the L1 data fee.

**Fix:** Add L1 data fee separately:
```typescript
const l2Gas = await publicClient.estimateGas({ ... });
const l1Fee = await publicClient.readContract({
  address: '0x420000000000000000000000000000000000000F',
  abi: gasPriceOracleAbi,
  functionName: 'getL1Fee',
  args: [serializedTx],
});
// Total cost = (l2Gas * gasPrice) + l1Fee
```

## Bridge Issues

### Deposit not credited on Base (L1 -> L2)

**Cause:** L1-to-L2 deposits take 1-5 minutes to appear.

**Checklist:**
1. Check L1 tx confirmed on Etherscan
2. Wait at least 5 minutes
3. Check the deposit on the Base bridge explorer: https://bridge.base.org
4. If still missing after 30 minutes, the sequencer may be down — check https://status.base.org

### Withdrawal stuck (L2 -> L1)

**Cause:** L2-to-L1 withdrawals have a multi-step process with a 7-day challenge period.

**Timeline:**
1. Initiate withdrawal on L2 (immediate)
2. Wait for state root to be posted on L1 (~1 hour)
3. Prove withdrawal on L1 (requires L1 transaction)
4. Wait 7 days (challenge period)
5. Finalize withdrawal on L1 (requires L1 transaction)

Use the Base Bridge UI at https://bridge.base.org to track and complete each step.

## Basescan Verification

### "Unable to verify" error

**Common causes:**
1. **Solc version mismatch** — Check exact version: `forge config | grep solc`
2. **Optimizer settings** — Number of runs must match: `forge config | grep optimizer`
3. **EVM version** — Must match compilation target
4. **Imports flattened incorrectly** — Use `forge flatten` to check

```bash
# Verify exact compiler settings used
forge config --json | jq '{solc: .solc_version, optimizer_runs: .optimizer_runs, evm_version: .evm_version}'
```

### Verification succeeds on Basescan but fails on Blockscout (or vice versa)

**Cause:** Different verification APIs may require slightly different formats.

**Fix:** Verify on each explorer separately:
```bash
# Basescan
forge verify-contract $ADDR src/Contract.sol:Contract \
  --chain base --etherscan-api-key $BASESCAN_API_KEY

# Blockscout
forge verify-contract $ADDR src/Contract.sol:Contract \
  --chain base --verifier blockscout \
  --verifier-url https://base.blockscout.com/api/
```

## ERC-4337 Bundler Issues

### UserOperation reverts with no clear error

**Debug steps:**
1. Simulate the UserOp's calldata as a regular `eth_call`:
   ```bash
   cast call $SMART_WALLET_ADDRESS $CALLDATA --rpc-url https://mainnet.base.org
   ```
2. Check that the sender (smart wallet) is deployed — `cast code $SMART_WALLET_ADDRESS`
3. Verify the nonce matches the EntryPoint's expected nonce
4. Ensure `callGasLimit` and `verificationGasLimit` are sufficient

### "AA25 invalid account nonce"

**Cause:** UserOp nonce does not match EntryPoint state.

**Fix:**
```bash
# Get current nonce from EntryPoint
cast call 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  "getNonce(address,uint192)(uint256)" \
  $SMART_WALLET_ADDRESS 0 \
  --rpc-url https://mainnet.base.org
```
