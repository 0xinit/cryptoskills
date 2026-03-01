# Solana Kit Migration Troubleshooting Guide

Common issues and solutions when migrating from `@solana/web3.js` (v1) to `@solana/kit`.

## "Cannot find module '@solana/kit'" After Install

**Symptoms:**
- TypeScript can't resolve `@solana/kit`
- Module not found errors despite `npm install`

**Solutions:**

1. **Verify correct package name.** The kit was renamed multiple times during development:
   ```bash
   # Current (correct) package
   npm install @solana/kit

   # These are WRONG / outdated
   # npm install @solana/web3.js@2   # old alpha
   # npm install @solana/web3.js@rc  # old RC
   ```

2. **Check Node.js version.** Kit requires Node 18+ for native `fetch` and `crypto.subtle`:
   ```bash
   node --version  # Must be >= 18.0.0
   ```

3. **Verify `tsconfig.json` module resolution:**
   ```json
   {
     "compilerOptions": {
       "module": "ESNext",
       "moduleResolution": "bundler",
       "target": "ES2022"
     }
   }
   ```

## `pipe()` Chain Type Errors

**Symptoms:**
- TypeScript errors when chaining `pipe()` operations
- "Argument of type X is not assignable to parameter of type Y"

**Solutions:**

1. **Ensure operations are in the correct order.** Kit's `pipe()` is type-safe and order-dependent:
   ```typescript
   import {
     pipe,
     createTransactionMessage,
     setTransactionMessageFeePayer,
     setTransactionMessageLifetimeUsingBlockhash,
     appendTransactionMessageInstruction,
   } from "@solana/kit";

   // Correct order: create → fee payer → lifetime → instructions
   const tx = pipe(
     createTransactionMessage({ version: 0 }),
     (msg) => setTransactionMessageFeePayer(feePayer, msg),
     (msg) => setTransactionMessageLifetimeUsingBlockhash(blockhash, msg),
     (msg) => appendTransactionMessageInstruction(instruction, msg),
   );
   ```

2. **Don't mix v1 and Kit types.** A `PublicKey` from v1 is not an `Address` from Kit:
   ```typescript
   // BAD: mixing types
   import { PublicKey } from "@solana/web3.js";
   import { setTransactionMessageFeePayer } from "@solana/kit";
   setTransactionMessageFeePayer(new PublicKey("..."), msg); // TYPE ERROR

   // GOOD: use Kit's address()
   import { address } from "@solana/kit";
   setTransactionMessageFeePayer(address("..."), msg);
   ```

## Transaction Confirmation Hangs Indefinitely

**Symptoms:**
- `sendAndConfirmTransaction` never resolves
- No timeout, just infinite waiting
- Works with v1's `confirmTransaction` but not Kit

**Solutions:**

1. **Use `AbortController` for timeouts.** Kit doesn't have built-in timeouts:
   ```typescript
   const abortController = new AbortController();
   setTimeout(() => abortController.abort(), 30_000); // 30s timeout

   try {
     await sendAndConfirmTransactionFactory({
       rpc,
       rpcSubscriptions,
     })(transaction, {
       commitment: "confirmed",
       abortSignal: abortController.signal,
     });
   } catch (err) {
     if (err.name === "AbortError") {
       console.error("Transaction confirmation timed out");
     }
     throw err;
   }
   ```

2. **Ensure WebSocket RPC is configured.** Kit uses subscriptions for confirmations:
   ```typescript
   import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

   const rpc = createSolanaRpc("https://api.mainnet-beta.solana.com");
   // WebSocket endpoint required for confirmations
   const rpcSubscriptions = createSolanaRpcSubscriptions(
     "wss://api.mainnet-beta.solana.com",
   );
   ```

## `@solana/compat` Adapter Issues

**Symptoms:**
- Errors converting between v1 and Kit types
- `fromLegacyPublicKey` or `fromLegacyKeypair` not found

**Solutions:**

1. **Install the compat package separately:**
   ```bash
   npm install @solana/compat
   ```

2. **Use correct conversion functions:**
   ```typescript
   import {
     fromLegacyPublicKey,
     toLegacyPublicKey,
     fromLegacyKeypair,
   } from "@solana/compat";

   // v1 PublicKey → Kit Address
   const kitAddress = fromLegacyPublicKey(legacyPubkey);

   // Kit Address → v1 PublicKey
   const v1Pubkey = toLegacyPublicKey(kitAddress);

   // v1 Keypair → Kit KeyPairSigner
   const kitSigner = fromLegacyKeypair(legacyKeypair);
   ```

3. **Compat layer only covers core types.** Transaction objects cannot be directly converted -- rebuild transactions using Kit's API.

## BigInt Serialization Errors in API Responses

**Symptoms:**
- `TypeError: Do not know how to serialize a BigInt`
- Happens when `JSON.stringify()` encounters Kit's native BigInt values

**Solutions:**

Kit uses native `BigInt` for all amounts (unlike v1's `BN.js`). BigInt is not JSON-serializable by default:

```typescript
// BAD: direct serialization
JSON.stringify({ balance: 1000000000n }); // THROWS

// GOOD: custom replacer
JSON.stringify(data, (_, value) =>
  typeof value === "bigint" ? value.toString() : value,
);

// GOOD: convert before serialization
const response = {
  balance: balance.toString(),
  lamports: Number(lamports), // only safe for small values
};
```

## Anchor Compatibility

**Symptoms:**
- Anchor client code breaks after Kit migration
- `@coral-xyz/anchor` requires `@solana/web3.js` v1 Connection

**Solutions:**

As of early 2026, Anchor does not natively support Kit. Use the hybrid approach:

```typescript
// Keep v1 for Anchor interactions
import { Connection } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";

const v1Connection = new Connection(rpcUrl);
const program = new Program(idl, programId, provider);

// Use Kit for non-Anchor operations
import { createSolanaRpc } from "@solana/kit";

const rpc = createSolanaRpc(rpcUrl);
const balance = await rpc.getBalance(address(wallet)).send();
```

## Tree-Shaking Not Working (Bundle Still Large)

**Symptoms:**
- Expected smaller bundle size but it's similar to v1
- Webpack/Vite not eliminating unused code

**Solutions:**

1. **Import from specific sub-packages, not the barrel export:**
   ```typescript
   // BAD: imports everything
   import { createSolanaRpc, address, pipe } from "@solana/kit";

   // GOOD: tree-shakeable sub-package imports
   import { createSolanaRpc } from "@solana/rpc";
   import { address } from "@solana/addresses";
   import { pipe } from "@solana/functional";
   ```

2. **Configure bundler for ESM:**
   ```json
   // package.json
   { "type": "module" }
   ```

3. **Use `sideEffects: false` in your package.json** if publishing a library that re-exports Kit.
