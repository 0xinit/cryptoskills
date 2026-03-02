# Account Abstraction SDK Comparison

> **Last verified:** February 2026

Comparison of major ERC-4337 SDKs for building smart account integrations.

## Feature Matrix

| Feature | permissionless.js | ZeroDev | Alchemy Account Kit | Biconomy | Safe{Core} |
|---------|-------------------|---------|---------------------|----------|------------|
| **Smart Account Types** | SimpleAccount, Kernel, Safe, custom | Kernel (ERC-7579) | LightAccount, MultiOwnerLightAccount | Biconomy SA v2 | Safe multisig |
| **EntryPoint v0.7** | Yes | Yes | Yes | Yes | Yes |
| **EIP-7702 Support** | Yes (via viem) | Planned | Planned | No | No |
| **Paymaster: Verifying** | Yes | Yes | Yes | Yes | Yes |
| **Paymaster: ERC-20** | Yes (Pimlico) | Yes | Yes | Yes | No |
| **Session Keys** | Via Kernel plugin | Yes (native) | Yes | Yes | Via modules |
| **Passkey Signer** | Via plugins | Yes (native) | Yes | Yes | Via modules |
| **Batch Transactions** | Yes | Yes | Yes | Yes | Yes |
| **ERC-7579 Modules** | Yes (Kernel) | Yes (native) | Partial | No | Via modules |
| **Chain Support** | 30+ chains | 20+ chains | 10+ chains | 15+ chains | 15+ chains |
| **Bundler Included** | No (bring your own) | Yes (ZeroDev infra) | Yes (Alchemy Rundler) | Yes (Biconomy infra) | No |
| **Open Source** | Yes (MIT) | Yes (MIT) | Yes (MIT) | Partial | Yes (LGPL) |
| **Bundle Size** | ~15 KB (tree-shakeable) | ~40 KB | ~60 KB | ~50 KB | ~80 KB |
| **Framework** | viem-native | viem-based | React-first, viem | ethers.js + viem | ethers.js + viem |
| **Gas Estimation** | Via bundler RPC | Built-in | Built-in | Built-in | Via bundler RPC |

## When to Use Each

### permissionless.js
- **Best for:** Developers who want low-level control with viem-native APIs
- **Strengths:** Minimal bundle size, framework-agnostic, bring-your-own bundler flexibility, widest smart account type support
- **Trade-off:** Requires choosing and configuring your own bundler and paymaster providers

### ZeroDev
- **Best for:** Apps needing session keys, passkeys, and modular plugins out of the box
- **Strengths:** Kernel is the most modular ERC-7579 account, native session key framework, passkey support
- **Trade-off:** Tightly coupled to ZeroDev infrastructure for best experience

### Alchemy Account Kit
- **Best for:** React-based dApps wanting a batteries-included solution
- **Strengths:** React hooks and components, built-in Alchemy bundler, gas manager dashboard
- **Trade-off:** Strongest integration with Alchemy infrastructure. Less flexible for custom setups

### Biconomy
- **Best for:** Mobile and gaming dApps needing gasless transactions
- **Strengths:** Mature SDK, good mobile support, simple gasless setup
- **Trade-off:** Custom account implementation (not ERC-7579), partial open source

### Safe{Core}
- **Best for:** Enterprise and DAO applications needing multisig with account abstraction
- **Strengths:** Battle-tested Safe multisig, extensive module ecosystem, audit track record
- **Trade-off:** Heavier bundle size, complex module system, multisig overhead for single-owner use cases

## Reference

- [permissionless.js docs](https://docs.pimlico.io/permissionless)
- [ZeroDev docs](https://docs.zerodev.app)
- [Alchemy Account Kit](https://accountkit.alchemy.com)
- [Biconomy docs](https://docs.biconomy.io)
- [Safe{Core} docs](https://docs.safe.global)
