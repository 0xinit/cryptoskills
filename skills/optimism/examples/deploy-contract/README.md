# Deploy Contract to Optimism

OP Mainnet is EVM-equivalent. Standard deployment flows work without modification.

## Foundry

### Basic Deployment

```bash
# Deploy a contract
forge create src/Counter.sol:Counter \
  --rpc-url https://mainnet.optimism.io \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Deploy with Constructor Arguments

```bash
forge create src/MyToken.sol:MyToken \
  --rpc-url https://mainnet.optimism.io \
  --private-key $PRIVATE_KEY \
  --constructor-args "Optimism Token" "OPT" 1000000000000000000000000 \
  --broadcast
```

### Deploy via Script

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        Counter counter = new Counter();
        vm.stopBroadcast();
    }
}
```

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://mainnet.optimism.io \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### Verification

```bash
# Verify on Optimistic Etherscan
forge verify-contract <DEPLOYED_ADDRESS> src/Counter.sol:Counter \
  --chain-id 10 \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Verify on Blockscout
forge verify-contract <DEPLOYED_ADDRESS> src/Counter.sol:Counter \
  --verifier blockscout \
  --verifier-url https://optimism.blockscout.com/api/
```

## Hardhat

### Configuration

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    optimism: {
      url: process.env.OP_MAINNET_RPC || "https://mainnet.optimism.io",
      accounts: [process.env.PRIVATE_KEY!],
    },
    optimismSepolia: {
      url: process.env.OP_SEPOLIA_RPC || "https://sepolia.optimism.io",
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
  etherscan: {
    apiKey: {
      optimisticEthereum: process.env.ETHERSCAN_API_KEY!,
      optimisticSepolia: process.env.ETHERSCAN_API_KEY!,
    },
  },
};

export default config;
```

### Deploy Script

```typescript
import { ethers } from "hardhat";

async function main() {
  const Counter = await ethers.getContractFactory("Counter");
  const counter = await Counter.deploy();
  await counter.waitForDeployment();

  const address = await counter.getAddress();
  console.log(`Counter deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

```bash
# Deploy to OP Mainnet
npx hardhat run scripts/deploy.ts --network optimism

# Deploy to OP Sepolia (testnet)
npx hardhat run scripts/deploy.ts --network optimismSepolia

# Verify
npx hardhat verify --network optimism <DEPLOYED_ADDRESS>
```

## Testnet Deployment (OP Sepolia)

1. Get testnet ETH from the [Superchain Faucet](https://app.optimism.io/faucet)
2. Use chain ID `11155420` and RPC `https://sepolia.optimism.io`
3. Deploy with the same commands, swapping the RPC URL

```bash
forge create src/Counter.sol:Counter \
  --rpc-url https://sepolia.optimism.io \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --chain-id 11155420
```

## Notes

- No `--legacy` flag needed. OP Mainnet supports EIP-1559 transactions natively.
- Gas estimation includes only L2 execution gas. The L1 data fee is charged separately and automatically by the protocol.
- The Etherscan API key for Optimistic Etherscan is separate from Ethereum Etherscan. Register at [optimistic.etherscan.io](https://optimistic.etherscan.io).
