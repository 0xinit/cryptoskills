# Solana Kit Migration Checklist

Step-by-step checklist for migrating a project from `@solana/web3.js` (v1) to `@solana/kit`.

## Phase 0: Pre-Migration Assessment

- [ ] **Node.js version** >= 18.0.0
- [ ] **TypeScript version** >= 5.0
- [ ] **No Anchor dependency** (Anchor doesn't support Kit yet -- use hybrid if needed)
- [ ] **List all `@solana/web3.js` imports** across the codebase
- [ ] **Count migration points** (Connection, Keypair, PublicKey, Transaction usages)
- [ ] **Check third-party SDK compatibility** -- do your dependencies support Kit?
- [ ] **Decision**: Full migration / Gradual (with `@solana/compat`) / Hybrid / Wait

## Phase 1: Setup

- [ ] Install Kit packages:
  ```bash
  npm install @solana/kit
  # For gradual migration:
  npm install @solana/compat
  ```
- [ ] Update `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "module": "ESNext",
      "moduleResolution": "bundler",
      "target": "ES2022"
    }
  }
  ```
- [ ] Ensure bundler supports ESM tree-shaking

## Phase 2: Core Type Migration

### Connection → RPC

- [ ] Replace `new Connection(url)` with `createSolanaRpc(url)`
- [ ] Add WebSocket RPC: `createSolanaRpcSubscriptions(wssUrl)`
- [ ] Update all RPC calls to use `.send()` pattern:
  ```typescript
  // Before
  const balance = await connection.getBalance(pubkey);
  // After
  const { value: balance } = await rpc.getBalance(address).send();
  ```

### PublicKey → Address

- [ ] Replace `new PublicKey("...")` with `address("...")`
- [ ] Replace `PublicKey.findProgramAddressSync()` with `getProgramDerivedAddress()`
- [ ] Update type annotations: `PublicKey` → `Address`

### Keypair → KeyPairSigner

- [ ] Replace `Keypair.fromSecretKey()` with `createKeyPairSignerFromBytes()`
- [ ] Replace `Keypair.generate()` with `generateKeyPairSigner()`
- [ ] Update signer references throughout

### Transaction Building

- [ ] Replace `new Transaction()` / `new VersionedTransaction()` with `pipe()` chain:
  ```typescript
  const tx = pipe(
    createTransactionMessage({ version: 0 }),
    (msg) => setTransactionMessageFeePayer(feePayer, msg),
    (msg) => setTransactionMessageLifetimeUsingBlockhash(blockhash, msg),
    (msg) => appendTransactionMessageInstruction(instruction, msg),
  );
  ```
- [ ] Replace `transaction.sign()` with `signTransaction()`
- [ ] Replace `connection.sendTransaction()` with `sendAndConfirmTransactionFactory()`

### Numeric Types

- [ ] Replace `BN` / `number` for lamports with native `BigInt`
- [ ] Update arithmetic: `amount.add(fee)` → `amount + fee`
- [ ] Add `BigInt` serialization handler for JSON APIs

## Phase 3: Instruction Migration

- [ ] Replace `TransactionInstruction` with `IInstruction` type
- [ ] Update instruction construction to use Kit's typed interface:
  ```typescript
  const instruction: IInstruction = {
    programAddress: address("11111111111111111111111111111111"),
    accounts: [
      { address: from, role: AccountRole.WRITABLE_SIGNER },
      { address: to, role: AccountRole.WRITABLE },
    ],
    data: new Uint8Array([2, 0, 0, 0, ...encodedAmount]),
  };
  ```

## Phase 4: Program-Specific Updates

- [ ] **System Program**: Use `@solana-program/system` package
- [ ] **Token Program**: Use `@solana-program/token` package
- [ ] **Associated Token**: Use `@solana-program/associated-token-account`
- [ ] **Memo Program**: Use `@solana-program/memo`

## Phase 5: Testing

- [ ] Run existing test suite -- all tests pass
- [ ] Verify transaction signing produces valid signatures
- [ ] Test on devnet before mainnet
- [ ] Verify WebSocket subscriptions work (confirmations, account changes)
- [ ] Check bundle size reduction (expect ~26% smaller)

## Phase 6: Cleanup

- [ ] Remove `@solana/web3.js` from `package.json` (if full migration)
- [ ] Remove `@solana/compat` (if gradual migration is complete)
- [ ] Remove unused type imports
- [ ] Update documentation and README
- [ ] Update CI/CD if Node version changed

## Quick Reference: Import Mapping

| v1 Import | Kit Import |
|-----------|-----------|
| `Connection` | `createSolanaRpc` / `createSolanaRpcSubscriptions` |
| `PublicKey` | `address()` / `Address` type |
| `Keypair` | `generateKeyPairSigner()` / `createKeyPairSignerFromBytes()` |
| `Transaction` | `createTransactionMessage()` + `pipe()` |
| `SystemProgram.transfer()` | `getTransferSolInstruction()` |
| `TOKEN_PROGRAM_ID` | `address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")` |
| `sendAndConfirmTransaction()` | `sendAndConfirmTransactionFactory()` |
| `LAMPORTS_PER_SOL` | `lamports(1_000_000_000n)` |
