// Anchor Program Starter Template
//
// Usage:
//   1. anchor init my_program && cd my_program
//   2. Replace programs/my_program/src/lib.rs with this file
//   3. Update declare_id! with your program ID
//   4. anchor build && anchor test
//
// Features demonstrated:
//   - PDA creation with canonical bump storage
//   - CPI to SPL Token program (PDA-signed transfer)
//   - Account validation constraints
//   - Custom error codes

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

declare_id!("11111111111111111111111111111111");

#[program]
pub mod my_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, vault_name: String) -> Result<()> {
        require!(vault_name.len() <= 32, MyError::NameTooLong);

        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.bump = ctx.bumps.vault;
        vault.name = vault_name;
        vault.total_deposits = 0;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, MyError::ZeroAmount);

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token.to_account_info(),
            to: ctx.accounts.vault_token.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        token::transfer(cpi_ctx, amount)?;

        let vault = &mut ctx.accounts.vault;
        vault.total_deposits = vault.total_deposits
            .checked_add(amount)
            .ok_or(MyError::Overflow)?;

        emit!(DepositEvent {
            vault: vault.key(),
            depositor: ctx.accounts.authority.key(),
            amount,
            total: vault.total_deposits,
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, MyError::ZeroAmount);

        let vault = &mut ctx.accounts.vault;
        require!(vault.total_deposits >= amount, MyError::InsufficientBalance);

        // PDA signs the token transfer
        let authority_key = ctx.accounts.authority.key();
        let seeds = &[
            b"vault".as_ref(),
            authority_key.as_ref(),
            &[vault.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_token.to_account_info(),
            to: ctx.accounts.user_token.to_account_info(),
            authority: vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, amount)?;

        vault.total_deposits = vault.total_deposits
            .checked_sub(amount)
            .ok_or(MyError::Overflow)?;

        emit!(WithdrawEvent {
            vault: vault.key(),
            withdrawer: ctx.accounts.authority.key(),
            amount,
            remaining: vault.total_deposits,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(vault_name: String)]
pub struct Initialize<'info> {
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
        has_one = authority,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        token::authority = authority,
    )]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = user_token.mint,
        token::authority = vault,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
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
    #[account(
        mut,
        token::mint = user_token.mint,
        token::authority = vault,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
    )]
    pub user_token: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub authority: Pubkey,
    pub bump: u8,
    #[max_len(32)]
    pub name: String,
    pub total_deposits: u64,
}

#[event]
pub struct DepositEvent {
    pub vault: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
    pub total: u64,
}

#[event]
pub struct WithdrawEvent {
    pub vault: Pubkey,
    pub withdrawer: Pubkey,
    pub amount: u64,
    pub remaining: u64,
}

#[error_code]
pub enum MyError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Vault name exceeds 32 characters")]
    NameTooLong,
    #[msg("Insufficient balance in vault")]
    InsufficientBalance,
    #[msg("Arithmetic overflow")]
    Overflow,
}
