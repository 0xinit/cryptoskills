# Deploy & Verify a Contract

Deploy a Solidity contract to a live network using Hardhat Ignition and verify it on Etherscan.

## Contract

```solidity
// contracts/Vault.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error Vault__ZeroAmount();
error Vault__InsufficientBalance(uint256 requested, uint256 available);

event Deposited(address indexed user, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);

contract Vault {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    mapping(address => uint256) public balances;

    constructor(address _token) {
        token = IERC20(_token);
    }

    function deposit(uint256 amount) external {
        if (amount == 0) revert Vault__ZeroAmount();
        balances[msg.sender] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert Vault__ZeroAmount();
        uint256 balance = balances[msg.sender];
        if (amount > balance) revert Vault__InsufficientBalance(amount, balance);
        balances[msg.sender] = balance - amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }
}
```

## Ignition Module

```typescript
// ignition/modules/Vault.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const VaultModule = buildModule("VaultModule", (m) => {
  const tokenAddress = m.getParameter("tokenAddress");

  const vault = m.contract("Vault", [tokenAddress]);

  return { vault };
});

export default VaultModule;
```

## Parameters File

```json
{
  "VaultModule": {
    "tokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  }
}
```

Save as `ignition/parameters.json`.

## Deploy to Sepolia

```bash
npx hardhat ignition deploy ignition/modules/Vault.ts \
  --network sepolia \
  --parameters ignition/parameters.json
```

Ignition outputs the deployed address and saves deployment state to `ignition/deployments/chain-11155111/`.

## Verify on Etherscan

### Option 1: Ignition Verify (Recommended)

```bash
npx hardhat ignition verify chain-11155111
```

Ignition reads constructor args from deployment state automatically.

### Option 2: Manual Verify

Create constructor arguments file:

```typescript
// arguments.ts
export default ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"];
```

```bash
npx hardhat verify --network sepolia \
  --constructor-args arguments.ts \
  0xYOUR_DEPLOYED_VAULT_ADDRESS
```

## Deploy to Mainnet

```bash
npx hardhat ignition deploy ignition/modules/Vault.ts \
  --network mainnet \
  --parameters ignition/parameters.json
```

Wait for sufficient confirmations before verifying on mainnet. The default deployment waits for 1 confirmation. For mainnet, consider adding a manual wait:

```typescript
// Check deployment in a script
import { ethers } from "hardhat";

async function waitForConfirmations(txHash: string, confirmations: number) {
  const receipt = await ethers.provider.waitForTransaction(txHash, confirmations);
  if (!receipt || receipt.status === 0) {
    throw new Error(`Transaction ${txHash} failed or not found`);
  }
  return receipt;
}
```

## Common Issues

**"Nothing to compile"** — Run `npx hardhat clean` then `npx hardhat compile`.

**Verification fails with "bytecode does not match"** — Constructor arguments do not match. Double-check the exact values used during deployment in `ignition/deployments/`.

**"ProviderError: insufficient funds"** — The deployer account on the target network has insufficient ETH for gas. Fund the account before deploying.

**Verification times out** — Etherscan API can be slow. Re-run the verify command — Ignition is idempotent and will retry.

## Configuration Required

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.27",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL ?? "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY ?? "",
  },
};

export default config;
```

## Environment Variables

```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

Never commit `.env` files. Add `.env` to `.gitignore`.
