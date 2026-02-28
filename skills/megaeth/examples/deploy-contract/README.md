# Deploying Contracts to MegaETH

MegaETH is EVM-compatible but has a different gas model. Local simulation (Foundry/Hardhat) uses standard EVM gas costs, which diverge from MegaEVM's dual gas model. Always use `--skip-simulation` for Foundry deploys.

## Environment Setup

```bash
# .env -- never commit this file
PRIVATE_KEY=0xYourPrivateKeyHere
MEGAETH_RPC_URL=https://mainnet.megaeth.com/rpc
MEGAETH_TESTNET_RPC_URL=https://carrot.megaeth.com/rpc
ETHERSCAN_API_KEY=YourEtherscanApiKey
```

## Foundry Deployment

### foundry.toml

Never set `via_ir = true` -- it silently breaks return values on MegaETH (functions return 0 with no compiler error).

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
megaeth = "${MEGAETH_RPC_URL}"
megaeth_testnet = "${MEGAETH_TESTNET_RPC_URL}"

[etherscan]
megaeth = { key = "${ETHERSCAN_API_KEY}", url = "https://api.etherscan.io/v2/api?chainid=4326", chain = 4326 }
```

### Deploy Script

```solidity
// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract DeployScript is Script {
    function run() external returns (Counter) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        Counter counter = new Counter();
        console.log("Counter deployed to:", address(counter));

        vm.stopBroadcast();
        return counter;
    }
}
```

### Example Contract

```solidity
// src/Counter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Counter {
    error Counter__Overflow();

    event ValueChanged(uint256 indexed oldValue, uint256 indexed newValue);

    uint256 public value;

    /// @notice Increment counter by 1
    /// @dev Reverts on uint256 overflow
    function increment() external {
        uint256 oldValue = value;
        uint256 newValue = oldValue + 1;
        if (newValue < oldValue) revert Counter__Overflow();
        value = newValue;
        emit ValueChanged(oldValue, newValue);
    }

    /// @notice Set counter to a specific value
    /// @param newValue The value to set
    function setValue(uint256 newValue) external {
        uint256 oldValue = value;
        value = newValue;
        emit ValueChanged(oldValue, newValue);
    }
}
```

### Deploy to Testnet

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url megaeth_testnet \
  --broadcast \
  --skip-simulation
```

### Deploy to Mainnet

```bash
# --slow recommended for mainnet to avoid nonce issues
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url megaeth \
  --broadcast \
  --skip-simulation \
  --slow
```

### Direct Deploy (forge create)

```bash
# Testnet
forge create src/Counter.sol:Counter \
  --rpc-url $MEGAETH_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --skip-simulation

# Mainnet
forge create src/Counter.sol:Counter \
  --rpc-url $MEGAETH_RPC_URL \
  --private-key $PRIVATE_KEY \
  --skip-simulation \
  --slow
```

## Viem Deployment

```typescript
import {
  defineChain,
  createPublicClient,
  createWalletClient,
  http,
  encodeDeployData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const megaeth = defineChain({
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://mega.etherscan.io' },
  },
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: megaeth, transport: http() });
const walletClient = createWalletClient({ account, chain: megaeth, transport: http() });

async function deploy(abi: readonly unknown[], bytecode: `0x${string}`) {
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    gas: 5_000_000n,
    maxFeePerGas: 1_000_000n,
    maxPriorityFeePerGas: 0n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`Deploy reverted: tx ${hash}`);
  }

  return receipt.contractAddress;
}
```

## Contract Verification

```bash
# Verify on Etherscan (MegaETH mainnet)
forge verify-contract <CONTRACT_ADDRESS> src/Counter.sol:Counter \
  --chain 4326 \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=4326"

# With constructor arguments
forge verify-contract <CONTRACT_ADDRESS> src/Token.sol:Token \
  --chain 4326 \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=4326" \
  --constructor-args $(cast abi-encode "constructor(string,string)" "MyToken" "MTK")
```

## Hardhat Deployment

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  networks: {
    megaeth: {
      url: process.env.MEGAETH_RPC_URL || 'https://mainnet.megaeth.com/rpc',
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 4326,
    },
    megaethTestnet: {
      url: process.env.MEGAETH_TESTNET_RPC_URL || 'https://carrot.megaeth.com/rpc',
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 6343,
    },
  },
};

export default config;
```

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
npx hardhat run scripts/deploy.ts --network megaeth
```

## Common Pitfalls

1. **Missing `--skip-simulation`** -- Foundry simulates locally with standard EVM gas costs. MegaEVM has different SSTORE costs and a 60K intrinsic gas (not 21K). Simulation will give wrong gas estimates or revert.

2. **Using `via_ir = true`** -- Silently corrupts return values. Functions return 0 instead of correct values with no compiler error. Use `optimizer = true` with `optimizer_runs = 200`.

3. **Underestimating gas for storage-heavy contracts** -- SSTORE (0 to non-zero) costs 2M+ gas multiplied by a bucket multiplier. Factory contracts or contracts initializing many storage slots will cost significantly more than on Ethereum.

4. **Viem's gas buffer** -- Viem adds a 20% gas buffer by default. On MegaETH with fixed 0.001 gwei base fee, set `maxFeePerGas: 1_000_000n` explicitly to avoid overpaying.
