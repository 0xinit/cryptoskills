# Solana SIMD Troubleshooting

## Transaction Too Large

```
Transaction too large: 1644 > 1232
```

**Cause**: Legacy transactions are limited to 1,232 bytes. Too many accounts or instruction data pushes past this limit.

**Fix**: Use versioned transactions with Address Lookup Tables (ALTs) to compress account references.

```typescript
import { TransactionMessage, VersionedTransaction } from "@solana/web3.js";

const lookupTableAccount = await connection
  .getAddressLookupTable(lookupTableAddress)
  .then((res) => res.value);

const messageV0 = new TransactionMessage({
  payerKey: payer.publicKey,
  recentBlockhash: blockhash,
  instructions,
}).compileToV0Message([lookupTableAccount]);

const tx = new VersionedTransaction(messageV0);
```

If you don't have a lookup table, create one first. See `examples/priority-fees/` for the full pattern. ALTs take one epoch (~2 days) to become active after creation on mainnet.

## PDA Derivation Mismatch

```
Error: Account not found / seeds constraint was violated
```

**Cause**: Client-side PDA derivation does not match on-chain. Common reasons:
1. Seed order is wrong
2. Seed encoding differs (string vs pubkey bytes)
3. Using a non-canonical bump

**Fix**: Ensure seeds match exactly between client and program.

```typescript
// Client must match program seeds EXACTLY in order and encoding
const [pda, bump] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("vault"),           // string seed
    userPublicKey.toBuffer(),       // pubkey as 32 bytes
  ],
  programId
);
```

```rust
// On-chain Anchor constraint
#[account(
    seeds = [b"vault", authority.key().as_ref()],
    bump,
)]
pub vault: Account<'info, Vault>,
```

Checklist: (1) Same seed prefix string, (2) Same pubkey serialization, (3) Same program ID, (4) Using `findProgramAddressSync` not `createProgramAddressSync`.

## CPI Depth Exceeded

```
Cross-program invocation with unauthorized signer or writable account
Program returned error: exceeded CPI call depth
```

**Cause**: CPI call chain exceeds 4 levels. Program A -> B -> C -> D -> E fails at E.

**Fix**: Flatten your architecture. Common strategies:
- Combine logic into fewer programs
- Use instruction-level composition instead of CPI chains (multiple instructions in one transaction)
- Pass pre-computed results as instruction data instead of calling intermediary programs

## Priority Fee Too Low / Transaction Not Landing

```
Transaction simulation failed: Blockhash not found
```

**Cause**: Transaction expired before being included in a block. Usually because priority fee was too low during congestion.

**Fix**: Estimate fees using recent data, set both compute limit and price.

```typescript
const fees = await connection.getRecentPrioritizationFees({
  lockedWritableAccounts: [hotAccount],
});

const sorted = fees.map((f) => f.prioritizationFee).sort((a, b) => a - b);
const p75 = sorted[Math.floor(sorted.length * 0.75)];

tx.add(
  ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: p75 })
);
```

Also set `skipPreflight: false` and use `confirmed` commitment to catch simulation errors early.

## Token-2022 Incompatibility

```
Error: incorrect program id for instruction
```

**Cause**: Program hardcodes SPL Token program ID but receives a Token-2022 token account.

**Fix**: Accept both program IDs.

```rust
let valid = token_program.key() == spl_token::id()
    || token_program.key() == spl_token_2022::id();
require!(valid, MyError::InvalidTokenProgram);
```

On the client side, check which program owns the mint before building instructions:

```typescript
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

const mintInfo = await connection.getAccountInfo(mintAddress);
const tokenProgramId = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
  ? TOKEN_2022_PROGRAM_ID
  : TOKEN_PROGRAM_ID;
```

## Account Realloc Failures

```
memory allocation failed, out of memory
```

**Cause**: Attempting to increase account data by more than 10,240 bytes in a single instruction, or insufficient lamports for the new rent-exempt minimum.

**Fix**: Realloc in chunks of 10 KB max, and transfer additional lamports before or during realloc.

```rust
account_info.realloc(new_len, false)?;

let rent = Rent::get()?;
let new_min_balance = rent.minimum_balance(new_len);
let current_lamports = account_info.lamports();
if current_lamports < new_min_balance {
    // Transfer the difference from payer
    let diff = new_min_balance - current_lamports;
    invoke(
        &system_instruction::transfer(payer.key, account_info.key, diff),
        &[payer.clone(), account_info.clone()],
    )?;
}
```

## Anchor IDL Not Found

```
Error: IDL not found for program
```

**Cause**: The IDL was not published on-chain, or the program was deployed without `anchor deploy`.

**Fix**: Publish the IDL separately.

```bash
anchor idl init <program-id> --filepath target/idl/my_program.json --provider.cluster devnet
# Or update an existing IDL
anchor idl upgrade <program-id> --filepath target/idl/my_program.json --provider.cluster devnet
```

Last verified: 2026-03-01
