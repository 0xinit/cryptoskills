# Scaffold-ETH 2 Troubleshooting Guide

Common issues and solutions when building with SE2.

## "Contract not found" -- Missing from deployedContracts.ts

**Symptoms:**
- SE2 hooks return `undefined` for data
- Debug page does not show your contract
- Console warning: contract not found for the current chain

**Cause:** The contract was not deployed to the chain you are connected to, or `deployedContracts.ts` was not regenerated after deployment.

**Fix:**
1. Run `yarn deploy` to redeploy and regenerate the contract bindings
2. Check that `scaffold.config.ts` targets the correct chain
3. Verify your wallet is connected to the same chain the contract was deployed to
4. If deploying to a live network, confirm `yarn deploy --network <name>` completed without errors

## Hooks Not Updating After Contract Change

**Symptoms:**
- Frontend shows stale data after modifying and redeploying a contract
- New functions do not appear on the debug page

**Cause:** The `deployedContracts.ts` file was not regenerated, or the browser cached the old version.

**Fix:**
1. Run `yarn deploy` again (this regenerates `deployedContracts.ts`)
2. Hard refresh the browser (Cmd+Shift+R / Ctrl+Shift+R)
3. Check that the deploy script includes your updated contract in the `deployments` array

## Deployment Fails with "Insufficient Funds"

**Symptoms:**
- Foundry deploy script reverts with insufficient balance
- Hardhat deploy fails with "sender doesn't have enough funds"

**Cause:** The deployer account has no ETH on the target chain.

**Fix:**
- Local chain: `yarn chain` pre-funds accounts. Use the default deployer or fund a custom one with `cast send`.
- Testnet: Get ETH from a faucet (Sepolia: https://sepoliafaucet.com)
- Mainnet: Transfer ETH to the deployer address

## Network Mismatch Between Contract and Frontend

**Symptoms:**
- Frontend connects to mainnet but contracts were deployed to Sepolia
- Hook calls return empty data or errors

**Cause:** `scaffold.config.ts` targets a different chain than where the contracts live.

**Fix:**
```typescript
// packages/nextjs/scaffold.config.ts
const scaffoldConfig = defineConfig({
  // Must match the chain where contracts are deployed
  targetNetworks: [chains.sepolia],
});
```

Also check that `deployedContracts.ts` has an entry for the correct chain ID.

## TypeScript Errors in deployedContracts.ts

**Symptoms:**
- Red squiggly lines in `deployedContracts.ts`
- Type errors when using SE2 hooks

**Cause:** The auto-generated file can have issues after a failed or partial deploy.

**Fix:**
1. Delete `packages/nextjs/contracts/deployedContracts.ts`
2. Run `yarn deploy` to regenerate it from scratch
3. If using external contracts, ensure `externalContracts.ts` uses `as const` on ABI arrays

## Burner Wallet Not Working

**Symptoms:**
- No wallet auto-connects on local chain
- "Connect Wallet" prompt appears even on localhost

**Cause:** The burner wallet only activates when `onlyLocalBurnerWallet: true` and the target network is a local chain (Hardhat Network or Anvil).

**Fix:**
1. Confirm `yarn chain` is running
2. Check `scaffold.config.ts` has `targetNetworks: [chains.hardhat]` or `chains.foundry`
3. Check `onlyLocalBurnerWallet` is `true` (not `false`)
4. Clear `localStorage` in the browser (the burner key is stored there)

## Debug Page Shows No Contracts

**Symptoms:**
- `/debug` page is empty
- No contract cards appear

**Cause:** No contracts in `deployedContracts.ts` or `externalContracts.ts` for the connected chain.

**Fix:**
1. Run `yarn deploy` to populate `deployedContracts.ts`
2. Confirm the chain ID in the file matches your wallet's chain
3. For external contracts, ensure the chain ID key in `externalContracts.ts` matches

## "yarn chain" Fails to Start

**Symptoms:**
- Anvil or Hardhat Network does not start
- Port already in use error

**Cause:** Another process is using port 8545.

**Fix:**
```bash
# Find and kill the process using port 8545
lsof -i :8545
kill -9 <PID>

# Restart
yarn chain
```

## Transaction Reverts with No Error Message

**Symptoms:**
- Transaction fails but the error message is unhelpful
- "execution reverted" with no custom error

**Cause:** The contract may use `require` without a message string, or the frontend is not parsing custom errors.

**Fix:**
1. Add error messages to all `require` statements or use custom errors
2. Check the transaction on the debug page -- it shows raw revert data
3. Use `cast run <tx_hash> --rpc-url <url>` to get a detailed trace

## References

- SE2 docs: https://docs.scaffoldeth.io
- SE2 GitHub Issues: https://github.com/scaffold-eth/scaffold-eth-2/issues
- BuidlGuidl support: https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA
