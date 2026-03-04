# Solana Account Sizes and Rent Costs

## Common Account Sizes

Rent-exempt minimum calculated at ~0.00089088 SOL per byte base + 128 bytes overhead. Formula: `rent.minimum_balance(data_len)` where the runtime adds a fixed overhead.

| Account Type | Data Size (bytes) | Rent-Exempt Minimum (SOL) |
|-------------|-------------------|--------------------------|
| System account (wallet) | 0 | 0.00089088 |
| SPL Token Mint | 82 | 0.00144768 |
| SPL Token Account | 165 | 0.00203928 |
| Associated Token Account | 165 | 0.00203928 |
| Token-2022 Mint (base) | 82 | 0.00144768 |
| Token-2022 Mint + Transfer Fee | 178 | 0.00213408 |
| Token-2022 Mint + Metadata Pointer | 114 | 0.00167616 |
| Token-2022 Mint + Non-Transferable | 83 | 0.00145480 |
| Anchor account (8-byte discriminator) | 8 + data | varies |
| Address Lookup Table | 56 + (32 * num_addresses) | varies |

## Rent Calculation

```typescript
import { Connection } from "@solana/web3.js";

async function calculateRent(
  connection: Connection,
  dataSize: number
): Promise<number> {
  return connection.getMinimumBalanceForRentExemption(dataSize);
}

// Common calculations
// 0 bytes:   890,880 lamports    (0.00089088 SOL)
// 100 bytes: 1,447,680 lamports  (0.00144768 SOL)
// 500 bytes: 4,310,400 lamports  (0.00431040 SOL)
// 1 KB:      7,948,800 lamports  (0.00794880 SOL)
// 10 KB:     72,192,000 lamports (0.07219200 SOL)
// 1 MB:      7,143,360,000 lamports (7.14 SOL)
// 10 MB:     71,433,600,000 lamports (71.43 SOL) — max account size
```

```rust
// On-chain rent calculation
use solana_program::rent::Rent;
use solana_program::sysvar::Sysvar;

let rent = Rent::get()?;
let min_balance = rent.minimum_balance(data_len);
```

## Anchor Space Calculation

Anchor accounts use an 8-byte discriminator prefix. Calculate space with `INIT_SPACE` derive macro or manually.

| Rust Type | Size (bytes) |
|-----------|-------------|
| `bool` | 1 |
| `u8` / `i8` | 1 |
| `u16` / `i16` | 2 |
| `u32` / `i32` | 4 |
| `u64` / `i64` | 8 |
| `u128` / `i128` | 16 |
| `f32` | 4 |
| `f64` | 8 |
| `Pubkey` | 32 |
| `String` (borsh) | 4 + len |
| `Vec<T>` | 4 + (len * sizeof(T)) |
| `Option<T>` | 1 + sizeof(T) |
| `[T; N]` (array) | N * sizeof(T) |
| Enum (C-style) | 1 |
| Enum (with data) | 1 + max(variant sizes) |

```rust
// Example: calculate space for an account
#[account]
#[derive(InitSpace)]
pub struct GameState {
    pub authority: Pubkey,     // 32
    pub score: u64,            // 8
    pub level: u8,             // 1
    pub is_active: bool,       // 1
    #[max_len(32)]
    pub name: String,          // 4 + 32 = 36
}
// Total: 8 (discriminator) + 32 + 8 + 1 + 1 + 36 = 86 bytes
```

## Account Size Limits

| Limit | Value |
|-------|-------|
| Maximum account data | 10,485,760 bytes (10 MB) |
| Maximum `realloc` increase per instruction | 10,240 bytes (10 KB) |
| Maximum accounts per transaction (legacy) | ~35 |
| Maximum accounts per transaction (v0 + ALT) | 256+ |

## Address Lookup Table Sizes

| Addresses in Table | Data Size | Rent (SOL) |
|-------------------|-----------|------------|
| 1 | 88 | 0.00149568 |
| 10 | 376 | 0.00355488 |
| 50 | 1,656 | 0.01268928 |
| 100 | 3,256 | 0.02412288 |
| 256 | 8,248 | 0.05979648 |

Formula: `56 + (32 * num_addresses)` bytes

Last verified: 2026-03-01
