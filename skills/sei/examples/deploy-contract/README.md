# Deploying Contracts to Sei

## Environment Setup

```bash
# .env -- never commit this file
PRIVATE_KEY=0xYourPrivateKeyHere
SEI_RPC_URL=https://evm-rpc.sei-apis.com
SEI_TESTNET_RPC_URL=https://evm-rpc-testnet.sei-apis.com
SEITRACE_API_KEY=YourSeitraceApiKey
```

## Foundry Deployment

Sei EVM is bytecode-compatible with Ethereum. No special flags beyond `evmVersion = "paris"` (no PUSH0 opcode).

### foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
evm_version = "paris"

[rpc_endpoints]
sei = "https://evm-rpc.sei-apis.com"
sei_testnet = "https://evm-rpc-testnet.sei-apis.com"

[etherscan]
sei = { key = "${SEITRACE_API_KEY}", chain = 1329, url = "https://seitrace.com/api" }
```

### Direct Deploy

```bash
# Deploy to Sei testnet
forge create src/Counter.sol:Counter \
  --rpc-url $SEI_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY

# Deploy to Sei mainnet
forge create src/Counter.sol:Counter \
  --rpc-url $SEI_RPC_URL \
  --private-key $PRIVATE_KEY \
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
  --rpc-url $SEI_RPC_URL \
  --broadcast \
  --slow

# With verification
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $SEI_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $SEITRACE_API_KEY \
  --verifier-url https://seitrace.com/api \
  --slow
```

### With Constructor Arguments

```bash
forge create src/Token.sol:Token \
  --rpc-url $SEI_RPC_URL \
  --private-key $PRIVATE_KEY \
  --constructor-args "MyToken" "MTK" 1000000000000000000000
```

## Hardhat Deployment

### hardhat.config.ts

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "paris",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    sei: {
      url: process.env.SEI_RPC_URL ?? "https://evm-rpc.sei-apis.com",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 1329,
    },
    seiTestnet: {
      url: process.env.SEI_TESTNET_RPC_URL ?? "https://evm-rpc-testnet.sei-apis.com",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 1328,
    },
  },
  etherscan: {
    apiKey: { sei: process.env.SEITRACE_API_KEY! },
    customChains: [
      {
        network: "sei",
        chainId: 1329,
        urls: {
          apiURL: "https://seitrace.com/api",
          browserURL: "https://seitrace.com",
        },
      },
    ],
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
npx hardhat run scripts/deploy.ts --network sei
npx hardhat run scripts/deploy.ts --network seiTestnet
```

## Contract Verification

### Foundry (Seitrace)

```bash
forge verify-contract $CONTRACT_ADDRESS src/Counter.sol:Counter \
  --chain 1329 \
  --verifier etherscan \
  --etherscan-api-key $SEITRACE_API_KEY \
  --verifier-url https://seitrace.com/api

# With constructor args
forge verify-contract $CONTRACT_ADDRESS src/Token.sol:Token \
  --chain 1329 \
  --verifier etherscan \
  --etherscan-api-key $SEITRACE_API_KEY \
  --verifier-url https://seitrace.com/api \
  --constructor-args $(cast abi-encode "constructor(string,string,uint256)" "MyToken" "MTK" 1000000000000000000000)
```

### Hardhat

```bash
npx hardhat verify --network sei $CONTRACT_ADDRESS
npx hardhat verify --network sei $CONTRACT_ADDRESS "MyToken" "MTK" 1000000000000000000000
```

## Deploying with viem

```typescript
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sei } from "./chains";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: sei,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: sei,
  transport: http(),
});

const hash = await walletClient.deployContract({
  abi: counterAbi,
  bytecode: counterBytecode,
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status === "reverted") {
  throw new Error(`Deployment reverted: ${hash}`);
}

console.log(`Deployed at: ${receipt.contractAddress}`);
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `PUSH0` opcode error | Compiler targeting shanghai+ | Set `evmVersion: "paris"` |
| Transaction underpriced | Gas price too low | Let the RPC estimate gas or increase `maxFeePerGas` |
| Chain ID mismatch | Wrong network in config | Mainnet = 1329, Testnet = 1328 |
| Verification fails | Wrong verifier URL | Use `https://seitrace.com/api` |
