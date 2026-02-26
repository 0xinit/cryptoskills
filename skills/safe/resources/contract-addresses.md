# Safe Contract Addresses

> **Last verified:** 2025-05-15 (verified onchain via `cast code`)

Safe uses the ERC-2470 singleton factory for deterministic cross-chain deployment. The addresses below are identical on all supported EVM chains.

## Core Contracts (v1.4.1)

| Contract | Address |
|----------|---------|
| Safe Singleton | `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| Safe Singleton (L2) | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` |
| SafeProxyFactory | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| MultiSend | `0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526` |
| MultiSendCallOnly | `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` |
| Compatibility Fallback Handler | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` |
| SignMessageLib | `0xd53cd0aB83D845Ac265BE939c57F53AD838012c9` |
| CreateCall | `0x9b35Af71d77eaf8d7e40252370304687390A1A52` |
| SimulateTxAccessor | `0x3d4BA2E0884aa488718476ca2FB8Efc291A46199` |

## Legacy Contracts (v1.3.0)

Still widely used. Many existing Safes run on v1.3.0 and cannot be upgraded in-place -- the proxy points to the v1.3.0 singleton permanently.

| Contract | Address |
|----------|---------|
| Safe Singleton | `0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552` |
| Safe Singleton (L2) | `0x3E5c63644E683549055b9Be8653de26E0B4CD36E` |
| SafeProxyFactory | `0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2` |
| MultiSend | `0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761` |
| MultiSendCallOnly | `0x40A2aCCbd92BCA938b02010E17A5b8929b49130D` |
| Compatibility Fallback Handler | `0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4` |

## Module Contracts

| Module | Address | Notes |
|--------|---------|-------|
| Allowance Module | `0xCFbFaC74C26F8647cBDb8c5caf80BB5b32E43134` | Spending limits for delegates |

Zodiac modules (Delay, Roles, Recovery) are deployed per-instance via the Module Proxy Factory. There are no canonical singleton addresses -- each Safe deploys its own module instance.

## Supported Chains (Same Addresses)

v1.4.1 contracts are deployed at the same addresses on:

- Ethereum Mainnet (1)
- Arbitrum One (42161)
- Base (8453)
- Optimism (10)
- Polygon (137)
- Gnosis Chain (100)
- Avalanche C-Chain (43114)
- BNB Chain (56)
- Sepolia (11155111)
- Goerli (5) -- deprecated

For the full list of supported networks, see:
https://github.com/safe-global/safe-deployments/tree/main/src/assets

## Verifying Addresses

```bash
# Verify contract exists at address
cast code 0x41675C099F32341bf84BFc5382aF534df5C7461a --rpc-url $RPC_URL

# Check which singleton a Safe proxy points to (stored in slot 0)
cast storage 0xYourSafeAddress 0x0 --rpc-url $RPC_URL
```

## Safe Transaction Service URLs

| Network | URL |
|---------|-----|
| Ethereum Mainnet | `https://safe-transaction-mainnet.safe.global` |
| Arbitrum | `https://safe-transaction-arbitrum.safe.global` |
| Base | `https://safe-transaction-base.safe.global` |
| Optimism | `https://safe-transaction-optimism.safe.global` |
| Polygon | `https://safe-transaction-polygon.safe.global` |
| Gnosis Chain | `https://safe-transaction-gnosis-chain.safe.global` |
| Avalanche | `https://safe-transaction-avalanche.safe.global` |
| BNB Chain | `https://safe-transaction-bsc.safe.global` |
| Sepolia | `https://safe-transaction-sepolia.safe.global` |

> Since API Kit v2, pass `chainId` to `new SafeApiKit({ chainId })` and the URL resolves automatically. You only need these URLs for direct REST API calls.
