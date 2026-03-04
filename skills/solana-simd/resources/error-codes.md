# Solana Program Error Codes

## System Program Errors

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| 0 | `AccountAlreadyInUse` | Account already has data or lamports | Use a different keypair or PDA |
| 1 | `ResultWithNegativeLamports` | Would produce negative balance | Check balance before debit |
| 2 | `InvalidProgramId` | Wrong program ID | Verify program deploys to expected address |
| 3 | `InvalidAccountDataLength` | Data size mismatch | Match expected account size |
| 4 | `MaxSeedLengthExceeded` | PDA seed > 32 bytes | Shorten seeds (max 32 bytes each) |
| 5 | `AddressWithSeedMismatch` | PDA does not match expected | Verify seeds and program ID |
| 6 | `NonceNoRecentBlockhashes` | Nonce account has no blockhash | Advance nonce first |
| 7 | `NonceBlockhashNotExpired` | Nonce blockhash still valid | Wait for blockhash to expire |
| 8 | `NonceUnexpectedBlockhashValue` | Stale nonce value | Fetch current nonce value |

## SPL Token Errors

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| 0 | `NotRentExempt` | Account below rent-exempt minimum | Fund account sufficiently |
| 1 | `InsufficientFunds` | Not enough tokens | Check balance before transfer |
| 2 | `InvalidMint` | Mint account invalid | Verify mint address |
| 3 | `MintMismatch` | Token account mint != expected mint | Use correct token account for the mint |
| 4 | `OwnerMismatch` | Token account owner mismatch | Verify token account authority |
| 5 | `FixedSupply` | Mint has no authority | Cannot mint more (authority is None) |
| 6 | `AlreadyInUse` | Account already initialized | Use uninitialized account |
| 7 | `InvalidNumberOfProvidedSigners` | Wrong signer count for multisig | Provide correct number of signers |
| 8 | `InvalidNumberOfRequiredSigners` | Multisig threshold invalid | Threshold must be <= total signers |
| 9 | `UninitializedState` | Account not initialized | Initialize account first |
| 10 | `NativeNotSupported` | Operation not supported for native SOL | Use System Program for SOL operations |
| 11 | `NonNativeHasBalance` | Closing account with balance | Transfer all tokens out first |
| 12 | `InvalidInstruction` | Malformed instruction data | Check instruction format |
| 13 | `InvalidState` | Account in wrong state | Verify account state before operation |
| 14 | `Overflow` | Arithmetic overflow | Use checked math |
| 15 | `AuthorityTypeNotSupported` | Unsupported authority operation | Check token program capabilities |
| 16 | `MintCannotFreeze` | Mint has no freeze authority | Set freeze authority at mint init |
| 17 | `AccountFrozen` | Token account is frozen | Thaw account before operation |
| 18 | `MintDecimalsMismatch` | Decimals don't match | Use correct decimals for the mint |

## Anchor Framework Errors

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| 100 | `InstructionMissing` | No instruction data | Include instruction discriminator |
| 101 | `InstructionFallbackNotFound` | Unknown instruction | Check method name in IDL |
| 102 | `InstructionDidNotDeserialize` | Bad instruction data | Match IDL argument types |
| 1000 | `InstructionDidNotSerialize` | Serialization failed | Check data types |
| 2000 | `IdlInstructionStub` | IDL instruction not implemented | Implement the function |
| 2001 | `IdlInstructionInvalidProgram` | Wrong program for IDL op | Use correct program ID |
| 2006 | `ConstraintMut` | Account not mutable | Add `#[account(mut)]` |
| 2003 | `ConstraintHasOne` | `has_one` check failed | Account field doesn't match expected |
| 2004 | `ConstraintSigner` | Missing signer | Account must be a transaction signer |
| 2006 | `ConstraintMut` | Not marked mutable | Add `mut` to account constraint |
| 2011 | `ConstraintOwner` | Wrong program owner | Account owned by unexpected program |
| 2012 | `ConstraintRentExempt` | Below rent-exempt minimum | Add sufficient lamports |
| 2014 | `ConstraintSeeds` | PDA seeds mismatch | Verify seeds match constraint |
| 2016 | `ConstraintSpace` | Insufficient space | Increase `space` in `init` |
| 2019 | `ConstraintTokenMint` | Token account mint mismatch | Use correct mint |
| 2020 | `ConstraintTokenOwner` | Token account owner mismatch | Use correct owner |
| 3000 | `AccountDiscriminatorAlreadySet` | Account already initialized | Use `init_if_needed` or check first |
| 3001 | `AccountDiscriminatorNotFound` | Missing 8-byte discriminator | Account may not be initialized |
| 3002 | `AccountDiscriminatorMismatch` | Wrong account type | Verify account type matches |
| 3003 | `AccountDidNotDeserialize` | Deserialization failed | Check account data format |
| 3004 | `AccountDidNotSerialize` | Serialization failed | Check data types |
| 3005 | `AccountNotEnoughKeys` | Missing accounts | Pass all required accounts |
| 3007 | `AccountNotProgramOwned` | Account not owned by program | Verify account ownership |
| 3012 | `AccountNotInitialized` | Expected initialized account | Initialize first |
| 3014 | `AccountOwnedByWrongProgram` | Wrong owner program | Check `owner` constraint |

## Transaction-Level Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `BlockhashNotFound` | Blockhash expired (~90 seconds) | Refetch blockhash, resubmit |
| `InsufficientFundsForFee` | Cannot pay transaction fee | Fund payer with SOL |
| `InvalidAccountIndex` | Account index out of bounds | Check account list length |
| `ProgramFailedToComplete` | Compute budget exceeded | Increase CU limit or optimize |
| `TransactionTooLarge` | Exceeds 1,232 bytes | Use versioned tx + ALT |
| `DuplicateInstruction` | Same instruction twice | Remove duplicate |
| `AccountInUse` | Write lock conflict | Retry or serialize access |
| `AccountLoadedTwice` | Same account in tx twice | Reference account once |

## Decoding Custom Program Errors

```typescript
import { SendTransactionError } from "@solana/web3.js";

function decodeError(err: unknown): string {
  if (err instanceof SendTransactionError) {
    const logs = err.logs ?? [];
    // Look for "Program log: AnchorError" or "Program log: Error"
    const errorLog = logs.find(
      (log) => log.includes("AnchorError") || log.includes("Error Code:")
    );
    if (errorLog) return errorLog;

    // Look for custom program error number
    const customErr = logs.find((log) =>
      log.includes("custom program error:")
    );
    if (customErr) {
      const match = customErr.match(/custom program error: (0x[0-9a-fA-F]+)/);
      if (match) {
        const code = parseInt(match[1], 16);
        return `Custom error code: ${code} (${match[1]})`;
      }
    }
  }
  return String(err);
}
```

Last verified: 2026-03-01
