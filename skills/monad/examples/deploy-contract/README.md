# Deploy Contract to Monad

Deploy and verify a smart contract on Monad using Foundry and viem. Covers Foundry script deployment, viem programmatic deployment, and contract verification on multiple explorers.

## Foundry Deployment

### Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Counter {
    uint256 private _count;

    event CountChanged(address indexed caller, uint256 newCount);

    error CounterOverflow();

    function increment() external {
        uint256 newCount = _count + 1;
        if (newCount < _count) revert CounterOverflow();
        _count = newCount;
        emit CountChanged(msg.sender, newCount);
    }

    function count() external view returns (uint256) {
        return _count;
    }
}
```

### Deploy Script

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract DeployCounter is Script {
    function run() external {
        vm.startBroadcast();
        Counter counter = new Counter();
        console.log("Counter deployed at:", address(counter));
        vm.stopBroadcast();
    }
}
```

### foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
evm_version = "prague"

[rpc_endpoints]
monad = "https://rpc.monad.xyz"
monad_testnet = "https://testnet-rpc.monad.xyz"

[etherscan]
monad = { key = "${ETHERSCAN_API_KEY}", chain = 143, url = "https://api.etherscan.io/v2/api?chainid=143" }
```

### Deploy Commands

```bash
# Import deployer key into Foundry keystore (never pass raw private keys on CLI)
cast wallet import monad-deployer --interactive

# Deploy via script -- use --slow for mainnet to wait for confirmations
forge script script/DeployCounter.s.sol \
  --account monad-deployer \
  --rpc-url https://rpc.monad.xyz \
  --broadcast \
  --slow

# Direct deploy (simpler, no script needed)
forge create src/Counter.sol:Counter \
  --account monad-deployer \
  --rpc-url https://rpc.monad.xyz \
  --broadcast
```

### Verify on MonadVision (Sourcify)

```bash
forge verify-contract <DEPLOYED_ADDRESS> Counter \
  --chain 143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

### Verify on Monadscan (Etherscan)

```bash
forge verify-contract <DEPLOYED_ADDRESS> Counter \
  --chain 143 \
  --verifier etherscan \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --watch
```

## viem Programmatic Deployment

### Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"], webSocket: ["wss://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://monadvision.com" },
  },
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: monad,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: monad,
  transport: http(),
});
```

### Deploy with Explicit Gas Limit

Monad charges for gas limit, not gas used. Estimate first, then set a tight limit to avoid overpaying.

```typescript
async function deployContract(bytecode: Hex, abi: readonly unknown[]) {
  const estimatedGas = await publicClient.estimateGas({
    account: account.address,
    data: bytecode,
  });

  // Add 10% buffer to estimated gas -- not 3x like on Ethereum
  // Monad charges for the full limit, so tighter is cheaper
  const gasLimit = (estimatedGas * 110n) / 100n;

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    gas: gasLimit,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Deploy reverted in tx ${hash}`);
  }

  if (!receipt.contractAddress) {
    throw new Error(`No contract address in receipt for tx ${hash}`);
  }

  console.log(`Deployed at ${receipt.contractAddress}`);
  console.log(`Gas limit: ${gasLimit} | Gas used: ${receipt.gasUsed}`);
  console.log(`Overpayment: ${gasLimit - receipt.gasUsed} gas units`);

  return receipt.contractAddress;
}
```

### Deploy Counter

```typescript
const counterAbi = [
  {
    name: "increment",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "count",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Bytecode from `forge build` output (artifacts/Counter.sol/Counter.json)
const counterBytecode: Hex = "0x..."; // paste compiled bytecode here

const counterAddress = await deployContract(counterBytecode, counterAbi);
```

### Interact After Deploy

```typescript
async function incrementAndRead(contractAddress: Address) {
  const incrementHash = await walletClient.writeContract({
    address: contractAddress,
    abi: counterAbi,
    functionName: "increment",
    gas: 30_000n, // Fixed-cost operation -- set tight limit
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: incrementHash,
  });
  if (receipt.status !== "success") {
    throw new Error(`Increment reverted in tx ${incrementHash}`);
  }

  const currentCount = await publicClient.readContract({
    address: contractAddress,
    abi: counterAbi,
    functionName: "count",
  });

  console.log(`Count: ${currentCount}`);
  return currentCount;
}

await incrementAndRead(counterAddress);
```

## Deploy with Constructor Arguments

```typescript
const tokenAbi = [
  {
    type: "constructor",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "initialSupply", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

const tokenBytecode: Hex = "0x..."; // compiled ERC-20 bytecode

const initialSupply = 1_000_000n * 10n ** 18n; // 1M tokens, 18 decimals

const hash = await walletClient.deployContract({
  abi: tokenAbi,
  bytecode: tokenBytecode,
  args: ["MyToken", "MTK", initialSupply],
  gas: 800_000n,
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  throw new Error(`Token deploy reverted in tx ${hash}`);
}

console.log(`Token deployed at ${receipt.contractAddress}`);
```

## Pre-Deploy Checklist

- Account funded with MON (check balance exceeds deploy cost plus ~10 MON reserve)
- Using Monad Foundry fork (`foundryup --network monad`) or `evm_version = "prague"`
- Chain ID set to 143 (mainnet) or 10143 (testnet)
- Gas limit set explicitly to avoid overpaying under gas-limit charging
- Private key stored in env var or Foundry keystore, never in source
- Contract size under 128 KB (Monad limit, 5x Ethereum's 24.5 KB)
