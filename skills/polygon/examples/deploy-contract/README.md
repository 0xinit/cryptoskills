# Deploying to Polygon

Deploy contracts to Polygon PoS and zkEVM using Foundry and Hardhat.

## Foundry: Deploy to Polygon PoS

### Create the Contract

```solidity
// src/Counter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Counter {
    uint256 public count;

    event CountUpdated(uint256 newCount);

    function increment() external {
        count++;
        emit CountUpdated(count);
    }
}
```

### Deploy and Verify

```bash
# Deploy to Polygon PoS mainnet with verification
forge create src/Counter.sol:Counter \
  --rpc-url https://polygon-rpc.com \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier-url https://api.polygonscan.com/api \
  --etherscan-api-key $POLYGONSCAN_API_KEY

# Deploy to Amoy testnet
forge create src/Counter.sol:Counter \
  --rpc-url https://rpc-amoy.polygon.technology \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier-url https://api-amoy.polygonscan.com/api \
  --etherscan-api-key $POLYGONSCAN_API_KEY
```

### Using Forge Script

```solidity
// script/DeployCounter.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract DeployCounter is Script {
    function run() external returns (Counter) {
        vm.startBroadcast();
        Counter counter = new Counter();
        vm.stopBroadcast();
        return counter;
    }
}
```

```bash
# Run deploy script on Polygon PoS
forge script script/DeployCounter.s.sol:DeployCounter \
  --rpc-url https://polygon-rpc.com \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier-url https://api.polygonscan.com/api \
  --etherscan-api-key $POLYGONSCAN_API_KEY
```

## Foundry: Deploy to Polygon zkEVM

```bash
# Deploy to zkEVM mainnet
forge create src/Counter.sol:Counter \
  --rpc-url https://zkevm-rpc.com \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier-url https://api-zkevm.polygonscan.com/api \
  --etherscan-api-key $POLYGONSCAN_API_KEY

# Deploy to Cardona testnet
forge create src/Counter.sol:Counter \
  --rpc-url https://rpc.cardona.zkevm-rpc.com \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --verifier-url https://api-cardona-zkevm.polygonscan.com/api \
  --etherscan-api-key $POLYGONSCAN_API_KEY
```

## Hardhat: Deploy to Polygon zkEVM

```typescript
// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  const Counter = await ethers.getContractFactory("Counter");
  const counter = await Counter.deploy();
  await counter.waitForDeployment();

  const address = await counter.getAddress();
  console.log(`Counter deployed to: ${address}`);

  // Verify after deployment
  await new Promise((resolve) => setTimeout(resolve, 30_000));
  await hre.run("verify:verify", {
    address,
    constructorArguments: [],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

```bash
# Deploy to zkEVM via Hardhat
npx hardhat run scripts/deploy.ts --network zkevm

# Deploy to Cardona testnet
npx hardhat run scripts/deploy.ts --network cardona
```

## Verification (Standalone)

```bash
# Verify existing contract on Polygonscan (PoS)
forge verify-contract <ADDRESS> src/Counter.sol:Counter \
  --chain-id 137 \
  --verifier-url https://api.polygonscan.com/api \
  --etherscan-api-key $POLYGONSCAN_API_KEY

# Verify on zkEVM explorer
forge verify-contract <ADDRESS> src/Counter.sol:Counter \
  --chain-id 1101 \
  --verifier-url https://api-zkevm.polygonscan.com/api \
  --etherscan-api-key $POLYGONSCAN_API_KEY

# Verify with constructor args
forge verify-contract <ADDRESS> src/Token.sol:Token \
  --chain-id 137 \
  --verifier-url https://api.polygonscan.com/api \
  --etherscan-api-key $POLYGONSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(string,string)" "MyToken" "MTK")
```

## foundry.toml Configuration

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"

[rpc_endpoints]
polygon = "https://polygon-rpc.com"
amoy = "https://rpc-amoy.polygon.technology"
zkevm = "https://zkevm-rpc.com"
cardona = "https://rpc.cardona.zkevm-rpc.com"

[etherscan]
polygon = { key = "${POLYGONSCAN_API_KEY}", url = "https://api.polygonscan.com/api" }
amoy = { key = "${POLYGONSCAN_API_KEY}", url = "https://api-amoy.polygonscan.com/api" }
zkevm = { key = "${POLYGONSCAN_API_KEY}", url = "https://api-zkevm.polygonscan.com/api" }
cardona = { key = "${POLYGONSCAN_API_KEY}", url = "https://api-cardona-zkevm.polygonscan.com/api" }
```
