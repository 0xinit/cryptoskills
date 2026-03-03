# ERC-7579 Modules for Safe

Deep-dive reference for using ERC-7579 modular smart account modules with Safe via the Safe7579 adapter. Covers module installation, the full module catalog, registry attestation, and production addresses.

## Prerequisites

```bash
npm install permissionless viem @rhinestone/module-sdk
```

## Creating a Safe Smart Account with Safe7579

Use `toSafeSmartAccount` from permissionless.js to create a Safe that supports ERC-7579 modules out of the box. The Safe7579 adapter addresses are passed during account creation.

```typescript
import { toSafeSmartAccount } from "permissionless/accounts";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});

const owner = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const safeAccount = await toSafeSmartAccount({
  client: publicClient,
  owners: [owner],
  version: "1.4.1",
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
  safe4337ModuleAddress: "0x7579EE8307284F293B1927136486880611F20002",
  erc7579LaunchpadAddress: "0x7579011aB74c46090561ea277Ba79D510c6C00ff",
});
```

## Installing and Managing Modules

Extend the smart account client with `erc7579Actions` to access module management methods.

```typescript
import { createSmartAccountClient } from "permissionless";
import { erc7579Actions } from "permissionless/actions/erc7579";
import { http } from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";

const smartAccountClient = createSmartAccountClient({
  account: safeAccount,
  chain: sepolia,
  bundlerTransport: http(
    `https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`
  ),
}).extend(
  erc7579Actions({
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  })
);

// Install a validator module
const installHash = await smartAccountClient.installModule({
  type: "validator",
  address: OWNABLE_VALIDATOR_ADDRESS,
  context: encodePacked(["address"], [owner.address]),
});

// Check if a module is installed
const isInstalled = await smartAccountClient.isModuleInstalled({
  type: "validator",
  address: OWNABLE_VALIDATOR_ADDRESS,
  context: "0x",
});

// Uninstall a module
const uninstallHash = await smartAccountClient.uninstallModule({
  type: "validator",
  address: OWNABLE_VALIDATOR_ADDRESS,
  context: encodePacked(["address"], [owner.address]),
});
```

## Deploying a New Safe with the Launchpad

The ERC-7579 Launchpad enables deploying a new Safe with modules pre-installed in a single transaction. The launchpad acts as a temporary implementation during the Safe's `setup` call, installs the specified modules, then hands control to the Safe singleton.

The launchpad address (`0x7579011aB74c46090561ea277Ba79D510c6C00ff`) is passed to `toSafeSmartAccount` as `erc7579LaunchpadAddress`. When the account does not yet exist on-chain, the first UserOperation triggers deployment through the launchpad, which:

1. Deploys the Safe proxy pointing to the launchpad as initial implementation
2. Calls `setupSafe()` which installs the Safe7579 adapter and all initial modules
3. Upgrades the proxy to point to the real Safe singleton

No separate deployment step is required -- the SDK handles this automatically on the first `sendUserOperation` call.

## Module Catalog

### OwnableValidator

Simple ECDSA-based ownership check. Supports single owner or multi-owner with threshold. The most basic validator -- use when you need standard EOA key authorization.

- **Type:** Validator
- **Use case:** Default signer for Safe, replace Safe's native owner system with ERC-7579 compatible validation
- **Install context:** ABI-encoded owner address(es)

### SmartSessions

Session keys with granular policy enforcement. Each session defines a signer (temporary key) bound to a set of policies that restrict what that key can do.

- **Type:** Validator
- **Use case:** dApp-scoped sessions, automated trading within limits, gasless UX for specific flows
- **Policies available:**
  - Time range (validAfter / validUntil)
  - Value limit per call
  - Contract address allowlist
  - Function selector allowlist
  - Cumulative spending cap
  - Usage count limit

### WebAuthn Validator

Passkey-based signing using the WebAuthn standard. The user authenticates via device biometrics (Touch ID, Face ID, Windows Hello) and the validator verifies the WebAuthn assertion on-chain.

- **Type:** Validator
- **Use case:** Seedless onboarding, mobile-native authentication, consumer wallets
- **Install context:** Public key coordinates (x, y) from the WebAuthn registration ceremony

### Social Recovery

Guardian-based account recovery. A set of trusted addresses (guardians) can collectively initiate a recovery to replace the account's validators after a timelock period.

- **Type:** Executor (initiates recovery) + Validator (new owner after recovery)
- **Use case:** Key loss recovery without seed phrases, enterprise backup mechanisms
- **Parameters:** Guardian addresses, threshold (e.g., 3-of-5), timelock duration

### Scheduled Orders

Automated execution triggered by a keeper network. Defines recurring actions (token transfers, yield harvesting, rebalancing) with cron-like scheduling.

- **Type:** Executor
- **Use case:** DCA strategies, recurring payments, auto-compounding yield positions
- **Execution:** Keeper calls the executor module which submits the pre-defined action through the Safe

## Module Registry (ERC-7484)

The Module Registry provides on-chain attestations about module security and compatibility. Before installing a module, the Safe (or its frontend) can query the registry to verify the module has been attested by a trusted entity.

### Registry Details

| Property | Value |
|----------|-------|
| Registry Address | `0x000000000069E2a187AEFFb852bF3cCdC95151B2` |
| Deployment | Deterministic across all EVM chains |
| Primary Attester | Rhinestone (`0x000000333034E9f539ce08819E12c1b8Cb29084d`) |
| Attestation Model | Attesters stake reputation; attestations are per-module, per-chain |

### Querying the Registry

```typescript
import { getModule, getAttestation } from "@rhinestone/module-sdk";

const module = getModule({
  module: OWNABLE_VALIDATOR_ADDRESS,
  type: "validator",
  initData: encodePacked(["address"], [owner.address]),
});

// The registry check is performed automatically by Safe7579 during
// installModule if the Safe has a registry configured. To manually
// verify before installation:
const attestation = await publicClient.readContract({
  address: "0x000000000069E2a187AEFFb852bF3cCdC95151B2",
  abi: registryAbi,
  functionName: "getAttestation",
  args: [OWNABLE_VALIDATOR_ADDRESS, "0x000000333034E9f539ce08819E12c1b8Cb29084d"],
});
```

## Key Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `permissionless` | ^0.2 | Smart account client, ERC-7579 actions, bundler integration |
| `@rhinestone/module-sdk` | ^0.4.0 | Module installation helpers, registry queries |
| `@rhinestone/sdk` | ^0.1 | Higher-level Rhinestone platform SDK |
| `viem` | ^2.21 | Transport, encoding, chain definitions |

## Production Addresses

> **Last verified:** March 2026

| Contract | Address | Notes |
|----------|---------|-------|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Singleton, all EVM chains |
| Module Registry (ERC-7484) | `0x000000000069E2a187AEFFb852bF3cCdC95151B2` | Singleton, all EVM chains |
| Safe Singleton v1.4.1 | `0x41675C099F32341bf84BFc5382aF534df5C7461a` | Deterministic deployment |
| Safe7579 Adapter | `0x7579EE8307284F293B1927136486880611F20002` | Safe Module + Fallback Handler |
| ERC-7579 Launchpad | `0x7579011aB74c46090561ea277Ba79D510c6C00ff` | First-deploy bootstrapper |
| Rhinestone Attester | `0x000000333034E9f539ce08819E12c1b8Cb29084d` | Primary registry attester |

## Production Adoption

Safe secures over $100B in assets across EVM chains. ERC-7579 adoption is growing across the smart account ecosystem:

- **Safe** -- native ERC-7579 support via Safe7579 adapter
- **ZeroDev Kernel** -- ERC-7579 modular account, session keys, passkeys
- **Biconomy Nexus** -- ERC-7579 compatible account with module marketplace
- **OKX Wallet** -- integrated ERC-7579 smart account for mobile

The Rhinestone Module Registry provides a shared trust layer, enabling any ERC-7579 module to work across all compatible account implementations without per-vendor integration.

## References

- [ERC-7579: Minimal Modular Smart Accounts](https://eips.ethereum.org/EIPS/eip-7579)
- [ERC-7484: Registry for Module Smart Accounts](https://eips.ethereum.org/EIPS/eip-7484)
- [Safe7579 Documentation](https://docs.rhinestone.wtf/module-sdk/account-integrations/safe)
- [Rhinestone Module SDK](https://github.com/rhinestonewtf/module-sdk)
- [permissionless.js ERC-7579 Actions](https://docs.pimlico.io/permissionless/reference/erc7579-actions)
- [Safe Modular Smart Accounts Guide](https://docs.safe.global/advanced/erc-7579/overview)
