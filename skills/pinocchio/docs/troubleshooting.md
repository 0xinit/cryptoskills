# Pinocchio Troubleshooting Guide

Common issues and solutions when building Solana programs with Pinocchio.

## Program Fails to Build with `pinocchio` Features Error

**Symptoms:**
- Cargo build fails with unresolved feature flags
- Error mentions `bpf-entrypoint` or conflicting features

**Solutions:**

1. **Ensure correct feature configuration in `Cargo.toml`:**
   ```toml
   [features]
   default = []
   bpf-entrypoint = []

   [dependencies]
   pinocchio = "0.10"
   ```

2. **Build with the correct target and features:**
   ```bash
   # For on-chain deployment
   cargo build-sbf --features bpf-entrypoint

   # For tests (no BPF entrypoint)
   cargo test
   ```

3. **Don't enable `bpf-entrypoint` in default features** -- it conflicts with test builds since the entrypoint macro generates a `no_mangle` function that collides with test harnesses.

## Account Data Deserialization Panics

**Symptoms:**
- Program panics at runtime when reading account data
- `bytemuck` alignment or size errors
- `try_from_bytes` returns `PodCastError`

**Solutions:**

1. **Ensure `#[repr(C)]` on all structs:**
   ```rust
   #[repr(C)]
   #[derive(Clone, Copy, Pod, Zeroable)]
   pub struct MyAccount {
       pub discriminator: u8,
       pub owner: [u8; 32],
       pub value: u64,
       pub _padding: [u8; 7],  // Align total to 8 bytes
   }
   ```

2. **Add explicit padding to align fields.** Pinocchio uses zero-copy deserialization, so struct layout must match the on-chain data byte-for-byte. Use `std::mem::size_of::<MyAccount>()` to verify sizes.

3. **Check discriminator before casting:**
   ```rust
   let data = account.try_borrow_data()?;
   if data[0] != MY_DISCRIMINATOR {
       return Err(ProgramError::InvalidAccountData);
   }
   let my_account: &MyAccount = bytemuck::try_from_bytes(&data[..MyAccount::LEN])
       .map_err(|_| ProgramError::InvalidAccountData)?;
   ```

## Compute Unit Budget Exceeded

**Symptoms:**
- Transaction fails with "exceeded CUs meter"
- Works in test but fails on devnet/mainnet

**Solutions:**

1. **Use `solana_program::log::sol_log_compute_units()` to profile:**
   ```rust
   #[cfg(feature = "logging")]
   pinocchio::msg!("Before operation");
   // ... your operation ...
   #[cfg(feature = "logging")]
   pinocchio::msg!("After operation");
   ```

2. **Avoid heap allocations.** Pinocchio's strength is zero-copy -- if you're allocating `Vec` or `String` in hot paths, you're losing the advantage:
   ```rust
   // BAD: heap allocation
   let owners: Vec<Pubkey> = accounts.iter().map(|a| *a.key()).collect();

   // GOOD: iterate directly
   for account in accounts {
       if account.key() == expected_owner { /* ... */ }
   }
   ```

3. **Use `unsafe` accessor methods where safe versions add overhead:**
   ```rust
   // Safe but bounds-checked
   let key = account.key();

   // Unsafe but faster (skip bounds checks when you've already validated)
   let key = unsafe { account.key_unchecked() };
   ```
   Only use `unchecked` variants after thorough validation at the instruction entry point.

## CPI (Cross-Program Invocation) Fails

**Symptoms:**
- CPI to System Program or Token Program returns `ProgramError`
- "Instruction modified an account not owned by the program"
- Signer privilege escalation error

**Solutions:**

1. **Use `pinocchio-system` and `pinocchio-token` helpers** instead of raw CPI:
   ```rust
   use pinocchio_system::instructions::Transfer;

   Transfer {
       from: source_account,
       to: destination_account,
   }
   .invoke_signed(&[signer_seeds])?;
   ```

2. **Pass accounts in the correct order.** CPI account ordering must match the target program's expectation. Check the program's instruction layout.

3. **Ensure PDA signer seeds are correct:**
   ```rust
   // Derive PDA
   let (pda, bump) = Pubkey::find_program_address(
       &[b"vault", user.key().as_ref()],
       program_id,
   );

   // CPI with PDA signing -- include bump as single-byte slice
   let signer_seeds: &[&[u8]] = &[b"vault", user.key().as_ref(), &[bump]];
   ```

## Migration from Anchor: Missing Discriminator

**Symptoms:**
- Pinocchio program can't read accounts created by Anchor
- First 8 bytes don't match expected discriminator

**Solutions:**

Anchor uses an 8-byte SHA256 discriminator (`sha256("account:AccountName")[..8]`), while Pinocchio typically uses a 1-byte discriminator. If migrating:

```rust
// Read Anchor-created accounts
const ANCHOR_DISCRIMINATOR_LEN: usize = 8;

let data = account.try_borrow_data()?;
let anchor_disc = &data[..ANCHOR_DISCRIMINATOR_LEN];

// Verify against expected Anchor discriminator
let expected = &solana_program::hash::hash(
    format!("account:{}", "MyAnchorAccount").as_bytes()
).to_bytes()[..8];

if anchor_disc != expected {
    return Err(ProgramError::InvalidAccountData);
}

// Deserialize after the 8-byte discriminator
let my_data: &MyData = bytemuck::try_from_bytes(
    &data[ANCHOR_DISCRIMINATOR_LEN..ANCHOR_DISCRIMINATOR_LEN + MyData::LEN]
).map_err(|_| ProgramError::InvalidAccountData)?;
```

## Program Deploy Fails: Binary Too Large

**Symptoms:**
- `solana program deploy` fails with size error
- Binary exceeds max program size

**Solutions:**

1. **Verify release profile optimizations:**
   ```toml
   [profile.release]
   overflow-checks = true
   lto = "fat"
   codegen-units = 1
   opt-level = 3
   strip = true
   ```

2. **Remove debug logging in release builds:**
   ```rust
   #[cfg(feature = "logging")]
   pinocchio::msg!("Debug info: {}", value);
   ```

3. **Use `cargo build-sbf` instead of `cargo build`** -- it applies BPF-specific optimizations.

4. **If still too large**, break the program into multiple programs and use CPI between them.

## Tests Pass Locally but Fail on Devnet

**Symptoms:**
- `cargo test` succeeds
- Deployed program fails with different behavior

**Solutions:**

1. **Use `solana-program-test` for integration tests** that simulate the runtime accurately:
   ```rust
   #[cfg(test)]
   mod tests {
       use solana_program_test::*;
       use solana_sdk::{signature::Signer, transaction::Transaction};

       #[tokio::test]
       async fn test_initialize() {
           let program_id = Pubkey::new_unique();
           let mut context = ProgramTest::new(
               "my_program",
               program_id,
               processor!(process_instruction),
           )
           .start_with_context()
           .await;

           // Build and send transaction ...
       }
   }
   ```

2. **Account sizes differ between test and deployment.** In tests, `ProgramTest` may auto-create accounts with different sizes than production. Always verify account data length before deserialization.

3. **Clock and slot values differ.** Don't hardcode slot expectations -- use `Clock::get()` at runtime.
