/**
 * Hardhat Project Starter Config
 *
 * Production-ready hardhat.config.ts with multi-network support,
 * verification, gas reporting, and forking.
 *
 * Usage:
 * 1. Copy this file to your project root as hardhat.config.ts
 * 2. npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
 * 3. npm install --save-dev @openzeppelin/hardhat-upgrades (if using proxies)
 * 4. Create .env with required variables (see bottom of file)
 * 5. npx hardhat compile
 */

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },

  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: process.env.MAINNET_RPC_URL ?? "",
        blockNumber: 19_500_000,
        enabled: process.env.FORK_ENABLED === "true",
      },
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? "",
      accounts,
      chainId: 11155111,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL ?? "",
      accounts,
      chainId: 1,
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL ?? "",
      accounts,
      chainId: 42161,
    },
    base: {
      url: process.env.BASE_RPC_URL ?? "",
      accounts,
      chainId: 8453,
    },
    optimism: {
      url: process.env.OPTIMISM_RPC_URL ?? "",
      accounts,
      chainId: 10,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL ?? "",
      accounts,
      chainId: 137,
    },
  },

  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY ?? "",
      sepolia: process.env.ETHERSCAN_API_KEY ?? "",
      arbitrumOne: process.env.ARBISCAN_API_KEY ?? "",
      base: process.env.BASESCAN_API_KEY ?? "",
      optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_API_KEY ?? "",
      polygon: process.env.POLYGONSCAN_API_KEY ?? "",
    },
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },

  mocha: {
    timeout: 60_000,
  },
};

export default config;

/**
 * Required .env variables:
 *
 * DEPLOYER_PRIVATE_KEY=0x...         # deployer account private key
 * MAINNET_RPC_URL=https://...        # Ethereum mainnet RPC (archive for forking)
 * SEPOLIA_RPC_URL=https://...        # Sepolia testnet RPC
 * ARBITRUM_RPC_URL=https://...       # Arbitrum One RPC
 * BASE_RPC_URL=https://...           # Base RPC
 * OPTIMISM_RPC_URL=https://...       # Optimism RPC
 * POLYGON_RPC_URL=https://...        # Polygon RPC
 * ETHERSCAN_API_KEY=...              # Etherscan API key
 * ARBISCAN_API_KEY=...               # Arbiscan API key
 * BASESCAN_API_KEY=...               # Basescan API key
 * OPTIMISTIC_ETHERSCAN_API_KEY=...   # Optimism Etherscan API key
 * POLYGONSCAN_API_KEY=...            # Polygonscan API key
 * COINMARKETCAP_API_KEY=...          # for USD gas prices (optional)
 * REPORT_GAS=true                    # enable gas reporting (optional)
 * FORK_ENABLED=true                  # enable mainnet forking (optional)
 */
