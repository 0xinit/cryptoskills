# Hardhat Troubleshooting Guide

Common issues and solutions when developing with Hardhat.

## Compilation Fails After Upgrade

**Symptoms:**
- `npx hardhat compile` fails after upgrading Hardhat or a plugin
- Errors referencing cached artifacts or stale types
- `Cannot find module '../typechain-types'`

**Solutions:**

1. Clean all caches and recompile:
   ```bash
   npx hardhat clean
   rm -rf typechain-types
   npx hardhat compile
   ```

2. If still failing, reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npx hardhat compile
   ```

3. Check version compatibility between `hardhat` and `@nomicfoundation/hardhat-toolbox`. Both should be on the latest minor version.

## Tests Pass Locally, Fail in CI

**Symptoms:**
- All tests pass with `npx hardhat test` locally
- CI pipeline reports failures or timeouts

**Causes & Solutions:**

1. **Missing environment variables** — Fork tests need `MAINNET_RPC_URL`. Skip fork tests in CI if no RPC is configured:
   ```typescript
   const FORK_ENABLED = process.env.MAINNET_RPC_URL !== undefined;

   (FORK_ENABLED ? describe : describe.skip)("Fork Tests", function () {
     // ...
   });
   ```

2. **Test timeout** — CI machines are slower. Increase Mocha timeout:
   ```typescript
   mocha: {
     timeout: 120_000,
   },
   ```

3. **Nondeterministic state** — Tests share state when not using `loadFixture`. Fix by using fixtures for all tests.

4. **Different Node.js version** — Ensure CI uses the same Node.js major version as local development.

## "Transaction reverted without a reason string"

**Symptoms:**
- Transaction reverts with no error message
- Cannot determine why the call failed

**Causes & Solutions:**

1. **Contract uses custom errors (not require strings):**
   ```typescript
   // WRONG: expects a string revert
   await expect(tx).to.be.revertedWith("Some message");

   // RIGHT: expects a custom error
   await expect(tx).to.be.revertedWithCustomError(contract, "ErrorName");
   ```

2. **Low-level call failure** — If the contract uses `address.call()`, failures propagate without a reason. Check the called contract's code.

3. **Out of gas** — The transaction ran out of gas before reaching the revert. Increase gas limit:
   ```typescript
   await contract.method({ gasLimit: 500_000n });
   ```

## Etherscan Verification Fails

**Symptoms:**
- `npx hardhat verify` returns "bytecode does not match"
- Verification completes but shows wrong source

**Solutions:**

1. **Constructor arguments must match exactly:**
   ```bash
   # Create arguments file
   echo 'module.exports = ["0xTokenAddress", 1000n, "Name"];' > arguments.js
   npx hardhat verify --constructor-args arguments.js --network sepolia ADDRESS
   ```

2. **Compiler settings must match** — Same Solidity version, optimizer runs, and `evmVersion` as the deployed contract. Check `hardhat.config.ts`.

3. **Wait for indexing** — Etherscan needs time to index new deployments. Wait 1-2 minutes after deployment before verifying.

4. **Proxy contracts** — Verify the implementation contract, not the proxy address. Get implementation address:
   ```typescript
   const impl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
   ```

## Forking Is Slow

**Symptoms:**
- Fork tests take 30+ seconds each
- First test is slow, subsequent tests are faster

**Causes & Solutions:**

1. **Pin `blockNumber`** — Without it, Hardhat fetches the latest state each run:
   ```typescript
   forking: {
     url: process.env.MAINNET_RPC_URL ?? "",
     blockNumber: 19_500_000,
   },
   ```

2. **Use `loadFixture`** — Caches EVM snapshots so fork state is restored without re-fetching.

3. **Run fork tests separately** — Keep unit tests fast by separating them:
   ```bash
   npx hardhat test test/unit/
   npx hardhat test test/fork/
   ```

4. **Cache RPC responses** — Hardhat caches RPC responses in `cache/`. Do not delete it between runs unless necessary.

## "Cannot estimate gas" on Live Networks

**Symptoms:**
- Deployment or function call fails with gas estimation error
- Works on Hardhat Network but fails on testnet/mainnet

**Solutions:**

1. **Set explicit gas limit:**
   ```typescript
   const tx = await contract.method(args, { gasLimit: 1_000_000n });
   ```

2. **Check account balance** — Gas estimation fails if the account cannot afford the estimated gas.

3. **Check contract constructor** — If it reverts during gas estimation, the deployment will fail. Test the constructor on Hardhat Network first.

4. **RPC may reject** — Some RPC providers reject `eth_estimateGas` for complex transactions. Try a different provider.

## TypeScript "Cannot find module" Errors

**Symptoms:**
- `Cannot find module '@nomicfoundation/hardhat-toolbox'`
- `Cannot find module '../typechain-types'`
- Red squiggly lines in VS Code but tests still pass

**Solutions:**

1. Ensure `tsconfig.json` includes required paths:
   ```json
   {
     "include": ["./scripts", "./test", "./typechain-types"],
     "files": ["./hardhat.config.ts"]
   }
   ```

2. Run `npx hardhat compile` to generate `typechain-types/`.

3. Restart VS Code TypeScript server: Cmd+Shift+P > "TypeScript: Restart TS Server".

## Hardhat Network Accounts Run Out of ETH

**Symptoms:**
- Tests fail with "sender doesn't have enough funds" on Hardhat Network
- Happens after many deployments in a single test run

**Solutions:**

1. Increase default account balance:
   ```typescript
   networks: {
     hardhat: {
       accounts: {
         accountsBalance: "100000000000000000000000", // 100,000 ETH
       },
     },
   },
   ```

2. Use `loadFixture` to reset state between tests — prevents balance drain from accumulated gas costs.

## Plugin Conflicts

**Symptoms:**
- `Error: Plugin already registered`
- Duplicate type declarations
- Unexpected behavior after adding a new plugin

**Solutions:**

1. Do not import both `@nomicfoundation/hardhat-toolbox` AND its individual sub-plugins. Toolbox includes them all.

2. Do not mix `@nomiclabs/` (deprecated) with `@nomicfoundation/` (current) plugins. Remove all `@nomiclabs/` packages.

3. Check for peer dependency conflicts:
   ```bash
   npm ls @nomicfoundation/hardhat-ethers
   ```
