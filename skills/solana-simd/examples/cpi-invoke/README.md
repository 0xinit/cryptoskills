# Cross-Program Invocation (CPI)

Demonstrates `invoke` (pass-through signing) and `invoke_signed` (PDA signing) patterns with Anchor. Covers SPL Token transfers, system program calls, and multi-level CPI chains.

## Anchor — Token Transfer via CPI (User Signs)

When a user's wallet authorizes the transfer, use a standard CPI. The signer privilege passes through from the transaction.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("CpiDemo1111111111111111111111111111111111111");

#[program]
pub mod cpi_demo {
    use super::*;

    pub fn transfer_user_tokens(
        ctx: Context<TransferUserTokens>,
        amount: u64,
    ) -> Result<()> {
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token.to_account_info(),
            to: ctx.accounts.destination_token.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct TransferUserTokens<'info> {
    #[account(
        mut,
        token::authority = user,
    )]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination_token: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
```

## Anchor — PDA-Signed Token Transfer (invoke_signed)

When a PDA-controlled vault needs to transfer tokens, the program signs on behalf of the PDA using `invoke_signed` (Anchor wraps this with `CpiContext::new_with_signer`).

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

declare_id!("VaultCPI111111111111111111111111111111111111");

#[program]
pub mod vault_cpi {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.bump = ctx.bumps.vault;
        vault.token_bump = ctx.bumps.vault_token;
        Ok(())
    }

    pub fn withdraw_from_vault(
        ctx: Context<WithdrawFromVault>,
        amount: u64,
    ) -> Result<()> {
        // PDA signs the token transfer
        let authority_key = ctx.accounts.authority.key();
        let seeds = &[
            b"vault".as_ref(),
            authority_key.as_ref(),
            &[ctx.accounts.vault.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token.to_account_info(),
            to: ctx.accounts.user_token.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + VaultState::INIT_SPACE,
        seeds = [b"vault", authority.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, VaultState>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
        seeds = [b"vault_token", authority.key().as_ref()],
        bump,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct WithdrawFromVault<'info> {
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority,
    )]
    pub vault: Account<'info, VaultState>,
    #[account(
        mut,
        seeds = [b"vault_token", authority.key().as_ref()],
        bump = vault.token_bump,
        token::authority = vault,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub authority: Pubkey,
    pub bump: u8,
    pub token_bump: u8,
}
```

## TypeScript Client — CPI Interaction

```typescript
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import type { VaultCpi } from "../target/types/vault_cpi";
import idl from "../target/idl/vault_cpi.json";

const PROGRAM_ID = new PublicKey("VaultCPI111111111111111111111111111111111111");

async function withdrawFromVault(
  program: Program<VaultCpi>,
  authority: Keypair,
  mint: PublicKey,
  amount: number
) {
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), authority.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const [vaultTokenPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_token"), authority.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const userToken = await getAssociatedTokenAddress(
    mint,
    authority.publicKey
  );

  const tx = await program.methods
    .withdrawFromVault(new BN(amount))
    .accounts({
      vault: vaultPDA,
      vaultToken: vaultTokenPDA,
      userToken,
      authority: authority.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([authority])
    .rpc();

  console.log("Withdraw tx:", tx);
}
```

## Raw `invoke` and `invoke_signed` (Without Anchor)

For native Solana programs (no Anchor), use the raw instruction interface.

```rust
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program::invoke_signed,
    pubkey::Pubkey,
};

pub fn process_pda_transfer(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let source = next_account_info(accounts_iter)?;
    let destination = next_account_info(accounts_iter)?;
    let pda = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;

    // Derive PDA and verify
    let (expected_pda, bump) = Pubkey::find_program_address(
        &[b"authority"],
        program_id,
    );
    assert_eq!(*pda.key, expected_pda);

    let seeds = &[b"authority".as_ref(), &[bump]];
    let signer_seeds = &[&seeds[..]];

    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            source.key,
            destination.key,
            pda.key,
            &[],
            amount,
        )?,
        &[source.clone(), destination.clone(), pda.clone()],
        signer_seeds,
    )?;

    Ok(())
}
```

## CPI Depth and Compute Budget

| Level | Description | Available CU |
|-------|-------------|-------------|
| 0 | Top-level instruction | Full budget |
| 1 | First CPI | Reduced |
| 2 | Second CPI | Further reduced |
| 3 | Third CPI | Minimal |
| 4 | Max depth | Almost none |
| 5+ | **Fails** | N/A |

Each CPI level consumes compute units for the invocation overhead. Design programs to minimize CPI depth. If you need program A to call program B to call program C, consider whether A can call B and C directly in separate instructions within the same transaction.

Last verified: 2026-03-01
