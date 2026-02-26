# Deploying Contracts to Arbitrum

## Environment Setup

```bash
# .env — never commit this file
PRIVATE_KEY=0xYourPrivateKeyHere
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ARBISCAN_API_KEY=YourArbiscanApiKey
```

## Foundry Deployment

Arbitrum's sequencer requires legacy (type-0) transactions for `forge create` and `forge script`. Without `--legacy`, you will get an opaque RPC error.

### Direct Deploy

```bash
# Deploy to Arbitrum Sepolia (testnet)
forge create src/Counter.sol:Counter \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --legacy

# Deploy to Arbitrum One (mainnet)
forge create src/Counter.sol:Counter \
  --rpc-url $ARBITRUM_RPC_URL \
  --private-key $PRIVATE_KEY \
  --legacy \
  --slow
```

### Forge Script Deploy

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
  --rpc-url $ARBITRUM_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --legacy
```

### With Constructor Arguments

```bash
forge create src/Token.sol:Token \
  --rpc-url $ARBITRUM_RPC_URL \
  --private-key $PRIVATE_KEY \
  --legacy \
  --constructor-args "MyToken" "MTK" 1000000000000000000000
```

## Hardhat Deployment

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    arbitrumOne: {
      url: process.env.ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 42161,
    },
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 421614,
    },
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY!,
      arbitrumSepolia: process.env.ARBISCAN_API_KEY!,
    },
  },
};

export default config;
```

```typescript
// scripts/deploy.ts
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
npx hardhat run scripts/deploy.ts --network arbitrumOne
```

## Contract Verification

### Foundry (Arbiscan)

```bash
forge verify-contract \
  --chain-id 42161 \
  --etherscan-api-key $ARBISCAN_API_KEY \
  --compiler-version v0.8.24 \
  $CONTRACT_ADDRESS \
  src/Counter.sol:Counter

# With constructor args
forge verify-contract \
  --chain-id 42161 \
  --etherscan-api-key $ARBISCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(string,string,uint256)" "MyToken" "MTK" 1000000000000000000000) \
  $CONTRACT_ADDRESS \
  src/Token.sol:Token
```

### Foundry (Sourcify)

```bash
forge verify-contract \
  --chain-id 42161 \
  --verifier sourcify \
  $CONTRACT_ADDRESS \
  src/Counter.sol:Counter
```

### Hardhat

```bash
npx hardhat verify --network arbitrumOne $CONTRACT_ADDRESS
npx hardhat verify --network arbitrumOne $CONTRACT_ADDRESS "MyToken" "MTK" 1000000000000000000000
```

## Gas Estimation with L1 Data Cost

Arbitrum transactions have two gas components. Always estimate both before deploying.

```typescript
import { createPublicClient, http } from "viem";
import { arbitrum } from "viem/chains";

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const nodeInterfaceAbi = [
  {
    name: "gasEstimateComponents",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "contractCreation", type: "bool" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "gasEstimate", type: "uint64" },
      { name: "gasEstimateForL1", type: "uint64" },
      { name: "baseFee", type: "uint256" },
      { name: "l1BaseFeeEstimate", type: "uint256" },
    ],
  },
] as const;

const { result } = await publicClient.simulateContract({
  address: "0x00000000000000000000000000000000000000C8",
  abi: nodeInterfaceAbi,
  functionName: "gasEstimateComponents",
  args: [
    "0x0000000000000000000000000000000000000000", // zero address = contract creation
    true,
    "0x608060..." // your contract creation bytecode
  ],
});

const [totalGas, l1Gas, baseFee, l1BaseFee] = result;
console.log(`Total gas: ${totalGas}`);
console.log(`L1 data gas: ${l1Gas}`);
console.log(`L2 execution gas: ${totalGas - l1Gas}`);
console.log(`Estimated cost: ${formatEther(BigInt(totalGas) * baseFee)} ETH`);
```
