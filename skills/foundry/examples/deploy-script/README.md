# Deployment Scripts

Foundry deployment scripts use Solidity (not JavaScript). Scripts extend `forge-std/Script.sol` and are executed with `forge script`.

## Basic Script Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Vault} from "../src/Vault.sol";

contract DeployVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        Vault vault = new Vault();
        console.log("Vault deployed to:", address(vault));

        vm.stopBroadcast();
    }
}
```

File naming convention: `script/DeployVault.s.sol` (`.s.sol` suffix).

## vm.startBroadcast / vm.stopBroadcast

Everything between `startBroadcast` and `stopBroadcast` is recorded as real transactions. Code outside this block runs in simulation only.

```solidity
function run() external {
    // Simulation only — reads state, no transactions
    address owner = vm.envAddress("OWNER");
    uint256 initialSupply = 1_000_000e18;

    vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

    // These create real transactions
    Token token = new Token("MyToken", "MTK", initialSupply);
    token.transferOwnership(owner);

    vm.stopBroadcast();

    // Simulation only again
    console.log("Token:", address(token));
    console.log("Owner:", owner);
}
```

## Reading Environment Variables

```solidity
function run() external {
    // Read different types from .env
    uint256 privateKey = vm.envUint("PRIVATE_KEY");
    address owner = vm.envAddress("OWNER_ADDRESS");
    string memory rpcUrl = vm.envString("RPC_URL");
    bool isMainnet = vm.envBool("IS_MAINNET");

    // With default values (won't revert if missing)
    uint256 gasPrice = vm.envOr("GAS_PRICE", uint256(20 gwei));
    address admin = vm.envOr("ADMIN", msg.sender);

    vm.startBroadcast(privateKey);
    // ...
    vm.stopBroadcast();
}
```

Example `.env`:

```
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
OWNER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
IS_MAINNET=false
```

## Multi-Contract Deployment

```solidity
contract DeployProtocol is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // Deploy in dependency order
        Oracle oracle = new Oracle();
        console.log("Oracle:", address(oracle));

        Treasury treasury = new Treasury();
        console.log("Treasury:", address(treasury));

        // Pass dependencies to constructor
        Vault vault = new Vault(address(oracle), address(treasury));
        console.log("Vault:", address(vault));

        // Post-deploy configuration
        treasury.setVault(address(vault));
        vault.setFeeRecipient(address(treasury));

        vm.stopBroadcast();
    }
}
```

## Deterministic Addresses with CREATE2

Deploy to the same address on every chain using CREATE2:

```solidity
contract DeployDeterministic is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // salt determines the deployed address
        bytes32 salt = keccak256("my-vault-v1");

        Vault vault = new Vault{salt: salt}();
        console.log("Vault (deterministic):", address(vault));

        vm.stopBroadcast();
    }

    function computeAddress() public view returns (address) {
        bytes32 salt = keccak256("my-vault-v1");
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(Vault).creationCode)
        );

        // CREATE2 address formula
        return address(uint160(uint256(keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)
        ))));
    }
}
```

## Verification Flags

```bash
# Deploy + verify on Etherscan in one command
forge script script/DeployVault.s.sol \
  --rpc-url sepolia \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv

# Verify on a different explorer (Arbiscan, Basescan, etc.)
forge script script/DeployVault.s.sol \
  --rpc-url arbitrum \
  --broadcast \
  --verify \
  --verifier-url https://api.arbiscan.io/api \
  --etherscan-api-key $ARBISCAN_API_KEY \
  -vvvv
```

## Dry Run vs Broadcast

```bash
# DRY RUN — simulates everything, sends nothing
# Always do this first to catch errors
forge script script/DeployVault.s.sol \
  --rpc-url sepolia \
  -vvvv

# BROADCAST — sends real transactions
forge script script/DeployVault.s.sol \
  --rpc-url sepolia \
  --broadcast \
  -vvvv

# MAINNET — always use --slow to wait for confirmations
forge script script/DeployVault.s.sol \
  --rpc-url mainnet \
  --broadcast \
  --slow \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv
```

## Broadcast Artifacts

After `--broadcast`, Foundry writes artifacts to:

```
broadcast/
  DeployVault.s.sol/
    11155111/                    # Chain ID (Sepolia)
      run-latest.json           # Latest run
      run-1708123456.json       # Timestamped run
```

The artifact contains deployed addresses, transaction hashes, gas used, and constructor arguments. Use this to verify deployments or resume failed scripts.

## Resume a Failed Deployment

If a multi-tx script fails partway through:

```bash
# Resume from where it left off using the broadcast artifacts
forge script script/DeployVault.s.sol \
  --rpc-url sepolia \
  --broadcast \
  --resume \
  -vvvv
```

## Deploy with a Ledger or Trezor

```bash
# Ledger — no private key in env, uses hardware wallet
forge script script/DeployVault.s.sol \
  --rpc-url mainnet \
  --broadcast \
  --ledger \
  --sender 0xYourLedgerAddress \
  --slow \
  -vvvv
```

```solidity
// In the script, use startBroadcast without a private key
function run() external {
    vm.startBroadcast(); // Uses --sender from CLI
    Vault vault = new Vault();
    vm.stopBroadcast();
}
```

## Deployment Checklist

1. Write the script in `script/Deploy*.s.sol`
2. Test with `--rpc-url` and NO `--broadcast` (dry run)
3. Deploy to testnet with `--broadcast --verify`
4. Check the deployed contract on the block explorer
5. Deploy to mainnet with `--broadcast --verify --slow`
6. Save `broadcast/` artifacts to version control or deployment records

## References

- [Foundry Book — Solidity Scripting](https://book.getfoundry.sh/tutorials/solidity-scripting)
- [Foundry Book — forge script Reference](https://book.getfoundry.sh/reference/forge/forge-script)
