# hardhat.config.ts Reference

Complete configuration options for Hardhat v2.x. All options go in the default export of `hardhat.config.ts`.

Last verified: 2025-05-01

Source: [Hardhat Configuration](https://hardhat.org/hardhat-runner/docs/config)

## Structure

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: { /* ... */ },
  networks: { /* ... */ },
  etherscan: { /* ... */ },
  paths: { /* ... */ },
  mocha: { /* ... */ },
  gasReporter: { /* ... */ },
};

export default config;
```

## solidity

### Single Version

```typescript
solidity: "0.8.27",
```

### With Optimizer

```typescript
solidity: {
  version: "0.8.27",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200, // optimize for average number of function calls
    },
    evmVersion: "cancun", // target EVM version
    viaIR: false, // IR-based codegen (slower compile, sometimes smaller bytecode)
  },
},
```

`runs` parameter: lower values optimize for deployment cost, higher values optimize for call cost. 200 is the default trade-off.

### Multiple Compiler Versions

```typescript
solidity: {
  compilers: [
    { version: "0.8.27", settings: { optimizer: { enabled: true, runs: 200 } } },
    { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 1000 } } },
  ],
  overrides: {
    "contracts/legacy/OldContract.sol": {
      version: "0.7.6",
      settings: { optimizer: { enabled: true, runs: 200 } },
    },
  },
},
```

Hardhat picks the highest compatible version for each file. Use `overrides` when a file needs a specific version.

## networks

### Hardhat Network (Local)

```typescript
networks: {
  hardhat: {
    chainId: 31337,
    gas: "auto",
    gasPrice: "auto",
    blockGasLimit: 30_000_000,
    initialBaseFeePerGas: 0, // set to 0 for simpler gas in tests
    mining: {
      auto: true, // mine a block per tx (default)
      interval: 0, // or set interval in ms for block time simulation
    },
    accounts: {
      count: 20, // number of test accounts
      accountsBalance: "10000000000000000000000", // 10,000 ETH each (in wei string)
    },
    forking: {
      url: "https://eth-mainnet.g.alchemy.com/v2/KEY",
      blockNumber: 19_500_000,
      enabled: false,
    },
    allowUnlimitedContractSize: false, // true disables 24KB EIP-170 limit (testing only)
    loggingEnabled: false,
  },
},
```

### Live Network

```typescript
networks: {
  mainnet: {
    url: process.env.MAINNET_RPC_URL ?? "",
    chainId: 1,
    accounts: process.env.DEPLOYER_PRIVATE_KEY
      ? [process.env.DEPLOYER_PRIVATE_KEY]
      : [],
    gasPrice: "auto",
    gas: "auto",
    timeout: 60_000, // ms before tx timeout
    httpHeaders: {}, // custom headers for RPC
  },
},
```

### Account Configuration Options

```typescript
// Single private key
accounts: ["0xPRIVATE_KEY"],

// Multiple private keys
accounts: [
  process.env.DEPLOYER_PRIVATE_KEY ?? "",
  process.env.ADMIN_PRIVATE_KEY ?? "",
],

// HD Wallet
accounts: {
  mnemonic: process.env.MNEMONIC ?? "",
  path: "m/44'/60'/0'/0",
  initialIndex: 0,
  count: 5,
},

// Remote signer (no private key in config)
// Use with Hardhat Ignition or custom signer plugins
```

## etherscan

```typescript
etherscan: {
  apiKey: {
    mainnet: process.env.ETHERSCAN_API_KEY ?? "",
    sepolia: process.env.ETHERSCAN_API_KEY ?? "",
    arbitrumOne: process.env.ARBISCAN_API_KEY ?? "",
    optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_API_KEY ?? "",
    base: process.env.BASESCAN_API_KEY ?? "",
    polygon: process.env.POLYGONSCAN_API_KEY ?? "",
  },
  customChains: [
    {
      network: "customNetwork",
      chainId: 12345,
      urls: {
        apiURL: "https://api.custom-explorer.com/api",
        browserURL: "https://custom-explorer.com",
      },
    },
  ],
},
```

Supported network names for `apiKey`: `mainnet`, `sepolia`, `holesky`, `arbitrumOne`, `arbitrumSepolia`, `optimisticEthereum`, `base`, `baseSepolia`, `polygon`, `polygonMumbai`, `bsc`, `bscTestnet`.

## paths

```typescript
paths: {
  sources: "./contracts",     // Solidity source files
  tests: "./test",            // Test files
  cache: "./cache",           // Hardhat cache
  artifacts: "./artifacts",   // Compiled artifacts
},
```

Default paths shown. Override only if your project uses a non-standard layout.

## mocha

```typescript
mocha: {
  timeout: 40_000, // ms per test (default 20000)
  parallel: false,  // enable parallel test execution
  bail: false,      // stop on first failure
  grep: "",         // filter tests by name
},
```

Increase `timeout` for fork tests — RPC calls add latency.

## gasReporter

Requires `hardhat-gas-reporter` (included in toolbox):

```typescript
gasReporter: {
  enabled: process.env.REPORT_GAS === "true",
  currency: "USD",
  coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  token: "ETH",
  gasPriceApi: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
  outputFile: "gas-report.txt",
  noColors: true,
  excludeContracts: ["MockERC20", "TestHelper"],
},
```

## Environment Variables Pattern

```typescript
import * as dotenv from "dotenv";
dotenv.config();
```

Required env vars (add to `.env`, never commit):

```
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/KEY
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/KEY
DEPLOYER_PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=...
COINMARKETCAP_API_KEY=...
REPORT_GAS=true
```

## Full Example

See `templates/hardhat-project.ts` for a complete production-ready config combining all sections.
