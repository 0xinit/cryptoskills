# PDA Derivation

Derive Program Derived Addresses (PDAs) on-chain with Anchor and off-chain with `@solana/web3.js`. Covers canonical bumps, multi-seed PDAs, and PDA-to-PDA derivation.

## Anchor Program — Vault with PDA

```rust
use anchor_lang::prelude::*;

declare_id!("Vau1tPDA111111111111111111111111111111111111");

#[program]
pub mod pda_vault {
    use super::*;

    pub fn create_vault(ctx: Context<CreateVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.bump = ctx.bumps.vault;
        vault.balance = 0;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        // Transfer SOL from depositor to vault PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &vault.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.authority.to_account_info(),
                vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        vault.balance = vault.balance.checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(vault.balance >= amount, ErrorCode::InsufficientBalance);

        // PDA signs to transfer SOL back
        **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += amount;

        vault.balance = vault.balance.checked_sub(amount)
            .ok_or(ErrorCode::Overflow)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault", authority.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority,
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub authority: Pubkey,
    pub bump: u8,
    pub balance: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient balance in vault")]
    InsufficientBalance,
    #[msg("Arithmetic overflow")]
    Overflow,
}
```

## TypeScript Client — Derive and Interact

```typescript
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import type { PdaVault } from "../target/types/pda_vault";
import idl from "../target/idl/pda_vault.json";

const PROGRAM_ID = new PublicKey("Vau1tPDA111111111111111111111111111111111111");

function deriveVaultPDA(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), authority.toBuffer()],
    PROGRAM_ID
  );
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program<PdaVault>(idl as PdaVault, PROGRAM_ID, provider);

  const [vaultPDA, bump] = deriveVaultPDA(wallet.publicKey);
  console.log("Vault PDA:", vaultPDA.toBase58());
  console.log("Canonical bump:", bump);

  // Create vault
  const txCreate = await program.methods
    .createVault()
    .accounts({
      vault: vaultPDA,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("Created vault:", txCreate);

  // Deposit 0.1 SOL
  const depositAmount = new BN(100_000_000); // 0.1 SOL in lamports
  const txDeposit = await program.methods
    .deposit(depositAmount)
    .accounts({
      vault: vaultPDA,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("Deposited:", txDeposit);

  // Read vault state
  const vaultAccount = await program.account.vault.fetch(vaultPDA);
  console.log("Vault balance:", vaultAccount.balance.toString(), "lamports");
  console.log("Vault authority:", vaultAccount.authority.toBase58());
  console.log("Stored bump:", vaultAccount.bump);
}

main().catch(console.error);
```

## Multi-Seed PDA Example

PDAs can use multiple seeds for namespacing. A common pattern is user + protocol + identifier.

```rust
#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct CreatePosition<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Position::INIT_SPACE,
        seeds = [
            b"position",
            pool.key().as_ref(),
            user.key().as_ref(),
            &pool_id.to_le_bytes(),
        ],
        bump,
    )]
    pub position: Account<'info, Position>,
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

```typescript
// Client-side derivation must match seed order and encoding exactly
const [positionPDA] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("position"),
    poolPublicKey.toBuffer(),
    userPublicKey.toBuffer(),
    new BN(poolId).toArrayLike(Buffer, "le", 8),
  ],
  programId
);
```

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Wrong seed order | Different PDA derived | Match program seed order exactly |
| `toBase58()` instead of `toBuffer()` for pubkey seed | Wrong bytes | Always use `.toBuffer()` for pubkey seeds |
| Not storing bump in account | Recompute every instruction (wastes CU) | Store bump in account data, use `bump = account.bump` |
| Using `create_program_address` with arbitrary bump | May produce valid keypair address | Always use `find_program_address` for canonical bump |

Last verified: 2026-03-01
