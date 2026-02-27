# Hardhat Plugin Reference

Essential plugins for Hardhat v2.x projects. Install with `npm install --save-dev <package>` and import in `hardhat.config.ts`.

Last verified: 2025-05-01

## Core Plugins (Nomic Foundation)

| Plugin | Package | Purpose |
|--------|---------|---------|
| Toolbox | `@nomicfoundation/hardhat-toolbox` | Meta-plugin: bundles ethers, chai matchers, coverage, gas reporter, typechain |
| Ethers | `@nomicfoundation/hardhat-ethers` | ethers.js v6 integration (included in toolbox) |
| Chai Matchers | `@nomicfoundation/hardhat-chai-matchers` | `.to.be.revertedWith()`, `.to.emit()`, `.to.changeTokenBalance()` (included in toolbox) |
| Network Helpers | `@nomicfoundation/hardhat-network-helpers` | `loadFixture`, `time`, `mine`, `impersonateAccount` (included in toolbox) |
| Verify | `@nomicfoundation/hardhat-verify` | Etherscan/Blockscout source verification (included in toolbox) |
| Ignition | `@nomicfoundation/hardhat-ignition` | Declarative deployment system with state tracking |
| Ignition + Ethers | `@nomicfoundation/hardhat-ignition-ethers` | Ignition integration with ethers.js |

## TypeScript & Types

| Plugin | Package | Purpose |
|--------|---------|---------|
| TypeChain Hardhat | `@typechain/hardhat` | Auto-generates TypeScript types from compiled ABIs (included in toolbox) |
| TypeChain Ethers v6 | `@typechain/ethers-v6` | TypeChain target for ethers v6 (included in toolbox) |

Generated types live in `typechain-types/`. Run `npx hardhat compile` to regenerate after contract changes.

## OpenZeppelin

| Plugin | Package | Purpose |
|--------|---------|---------|
| Upgrades | `@openzeppelin/hardhat-upgrades` | Deploy and manage UUPS/Transparent proxies with safety checks |

```typescript
import "@openzeppelin/hardhat-upgrades";

// Deploy proxy
const proxy = await upgrades.deployProxy(Factory, [args], { kind: "uups" });

// Upgrade
await upgrades.upgradeProxy(proxyAddress, NewFactory, { kind: "uups" });

// Validate upgrade safety (no deploy)
await upgrades.validateUpgrade(proxyAddress, NewFactory);
```

## Testing & Analysis

| Plugin | Package | Purpose |
|--------|---------|---------|
| Gas Reporter | `hardhat-gas-reporter` | Per-function gas usage in test output (included in toolbox) |
| Coverage | `solidity-coverage` | Code coverage with HTML report (included in toolbox) |
| Contract Sizer | `hardhat-contract-sizer` | Reports bytecode size per contract, fails on >24KB |
| Storage Layout | `hardhat-storage-layout` | Exports storage layout for each contract |

### Gas Reporter Config

```typescript
gasReporter: {
  enabled: process.env.REPORT_GAS === "true",
  currency: "USD",
  coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  outputFile: "gas-report.txt",
  noColors: true, // for CI output
},
```

### Contract Sizer Config

```typescript
import "hardhat-contract-sizer";

contractSizer: {
  alphaSort: true,
  runOnCompile: true,
  disambiguatePaths: false,
  strict: true, // fail build if any contract exceeds 24KB EIP-170 limit
},
```

## Deployment & Operations

| Plugin | Package | Purpose |
|--------|---------|---------|
| ABI Exporter | `hardhat-abi-exporter` | Export clean ABIs to a directory |
| Tracer | `hardhat-tracer` | Detailed transaction traces in test output |

### ABI Exporter Config

```typescript
import "hardhat-abi-exporter";

abiExporter: {
  path: "./abi",
  runOnCompile: true,
  clear: true,
  flat: true,
  only: ["Token", "Vault"], // filter by contract name
},
```

## Foundry Integration

| Plugin | Package | Purpose |
|--------|---------|---------|
| Foundry | `@nomicfoundation/hardhat-foundry` | Use Hardhat and Foundry in the same project |

Enables `forge` and `hardhat` to share the same `contracts/` directory and dependencies. Useful for teams migrating incrementally or wanting Foundry's fuzz testing with Hardhat's deployment tooling.

```typescript
import "@nomicfoundation/hardhat-foundry";
```

## Deprecated Plugins (Do NOT Use)

| Old Package | Replacement |
|-------------|-------------|
| `@nomiclabs/hardhat-ethers` | `@nomicfoundation/hardhat-ethers` (in toolbox) |
| `@nomiclabs/hardhat-waffle` | `@nomicfoundation/hardhat-chai-matchers` (in toolbox) |
| `@nomiclabs/hardhat-etherscan` | `@nomicfoundation/hardhat-verify` (in toolbox) |
| `hardhat-deploy` | `@nomicfoundation/hardhat-ignition` |

The `@nomiclabs/` scoped packages are unmaintained. The `@nomicfoundation/` replacements are bundled in `hardhat-toolbox`.
