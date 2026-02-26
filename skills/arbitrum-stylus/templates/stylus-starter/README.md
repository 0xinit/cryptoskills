# Stylus Starter Template

Minimal Stylus contract project with storage, entrypoint, external functions, tests, and deployment commands.

## Create the Project

```bash
cargo stylus new my-contract
cd my-contract
```

Or manually set up with the files below.

## Cargo.toml

```toml
[package]
name = "my-contract"
version = "0.1.0"
edition = "2021"

[dependencies]
stylus-sdk = "0.6"
alloy-primitives = "0.7"
alloy-sol-types = "0.7"

[dev-dependencies]
motsu = "0.2"

[features]
export-abi = ["stylus-sdk/export-abi"]

[profile.release]
codegen-units = 1
strip = true
lto = true
panic = "abort"
opt-level = "s"

[lib]
crate-type = ["lib", "cdylib"]
```

## .cargo/config.toml

```toml
[build]
target = "wasm32-unknown-unknown"

[target.wasm32-unknown-unknown]
rustflags = ["-C", "link-arg=-zstack-size=8192"]
```

## rust-toolchain.toml

```toml
[toolchain]
channel = "1.80"
components = ["rust-src"]
targets = ["wasm32-unknown-unknown"]
```

## src/lib.rs

```rust
#![cfg_attr(not(feature = "export-abi"), no_main)]
extern crate alloc;

use stylus_sdk::prelude::*;
use stylus_sdk::storage::{StorageAddress, StorageU256};
use stylus_sdk::{evm, msg};
use alloy_primitives::{Address, U256};
use alloy_sol_types::sol;

sol! {
    event ValueChanged(address indexed sender, uint256 oldValue, uint256 newValue);
}

#[storage]
#[entrypoint]
pub struct MyContract {
    value: StorageU256,
    owner: StorageAddress,
}

#[public]
impl MyContract {
    pub fn get_value(&self) -> U256 {
        self.value.get()
    }

    pub fn set_value(&mut self, new_value: U256) -> Result<(), Vec<u8>> {
        let old_value = self.value.get();
        self.value.set(new_value);
        evm::log(ValueChanged {
            sender: msg::sender(),
            oldValue: old_value,
            newValue: new_value,
        });
        Ok(())
    }

    pub fn owner(&self) -> Address {
        self.owner.get()
    }

    pub fn initialize(&mut self) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO {
            return Err(b"AlreadyInitialized".to_vec());
        }
        self.owner.set(msg::sender());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_primitives::address;

    #[motsu::test]
    fn test_get_default_value(contract: MyContract) {
        assert_eq!(contract.get_value(), U256::ZERO);
    }

    #[motsu::test]
    fn test_set_value(contract: MyContract) {
        let result = contract.set_value(U256::from(42));
        assert!(result.is_ok());
        assert_eq!(contract.get_value(), U256::from(42));
    }

    #[motsu::test]
    fn test_initialize_sets_owner(contract: MyContract) {
        let result = contract.initialize();
        assert!(result.is_ok());
        // Owner is set to the test caller address
    }
}
```

## Build Commands

```bash
# Run unit tests
cargo test

# Check WASM validity against testnet
cargo stylus check \
  --endpoint https://sepolia-rollup.arbitrum.io/rpc

# Export the Solidity ABI
cargo stylus export-abi

# Deploy to Arbitrum Sepolia
cargo stylus deploy \
  --endpoint https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY

# Deploy to Arbitrum One (mainnet)
cargo stylus deploy \
  --endpoint https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY
```

## Post-Deploy Interaction

```bash
# Initialize the contract
cast send $CONTRACT_ADDRESS "initialize()" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY

# Read value
cast call $CONTRACT_ADDRESS "getValue()(uint256)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc

# Set value
cast send $CONTRACT_ADDRESS "setValue(uint256)" 42 \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY

# Check owner
cast call $CONTRACT_ADDRESS "owner()(address)" \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

## Project Checklist

- [ ] `cargo test` passes
- [ ] `cargo stylus check` passes against target network
- [ ] `cargo stylus export-abi` produces expected interface
- [ ] Deployed and activated on testnet
- [ ] All external functions tested via `cast`
- [ ] Storage layout documented for upgrade safety
- [ ] No `unwrap()` in production code paths
- [ ] No floating-point types used anywhere
- [ ] Release profile optimized for size (`opt-level = "s"`, LTO, strip)
