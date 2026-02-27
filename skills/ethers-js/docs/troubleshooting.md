# ethers.js v6 Troubleshooting Guide

Common issues and solutions when using ethers.js v6.

## "Cannot find module 'ethers'" or Import Errors

**Symptoms:**
- TypeScript cannot resolve `ethers` imports
- `Cannot find module 'ethers' or its corresponding type declarations`

**Solutions:**

1. **Verify installation:**
   ```bash
   npm list ethers
   # Should show ethers@6.x.x
   ```

2. **Check you are on v6, not v5:**
   ```bash
   npm info ethers version
   ```

3. **TypeScript config must target ES2020 or later** (for native bigint support):
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ES2020",
       "moduleResolution": "node"
     }
   }
   ```

4. **Use named imports, not namespace imports:**
   ```typescript
   // WRONG for v6 tree-shaking
   import { ethers } from "ethers";
   ethers.JsonRpcProvider; // works but defeats tree-shaking

   // CORRECT
   import { JsonRpcProvider } from "ethers";
   ```

## "BigNumber is not a constructor" / BigNumber Errors

**Symptoms:**
- `TypeError: ethers.BigNumber is not a constructor`
- `Property 'BigNumber' does not exist on type`

**Solutions:**

1. **You are using v5 code with v6.** v6 has no BigNumber class. Replace with native bigint:
   ```typescript
   // WRONG (v5)
   const amount = ethers.BigNumber.from("1000000");
   const sum = amount.add(ethers.BigNumber.from("500000"));

   // CORRECT (v6)
   const amount = 1000000n;
   const sum = amount + 500000n;
   ```

2. **For parsing string amounts:**
   ```typescript
   // WRONG (v5)
   const wei = ethers.utils.parseEther("1.0");

   // CORRECT (v6)
   import { parseEther } from "ethers";
   const wei = parseEther("1.0"); // returns bigint
   ```

## "ethers.utils is undefined"

**Symptoms:**
- `TypeError: Cannot read properties of undefined (reading 'parseEther')`
- `ethers.utils.parseEther is not a function`

**Solutions:**

1. **The `utils` namespace does not exist in v6.** All utilities are top-level:
   ```typescript
   // WRONG (v5)
   import { ethers } from "ethers";
   ethers.utils.parseEther("1.0");
   ethers.utils.formatEther(wei);
   ethers.utils.keccak256(data);

   // CORRECT (v6)
   import { parseEther, formatEther, keccak256 } from "ethers";
   parseEther("1.0");
   formatEther(wei);
   keccak256(data);
   ```

## "ethers.providers is undefined"

**Symptoms:**
- `new ethers.providers.JsonRpcProvider(url)` fails
- `ethers.providers is not defined`

**Solutions:**

1. **Providers are top-level imports in v6:**
   ```typescript
   // WRONG (v5)
   const provider = new ethers.providers.JsonRpcProvider(url);
   const browser = new ethers.providers.Web3Provider(window.ethereum);

   // CORRECT (v6)
   import { JsonRpcProvider, BrowserProvider } from "ethers";
   const provider = new JsonRpcProvider(url);
   const browser = new BrowserProvider(window.ethereum);
   ```

## tx.wait() Returns null

**Symptoms:**
- `receipt` is null after calling `tx.wait()`
- Code crashes on `receipt.status` with null reference error

**Solutions:**

1. **This is expected in v6.** `wait()` returns `null` when the transaction is dropped or replaced by the network:
   ```typescript
   const receipt = await tx.wait();
   if (receipt === null) {
     throw new Error("Transaction was dropped or replaced");
   }
   if (receipt.status !== 1) {
     throw new Error("Transaction reverted");
   }
   ```

2. **Common causes of dropped transactions:** nonce conflict, gas too low, RPC mempool eviction.

## CALL_EXCEPTION on Contract Interaction

**Symptoms:**
- `Error: CALL_EXCEPTION` when calling a contract function
- Works in Etherscan but fails in code

**Solutions:**

1. **Verify the ABI matches the deployed contract.** A mismatched ABI is the most common cause:
   ```typescript
   // Check if the address has code
   const code = await provider.getCode(contractAddress);
   if (code === "0x") {
     throw new Error("No contract at this address on this network");
   }
   ```

2. **Check you are on the correct network:**
   ```typescript
   const network = await provider.getNetwork();
   console.log(`Chain ID: ${network.chainId}`);
   ```

3. **Simulate before sending** to get the revert reason:
   ```typescript
   try {
     const result = await contract.transfer.staticCall(to, amount);
   } catch (error: unknown) {
     if (isError(error, "CALL_EXCEPTION")) {
       console.error(`Revert reason: ${error.reason}`);
     }
   }
   ```

4. **Ensure the contract is connected to a signer for write operations:**
   ```typescript
   // Read-only (provider) -- cannot send transactions
   const readOnly = new Contract(address, abi, provider);

   // Read-write (signer) -- can send transactions
   const readWrite = new Contract(address, abi, wallet);
   // Or: readOnly.connect(wallet)
   ```

## UNSUPPORTED_OPERATION: "Cannot Execute Write on Read-Only"

**Symptoms:**
- Write transaction fails with `UNSUPPORTED_OPERATION`
- Contract was created with a Provider instead of a Signer

**Solutions:**

1. **Connect the contract to a Signer:**
   ```typescript
   const readContract = new Contract(address, abi, provider);

   // This fails:
   // await readContract.transfer(to, amount);

   // Connect to signer first:
   const writeContract = readContract.connect(wallet) as Contract;
   await writeContract.transfer(to, amount);
   ```

## ENS Resolution Returns null

**Symptoms:**
- `provider.resolveName("name.eth")` returns `null`
- No error thrown

**Solutions:**

1. **ENS is only deployed on certain networks.** Mainnet Ethereum has ENS. Most L2s and testnets may not. Check your provider's network.

2. **The name may not have a resolution record.** Not all .eth names have an address set.

3. **Always handle the null case:**
   ```typescript
   const address = await provider.resolveName("name.eth");
   if (address === null) {
     throw new Error("ENS name could not be resolved");
   }
   ```

## Gas Estimation Fails (UNPREDICTABLE_GAS_LIMIT)

**Symptoms:**
- `Error: UNPREDICTABLE_GAS_LIMIT` before sending transaction
- Gas estimation returns error

**Solutions:**

1. **The transaction would revert on-chain.** Gas estimation runs the transaction in a simulation. If the simulation reverts, ethers throws this error. Fix the underlying revert cause first.

2. **Check balance, allowance, and preconditions:**
   ```typescript
   const balance = await token.balanceOf(wallet.address);
   if (balance < amount) {
     throw new Error(`Insufficient token balance: ${balance} < ${amount}`);
   }
   ```

3. **If you are certain the TX will succeed, set gasLimit manually:**
   ```typescript
   const tx = await contract.transfer(to, amount, { gasLimit: 100000n });
   ```

## WebSocket Disconnections

**Symptoms:**
- Event subscriptions stop firing
- `WebSocket closed` errors

**Solutions:**

1. **Implement reconnection logic.** See the reconnection pattern in `resources/provider-types.md`.

2. **Check RPC provider WebSocket limits.** Some providers limit concurrent WS connections or idle timeouts.

3. **Use `provider.websocket.on("close", ...)` to detect disconnection.**

## Debug Checklist

- [ ] ethers v6 installed (`npm list ethers` shows 6.x.x)
- [ ] TypeScript targets ES2020+ (for bigint)
- [ ] Using top-level imports, not `ethers.utils.*` or `ethers.providers.*`
- [ ] Using `bigint` / `123n`, not `BigNumber`
- [ ] Contract connected to Signer for write operations
- [ ] `tx.wait()` null check before accessing `receipt.status`
- [ ] Correct ABI for the deployed contract
- [ ] Correct network / chain ID for the target contract
- [ ] ENS resolution null check
- [ ] Error handling uses `isError(error, "CODE")` pattern
