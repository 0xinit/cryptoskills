# Token Extensions (Token-2022)

Create and interact with Token-2022 mints using transfer fees, non-transferable (soulbound) tokens, and metadata pointer extensions. All examples use `@solana/spl-token` with the Token-2022 program.

## Create Mint with Transfer Fee

Every transfer of this token automatically withholds a percentage as a fee that the withdraw authority can collect.

```typescript
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
  ExtensionType,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

async function createTransferFeeMint(
  connection: Connection,
  payer: Keypair,
  decimals: number,
  feeBasisPoints: number,
  maxFee: bigint
): Promise<Keypair> {
  const mintKeypair = Keypair.generate();
  const extensions = [ExtensionType.TransferFeeConfig];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferFeeConfigInstruction(
      mintKeypair.publicKey,
      payer.publicKey,   // transferFeeConfigAuthority
      payer.publicKey,   // withdrawWithheldAuthority
      feeBasisPoints,    // fee in basis points (100 = 1%)
      maxFee,            // max fee cap in base units
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      payer.publicKey,   // mintAuthority
      payer.publicKey,   // freezeAuthority
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair]);
  console.log("Mint with transfer fee:", mintKeypair.publicKey.toBase58());
  return mintKeypair;
}

// Usage: 1% fee, max 1000 tokens (with 9 decimals)
// createTransferFeeMint(connection, payer, 9, 100, 1_000_000_000_000n);
```

## Create Non-Transferable (Soulbound) Token

Non-transferable tokens cannot be moved after minting. Useful for credentials, certifications, and reputation.

```typescript
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeNonTransferableMintInstruction,
  getMintLen,
  ExtensionType,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

async function createSoulboundToken(
  connection: Connection,
  payer: Keypair,
  recipient: Keypair
): Promise<void> {
  const mintKeypair = Keypair.generate();
  const extensions = [ExtensionType.NonTransferable];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  // Step 1: Create mint with non-transferable extension
  const createMintTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeNonTransferableMintInstruction(
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      0,                 // 0 decimals for NFT-like tokens
      payer.publicKey,
      null,              // no freeze authority
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, createMintTx, [payer, mintKeypair]);

  // Step 2: Create ATA for recipient and mint
  const recipientATA = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const mintTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      recipientATA,
      recipient.publicKey,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createMintToInstruction(
      mintKeypair.publicKey,
      recipientATA,
      payer.publicKey,
      1,                  // mint exactly 1
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, mintTx, [payer]);
  console.log("Soulbound token minted to:", recipient.publicKey.toBase58());
  // Any attempt to transfer this token will fail
}
```

## Create Mint with Metadata Pointer

Metadata pointer stores token metadata directly in the mint account, eliminating the need for Metaplex.

```typescript
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  getMintLen,
  ExtensionType,
  TYPE_SIZE,
  LENGTH_SIZE,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";

async function createMintWithMetadata(
  connection: Connection,
  payer: Keypair,
  name: string,
  symbol: string,
  uri: string
): Promise<Keypair> {
  const mintKeypair = Keypair.generate();

  const metadata: TokenMetadata = {
    mint: mintKeypair.publicKey,
    name,
    symbol,
    uri,
    additionalMetadata: [],
  };

  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const totalLen = mintLen + metadataLen;
  const lamports = await connection.getMinimumBalanceForRentExemption(totalLen);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen, // initial space excludes metadata
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mintKeypair.publicKey,
      payer.publicKey,          // metadata update authority
      mintKeypair.publicKey,    // metadata address (self for embedded)
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      9,
      payer.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mintKeypair.publicKey,
      metadata: mintKeypair.publicKey,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      mintAuthority: payer.publicKey,
      updateAuthority: payer.publicKey,
    })
  );

  await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair]);
  console.log("Mint with metadata:", mintKeypair.publicKey.toBase58());
  return mintKeypair;
}
```

## Anchor — Accept Both SPL Token and Token-2022

Programs that need to work with both token standards must validate the token program dynamically.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Mint, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("DualTkn1111111111111111111111111111111111111");

#[program]
pub mod dual_token {
    use super::*;

    /// Transfer tokens using whichever token program owns the mint
    pub fn transfer_any_token(
        ctx: Context<TransferAnyToken>,
        amount: u64,
    ) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.source.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct TransferAnyToken<'info> {
    #[account(mut)]
    pub source: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}
```

Key Anchor types for Token-2022 compatibility:
- `InterfaceAccount<'info, TokenAccount>` instead of `Account<'info, TokenAccount>`
- `InterfaceAccount<'info, Mint>` instead of `Account<'info, Mint>`
- `Interface<'info, TokenInterface>` instead of `Program<'info, Token>`
- `transfer_checked` instead of `transfer` (required by Token-2022)

## Extension Compatibility Matrix

| Extension | Composable with | Incompatible with |
|-----------|----------------|-------------------|
| Transfer Fee | Metadata Pointer, Interest-Bearing | Confidential Transfers |
| Non-Transferable | Metadata Pointer | Transfer Fee, Permanent Delegate |
| Metadata Pointer | Transfer Fee, Non-Transferable, Interest-Bearing | None |
| Permanent Delegate | Transfer Fee, Metadata Pointer | Non-Transferable |
| Interest-Bearing | Metadata Pointer, Transfer Fee | Confidential Transfers |
| Confidential Transfers | Metadata Pointer | Transfer Fee, Interest-Bearing |

Last verified: 2026-03-01
