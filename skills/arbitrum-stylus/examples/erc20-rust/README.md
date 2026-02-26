# ERC20 Token in Rust with Stylus

A complete ERC20 implementation using the Stylus SDK, demonstrating storage patterns, events, error handling, and access-controlled minting.

## Project Setup

```bash
cargo stylus new erc20-stylus
cd erc20-stylus
```

### Cargo.toml

```toml
[package]
name = "erc20-stylus"
version = "0.1.0"
edition = "2021"

[dependencies]
stylus-sdk = "0.6"
alloy-primitives = "0.7"
alloy-sol-types = "0.7"

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

## Full Implementation

```rust
#![cfg_attr(not(feature = "export-abi"), no_main)]
extern crate alloc;

use stylus_sdk::prelude::*;
use stylus_sdk::storage::{
    StorageAddress, StorageMap, StorageString, StorageU256, StorageU8,
};
use stylus_sdk::{evm, msg};
use alloy_primitives::{Address, U256};
use alloy_sol_types::sol;

sol! {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
}

#[storage]
#[entrypoint]
pub struct Erc20 {
    // Slot 0: token name
    name: StorageString,
    // Slot 1: token symbol
    symbol: StorageString,
    // Slot 2: decimals
    decimals: StorageU8,
    // Slot 3: total supply
    total_supply: StorageU256,
    // Slot 4: balances mapping
    balances: StorageMap<Address, StorageU256>,
    // Slot 5: allowances nested mapping
    allowances: StorageMap<Address, StorageMap<Address, StorageU256>>,
    // Slot 6: contract owner for minting
    owner: StorageAddress,
}

#[public]
impl Erc20 {
    // -- ERC20 View Functions --

    pub fn name(&self) -> String {
        self.name.get_string()
    }

    pub fn symbol(&self) -> String {
        self.symbol.get_string()
    }

    pub fn decimals(&self) -> u8 {
        self.decimals.get()
    }

    pub fn total_supply(&self) -> U256 {
        self.total_supply.get()
    }

    pub fn balance_of(&self, account: Address) -> U256 {
        self.balances.get(account)
    }

    pub fn allowance(&self, owner: Address, spender: Address) -> U256 {
        self.allowances.get(owner).get(spender)
    }

    pub fn owner(&self) -> Address {
        self.owner.get()
    }

    // -- ERC20 State-Mutating Functions --

    pub fn transfer(&mut self, to: Address, amount: U256) -> Result<bool, Vec<u8>> {
        let from = msg::sender();
        self._transfer(from, to, amount)?;
        Ok(true)
    }

    pub fn approve(&mut self, spender: Address, amount: U256) -> Result<bool, Vec<u8>> {
        let owner = msg::sender();
        self._approve(owner, spender, amount)?;
        Ok(true)
    }

    pub fn transfer_from(
        &mut self,
        from: Address,
        to: Address,
        amount: U256,
    ) -> Result<bool, Vec<u8>> {
        let spender = msg::sender();
        let current_allowance = self.allowances.get(from).get(spender);
        if current_allowance < amount {
            return Err(b"ERC20: insufficient allowance".to_vec());
        }
        self._approve(from, spender, current_allowance - amount)?;
        self._transfer(from, to, amount)?;
        Ok(true)
    }

    // -- Owner-Only Mint Function --

    pub fn mint(&mut self, to: Address, amount: U256) -> Result<bool, Vec<u8>> {
        if msg::sender() != self.owner.get() {
            return Err(b"ERC20: caller is not the owner".to_vec());
        }
        if to == Address::ZERO {
            return Err(b"ERC20: mint to the zero address".to_vec());
        }

        let supply = self.total_supply.get();
        self.total_supply.set(supply + amount);

        let balance = self.balances.get(to);
        self.balances.setter(to).set(balance + amount);

        evm::log(Transfer {
            from: Address::ZERO,
            to,
            value: amount,
        });
        Ok(true)
    }

    // -- Initialization (call once after deployment) --

    pub fn initialize(
        &mut self,
        name: String,
        symbol: String,
        decimals: u8,
    ) -> Result<(), Vec<u8>> {
        // Only allow initialization if owner is not set
        if self.owner.get() != Address::ZERO {
            return Err(b"ERC20: already initialized".to_vec());
        }
        self.name.set_str(&name);
        self.symbol.set_str(&symbol);
        self.decimals.set(decimals);
        self.owner.set(msg::sender());

        evm::log(OwnershipTransferred {
            previousOwner: Address::ZERO,
            newOwner: msg::sender(),
        });
        Ok(())
    }
}

// Internal functions — not exposed via ABI
impl Erc20 {
    fn _transfer(&mut self, from: Address, to: Address, amount: U256) -> Result<(), Vec<u8>> {
        if from == Address::ZERO {
            return Err(b"ERC20: transfer from the zero address".to_vec());
        }
        if to == Address::ZERO {
            return Err(b"ERC20: transfer to the zero address".to_vec());
        }

        let from_balance = self.balances.get(from);
        if from_balance < amount {
            return Err(b"ERC20: transfer amount exceeds balance".to_vec());
        }

        self.balances.setter(from).set(from_balance - amount);
        let to_balance = self.balances.get(to);
        self.balances.setter(to).set(to_balance + amount);

        evm::log(Transfer { from, to, value: amount });
        Ok(())
    }

    fn _approve(
        &mut self,
        owner: Address,
        spender: Address,
        amount: U256,
    ) -> Result<(), Vec<u8>> {
        if owner == Address::ZERO {
            return Err(b"ERC20: approve from the zero address".to_vec());
        }
        if spender == Address::ZERO {
            return Err(b"ERC20: approve to the zero address".to_vec());
        }

        self.allowances.setter(owner).setter(spender).set(amount);
        evm::log(Approval { owner, spender, value: amount });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_primitives::address;

    #[motsu::test]
    fn test_mint_and_transfer(contract: Erc20) {
        let alice = address!("A11CEbadF00dbadF00dbadF00dbadF00dbadF00db");
        let bob = address!("B0BbadF00dbadF00dbadF00dbadF00dbadF00dba0");

        // Set up initial balance
        contract.balances.setter(alice).set(U256::from(1_000_000));
        contract.total_supply.set(U256::from(1_000_000));

        // Transfer
        let result = contract._transfer(alice, bob, U256::from(250_000));
        assert!(result.is_ok());
        assert_eq!(contract.balance_of(alice), U256::from(750_000));
        assert_eq!(contract.balance_of(bob), U256::from(250_000));
    }

    #[motsu::test]
    fn test_transfer_exceeds_balance(contract: Erc20) {
        let alice = address!("A11CEbadF00dbadF00dbadF00dbadF00dbadF00db");
        let bob = address!("B0BbadF00dbadF00dbadF00dbadF00dbadF00dba0");

        contract.balances.setter(alice).set(U256::from(100));

        let result = contract._transfer(alice, bob, U256::from(200));
        assert!(result.is_err());
    }

    #[motsu::test]
    fn test_approve_and_allowance(contract: Erc20) {
        let owner = address!("A11CEbadF00dbadF00dbadF00dbadF00dbadF00db");
        let spender = address!("B0BbadF00dbadF00dbadF00dbadF00dbadF00dba0");

        let result = contract._approve(owner, spender, U256::from(500));
        assert!(result.is_ok());
        assert_eq!(contract.allowance(owner, spender), U256::from(500));
    }
}
```

## Exported ABI

Running `cargo stylus export-abi` produces:

```solidity
interface IErc20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function owner() external view returns (address);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external returns (bool);
    function initialize(string calldata name, string calldata symbol, uint8 decimals) external;
}
```

## Build and Deploy

```bash
# Check WASM validity
cargo stylus check --endpoint https://sepolia-rollup.arbitrum.io/rpc

# Deploy to Arbitrum Sepolia
cargo stylus deploy \
  --endpoint https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY

# Initialize the token
cast send $CONTRACT_ADDRESS \
  "initialize(string,string,uint8)" "MyToken" "MTK" 18 \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY

# Mint tokens
cast send $CONTRACT_ADDRESS \
  "mint(address,uint256)" $RECIPIENT 1000000000000000000000 \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY

# Check balance
cast call $CONTRACT_ADDRESS \
  "balanceOf(address)(uint256)" $RECIPIENT \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

## Run Tests

```bash
cargo test
```
