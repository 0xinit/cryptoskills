# Solidity Interop with Stylus

Stylus and Solidity contracts coexist on Arbitrum, sharing state and composability. This guide covers calling between the two VMs.

## Calling a Solidity Contract from Stylus

Use `sol_interface!` to declare the target contract's interface, then invoke methods via `Call`.

### Example: Reading an ERC20 Balance

```rust
use stylus_sdk::prelude::*;
use stylus_sdk::storage::StorageAddress;
use stylus_sdk::call::Call;
use alloy_primitives::{Address, U256};

sol_interface! {
    interface IERC20 {
        function balanceOf(address account) external view returns (uint256);
        function transfer(address to, uint256 amount) external returns (bool);
        function approve(address spender, uint256 amount) external returns (bool);
        function allowance(address owner, address spender) external view returns (uint256);
    }
}

#[storage]
#[entrypoint]
pub struct TokenReader {
    token: StorageAddress,
}

#[public]
impl TokenReader {
    pub fn get_token_balance(&self, account: Address) -> Result<U256, Vec<u8>> {
        let token = IERC20::new(self.token.get());
        let balance = token.balance_of(Call::new(), account)?;
        Ok(balance)
    }

    pub fn transfer_token(
        &mut self,
        to: Address,
        amount: U256,
    ) -> Result<bool, Vec<u8>> {
        let token = IERC20::new(self.token.get());
        let success = token.transfer(Call::new(), to, amount)?;
        Ok(success)
    }
}
```

### Example: Calling a Uniswap-style Router

```rust
sol_interface! {
    interface ISwapRouter {
        function exactInputSingle(
            address tokenIn,
            address tokenOut,
            uint24 fee,
            address recipient,
            uint256 amountIn,
            uint256 amountOutMinimum,
            uint160 sqrtPriceLimitX96
        ) external payable returns (uint256 amountOut);
    }
}

#[public]
impl StylusTrader {
    pub fn execute_swap(
        &mut self,
        router: Address,
        token_in: Address,
        token_out: Address,
        amount_in: U256,
        min_out: U256,
    ) -> Result<U256, Vec<u8>> {
        let swap_router = ISwapRouter::new(router);
        let amount_out = swap_router.exact_input_single(
            Call::new(),
            token_in,
            token_out,
            3000u32.into(), // 0.3% fee tier
            msg::sender(),
            amount_in,
            min_out,
            U256::ZERO.into(), // no price limit
        )?;
        Ok(amount_out)
    }
}
```

### Sending ETH with a Call

```rust
sol_interface! {
    interface IWETH {
        function deposit() external payable;
        function withdraw(uint256 amount) external;
    }
}

#[public]
impl WethWrapper {
    #[payable]
    pub fn wrap_eth(&mut self, weth_address: Address) -> Result<(), Vec<u8>> {
        let weth = IWETH::new(weth_address);
        let value = msg::value();
        // Send ETH value with the call
        weth.deposit(Call::new_in(self).value(value))?;
        Ok(())
    }
}
```

## Calling a Stylus Contract from Solidity

Stylus contracts export standard Solidity ABIs. From Solidity's perspective, a Stylus contract is indistinguishable from a Solidity contract.

### Step 1: Export the ABI

```bash
cargo stylus export-abi
```

Output:

```solidity
interface IStylusVault {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function totalDeposits() external view returns (uint256);
}
```

### Step 2: Use the Interface in Solidity

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IStylusVault {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function totalDeposits() external view returns (uint256);
}

contract SolidityIntegrator {
    IStylusVault public immutable vault;

    constructor(address _vault) {
        vault = IStylusVault(_vault);
    }

    function depositToVault() external payable {
        vault.deposit{value: msg.value}();
    }

    function checkBalance(address account) external view returns (uint256) {
        return vault.balanceOf(account);
    }
}
```

## Shared Storage (Proxy Pattern)

When a Solidity proxy delegates to a Stylus implementation (or vice versa), storage slots must align exactly.

### Solidity Storage Layout

```solidity
contract StorageV1 {
    uint256 public value;        // slot 0
    address public owner;        // slot 1
    mapping(address => uint256) public balances;  // slot 2
}
```

### Equivalent Stylus Storage Layout

```rust
#[storage]
#[entrypoint]
pub struct StorageV1 {
    value: StorageU256,         // slot 0
    owner: StorageAddress,     // slot 1
    balances: StorageMap<Address, StorageU256>,  // slot 2
}
```

Both layouts produce identical slot positions. A proxy pointing at either implementation reads/writes the same storage.

### Mixed Architecture Example

```
┌──────────────────┐
│  Solidity Proxy  │  ← Standard ERC1967 proxy (Solidity)
│  (delegatecall)  │
└────────┬─────────┘
         │
    ┌────▼────┐
    │ Stylus  │  ← Implementation with compute-heavy logic
    │  Impl   │
    └─────────┘
```

The proxy handles `delegatecall` routing (which Stylus cannot do natively). The implementation does the heavy computation in WASM for gas savings.

## ABI Compatibility Rules

| Rust Type | Solidity Type | ABI Encoding |
|-----------|--------------|--------------|
| `U256` | `uint256` | 32 bytes, big-endian |
| `Address` | `address` | 20 bytes, left-padded to 32 |
| `bool` | `bool` | 1 byte, left-padded to 32 |
| `String` | `string` | Dynamic encoding |
| `Vec<u8>` | `bytes` | Dynamic encoding |
| `U256` (fixed) | `uint128`, `uint64`, etc. | Truncated to size |
| `Result<T, Vec<u8>>` | Revert with bytes | ABI revert on Err |

## Error Handling Across VMs

When a Stylus function returns `Err(Vec<u8>)`, it reverts with those bytes as the revert reason. Solidity `try/catch` works normally:

```solidity
try stylusContract.riskyOperation() returns (uint256 result) {
    // success
} catch (bytes memory reason) {
    // reason contains the bytes from Stylus Err
}
```

From Stylus, catching a Solidity revert:

```rust
let result = solidity_contract.some_function(Call::new(), arg1);
match result {
    Ok(value) => { /* success */ }
    Err(revert_data) => { /* handle revert, revert_data contains reason */ }
}
```
