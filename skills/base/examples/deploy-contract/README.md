# Deploying to Base

Base is an OP Stack L2. Deployment is identical to Ethereum — same compiler, same tooling, different RPC URL.

## Foundry Deployment

### Deploy Script

```solidity
// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract DeployScript is Script {
    function run() external returns (Counter) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        Counter counter = new Counter();

        vm.stopBroadcast();
        return counter;
    }
}
```

### foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"

[rpc_endpoints]
base = "https://mainnet.base.org"
base_sepolia = "https://sepolia.base.org"

[etherscan]
base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api", chain = 8453 }
base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api", chain = 84532 }
```

### Deploy to Base Sepolia (Testnet)

```bash
# Get testnet ETH from https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

forge script script/Deploy.s.sol:DeployScript \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Deploy to Base Mainnet

```bash
# --slow flag is recommended for mainnet to avoid nonce issues
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url base \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  --slow
```

## Hardhat Deployment

### hardhat.config.ts

```typescript
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  networks: {
    base: {
      url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 8453,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 84532,
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY!,
      baseSepolia: process.env.BASESCAN_API_KEY!,
    },
    customChains: [
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
      {
        network: 'baseSepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
    ],
  },
};

export default config;
```

### Deploy Script (Hardhat)

```typescript
// scripts/deploy.ts
import { ethers } from 'hardhat';

async function main() {
  const Counter = await ethers.getContractFactory('Counter');
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
# Deploy
npx hardhat run scripts/deploy.ts --network baseSepolia

# Verify
npx hardhat verify --network baseSepolia $CONTRACT_ADDRESS
```

## Verification

### Basescan (Etherscan-based)

Get an API key at https://basescan.org/apis.

```bash
# Foundry
forge verify-contract $CONTRACT_ADDRESS src/Counter.sol:Counter \
  --chain base \
  --etherscan-api-key $BASESCAN_API_KEY

# With constructor args
forge verify-contract $CONTRACT_ADDRESS src/Token.sol:Token \
  --chain base \
  --etherscan-api-key $BASESCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(string,string)" "MyToken" "MTK")
```

### Blockscout (No API Key)

```bash
forge verify-contract $CONTRACT_ADDRESS src/Counter.sol:Counter \
  --chain base \
  --verifier blockscout \
  --verifier-url https://base.blockscout.com/api/
```

### Verification Troubleshooting

- **"Unable to verify"** — Ensure compiler version and optimization settings match exactly. Check `foundry.toml` or `hardhat.config.ts`.
- **Constructor args mismatch** — ABI-encode constructor arguments in the exact order and type. Use `cast abi-encode` for Foundry.
- **Library linking** — If the contract uses libraries, pass `--libraries` flag with deployed library addresses.
- **Proxy contracts** — Verify the implementation contract, not the proxy. Then use Basescan's "Is this a proxy?" feature to link them.
