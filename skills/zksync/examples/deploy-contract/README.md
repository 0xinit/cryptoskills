# Deploying Contracts to zkSync Era

Contract deployment on zkSync differs from Ethereum. All deployments go through the `ContractDeployer` system contract, and bytecode is compiled to zkEVM format via `zksolc`.

## Hardhat-zksync Setup

### Install Dependencies

```bash
npm install -D @matterlabs/hardhat-zksync hardhat
npm install zksync-ethers ethers
```

### hardhat.config.ts

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@matterlabs/hardhat-zksync";

const config: HardhatUserConfig = {
  defaultNetwork: "zkSyncSepolia",
  networks: {
    zkSyncSepolia: {
      url: "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      zksync: true,
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
    },
    zkSyncMainnet: {
      url: "https://mainnet.era.zksync.io",
      ethNetwork: "mainnet",
      zksync: true,
      verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
    },
    inMemoryNode: {
      url: "http://127.0.0.1:8011",
      ethNetwork: "",
      zksync: true,
    },
  },
  zksolc: {
    version: "latest",
    settings: {},
  },
  solidity: {
    version: "0.8.24",
  },
};

export default config;
```

### Sample Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Greeter {
    string public greeting;

    event GreetingChanged(string oldGreeting, string newGreeting);

    constructor(string memory _greeting) {
        greeting = _greeting;
    }

    function setGreeting(string memory _newGreeting) external {
        string memory old = greeting;
        greeting = _newGreeting;
        emit GreetingChanged(old, _newGreeting);
    }
}
```

### Deployment Script

```typescript
// deploy/deploy-greeter.ts
import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  console.log(`Deploying from: ${wallet.address}`);

  const artifact = await deployer.loadArtifact("Greeter");

  // Estimate deployment fee
  const deploymentFee = await deployer.estimateDeployFee(artifact, [
    "Hello, zkSync!",
  ]);
  console.log(`Estimated fee: ${hre.ethers.formatEther(deploymentFee)} ETH`);

  const greeter = await deployer.deploy(artifact, ["Hello, zkSync!"]);
  await greeter.waitForDeployment();

  const address = await greeter.getAddress();
  console.log(`Greeter deployed to: ${address}`);

  // Verify on explorer
  await hre.run("verify:verify", {
    address,
    constructorArguments: ["Hello, zkSync!"],
  });
  console.log("Contract verified");
}
```

```bash
npx hardhat deploy-zksync --script deploy-greeter.ts --network zkSyncSepolia
```

## Foundry-zksync Deployment

### Install

```bash
curl -L https://raw.githubusercontent.com/matter-labs/foundry-zksync/main/install-foundry-zksync | bash
foundryup-zksync
```

### Compile

```bash
forge build --zksync
```

### Deploy

```bash
# Simple deployment
forge create src/Greeter.sol:Greeter \
  --rpc-url https://sepolia.era.zksync.dev \
  --private-key $PRIVATE_KEY \
  --zksync \
  --constructor-args "Hello, zkSync!"

# Verify after deployment
forge verify-contract <DEPLOYED_ADDRESS> src/Greeter.sol:Greeter \
  --zksync \
  --verifier zksync \
  --verifier-url https://explorer.sepolia.era.zksync.dev/contract_verification \
  --constructor-args $(cast abi-encode "constructor(string)" "Hello, zkSync!")
```

## CREATE2 Differences

zkSync CREATE2 address computation includes the constructor input hash, unlike Ethereum.

```typescript
import { utils } from "zksync-ethers";

// Ethereum CREATE2:
// address = keccak256(0xff ++ deployer ++ salt ++ keccak256(initCode))[12:]

// zkSync CREATE2:
// address = keccak256(0xff ++ deployer ++ salt ++ keccak256(bytecodeHash) ++ keccak256(constructorInput))[12:]
const address = utils.create2Address(
  deployerAddress,
  bytecodeHash,
  salt,
  abiEncodedConstructorArgs
);
```

If you use a factory pattern that relies on CREATE2 address precomputation, you must account for the extra `constructorInput` parameter or your addresses will not match.

## Deploying Upgradeable Contracts

```typescript
// deploy/deploy-upgradeable.ts
import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("MyUpgradeable");
  const proxy = await hre.zkUpgrades.deployProxy(
    deployer.zkWallet,
    artifact,
    [/* initializer args */],
    { initializer: "initialize" }
  );

  await proxy.waitForDeployment();
  console.log(`Proxy deployed to: ${await proxy.getAddress()}`);
}
```

## Testnet Deployment Checklist

1. Get Sepolia ETH from a faucet and bridge to zkSync Sepolia via [bridge.zksync.io](https://bridge.zksync.io)
2. Set `PRIVATE_KEY` in your `.env` (never commit this file)
3. Compile with `npx hardhat compile` (uses `zksolc` automatically)
4. Deploy with `npx hardhat deploy-zksync --script deploy.ts --network zkSyncSepolia`
5. Verify on the explorer using `verify:verify` task
6. Test deployed contract on [sepolia.explorer.zksync.io](https://sepolia.explorer.zksync.io)
