# Monad Deployment & Verification Guide

## Foundry (Recommended)

### Install Monad Foundry Fork

The Monad fork includes gas pricing and precompile adjustments.

```bash
# Install the Monad foundry installer
curl -L https://raw.githubusercontent.com/category-labs/foundry/monad/foundryup/install | bash

# Install binaries with Monad support
foundryup --network monad
```

Provides `forge`, `cast`, `anvil`, `chisel` with Monad-specific pricing.

### Project Setup

```bash
# Recommended: use the Monad template
forge init --template monad-developers/foundry-monad my-project

# Or standard init
forge init my-project
```

### foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
evm_version = "prague"

# Mainnet
eth-rpc-url = "https://rpc.monad.xyz"
chain_id = 143

# Metadata settings for verification
metadata = true
metadata_hash = "none"
use_literal_content = true

[rpc_endpoints]
monad = "https://rpc.monad.xyz"
monad_testnet = "https://testnet-rpc.monad.xyz"

[etherscan]
monad = { key = "${ETHERSCAN_API_KEY}", chain = 143, url = "https://api.etherscan.io/v2/api?chainid=143" }
monad_testnet = { key = "${ETHERSCAN_API_KEY}", chain = 10143, url = "https://api.etherscan.io/v2/api?chainid=10143" }
```

### Deploy with Keystore (Recommended)

```bash
# Create keystore
cast wallet import monad-deployer --private-key $(cast wallet new | grep 'Private key:' | awk '{print $3}')

# Check address
cast wallet address --account monad-deployer

# Deploy
forge create src/MyContract.sol:MyContract \
  --account monad-deployer \
  --rpc-url https://rpc.monad.xyz \
  --broadcast

# Deploy with constructor args
forge create src/MyToken.sol:MyToken \
  --account monad-deployer \
  --rpc-url https://rpc.monad.xyz \
  --constructor-args "MyToken" "MTK" 18 \
  --broadcast
```

### Deploy with Script

```bash
forge script script/Deploy.s.sol \
  --account monad-deployer \
  --rpc-url https://rpc.monad.xyz \
  --broadcast \
  --slow  # recommended for mainnet
```

### Verify with Foundry

**MonadVision (Sourcify):**
```bash
forge verify-contract <address> <ContractName> \
  --chain 143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

**Monadscan (Etherscan):**
```bash
forge verify-contract <address> <ContractName> \
  --chain 143 \
  --verifier etherscan \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --watch
```

**Socialscan:**
```bash
forge verify-contract <address> <ContractName> \
  --chain 143 \
  --verifier etherscan \
  --etherscan-api-key $SOCIALSCAN_API_KEY \
  --verifier-url https://api.socialscan.io/monad-mainnet/v1/explorer/command_api/contract \
  --watch
```

**Testnet:** Replace `--chain 143` with `--chain 10143` and use testnet RPC/explorer URLs.

## Hardhat

### Hardhat 2 Setup

```bash
git clone https://github.com/monad-developers/hardhat-monad.git my-project
cd my-project
npm install
cp .env.example .env
# Edit .env with PRIVATE_KEY
```

### Hardhat 2 Config

```typescript
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-ignition-viem";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "prague",
      metadata: { bytecodeHash: "ipfs" },
    },
  },
  networks: {
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: [process.env.PRIVATE_KEY!],
    },
    monadMainnet: {
      url: "https://rpc.monad.xyz",
      chainId: 143,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify-api-monad.blockvision.org",
    browserUrl: "https://monadvision.com",
  },
  etherscan: {
    enabled: true,
    customChains: [
      {
        network: "monadMainnet",
        chainId: 143,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=143",
          browserURL: "https://monadscan.com",
        },
      },
      {
        network: "monadTestnet",
        chainId: 10143,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=10143",
          browserURL: "https://testnet.monadscan.com",
        },
      },
    ],
  },
};

export default config;
```

### Hardhat 2 Deploy & Verify

```bash
# Deploy to testnet
npx hardhat ignition deploy ignition/modules/Counter.ts --network monadTestnet

# Deploy to mainnet
npx hardhat ignition deploy ignition/modules/Counter.ts --network monadMainnet

# Redeploy (new address)
npx hardhat ignition deploy ignition/modules/Counter.ts --network monadMainnet --reset

# Verify
npx hardhat verify <address> --network monadMainnet
```

### Hardhat 3 Setup

```bash
git clone https://github.com/monad-developers/hardhat3-monad.git my-project
cd my-project
npm install
# Create .env with PRIVATE_KEY and ETHERSCAN_API_KEY
```

### Hardhat 3 Config

```typescript
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    monadTestnet: {
      type: "http",
      url: "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts: [process.env.PRIVATE_KEY!],
    },
    monadMainnet: {
      type: "http",
      url: "https://rpc.monad.xyz",
      chainId: 143,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
  verify: {
    etherscan: { enabled: true, apiKey: process.env.ETHERSCAN_API_KEY! },
    sourcify: {
      enabled: true,
      apiUrl: "https://sourcify-api-monad.blockvision.org",
    },
  },
  chainDescriptors: {
    143: {
      name: "MonadMainnet",
      blockExplorers: {
        etherscan: {
          name: "Monadscan",
          url: "https://monadscan.com",
          apiUrl: "https://api.etherscan.io/v2/api",
        },
      },
    },
  },
});
```

## Remix

1. Open https://remix.ethereum.org
2. Write/import contract
3. Compile with Solidity 0.8.28+, EVM version Prague
4. Deploy -> Injected Provider (MetaMask connected to Monad)
5. Select Monad network in MetaMask (Chain ID 143 or 10143)

## Pre-Deployment Checklist

- [ ] Using Monad Foundry fork or Hardhat with `evmVersion: "prague"`
- [ ] Correct chain ID (143 mainnet / 10143 testnet)
- [ ] Account funded with MON (remember ~10 MON reserve)
- [ ] Gas limit set explicitly for predictable cost (gas limit is charged, not gas used)
- [ ] Private key in env var, not hardcoded
- [ ] Contract size under 128 KB
- [ ] No EIP-4844 blob transactions (type 3 not supported)
- [ ] Verified on at least one explorer after deploy
