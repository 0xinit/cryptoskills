# Aptos Module Addresses

Core framework and protocol module addresses on Aptos mainnet.

## Framework Modules (0x1)

All core framework modules are published at address `0x1`.

| Module | Address | Description |
|--------|---------|-------------|
| `aptos_framework::account` | `0x1` | Account creation, rotation, signer capabilities |
| `aptos_framework::coin` | `0x1` | Coin standard (register, transfer, mint, burn) |
| `aptos_framework::aptos_coin` | `0x1` | APT native coin type definition |
| `aptos_framework::aptos_account` | `0x1` | High-level account operations (transfer with auto-register) |
| `aptos_framework::managed_coin` | `0x1` | Managed coin initialization and registration |
| `aptos_framework::staking_contract` | `0x1` | Delegation staking |
| `aptos_framework::stake` | `0x1` | Validator staking pool |
| `aptos_framework::delegation_pool` | `0x1` | Delegated staking pools |
| `aptos_framework::timestamp` | `0x1` | Block timestamp access |
| `aptos_framework::block` | `0x1` | Block height and metadata |
| `aptos_framework::event` | `0x1` | Event emission (v2 events) |
| `aptos_framework::object` | `0x1` | Move Object model (create, transfer, own) |
| `aptos_framework::resource_account` | `0x1` | Resource account creation and capability |
| `aptos_framework::fungible_asset` | `0x1` | Fungible Asset standard (FA) |
| `aptos_framework::primary_fungible_store` | `0x1` | Primary store for fungible assets |
| `aptos_framework::multisig_account` | `0x1` | On-chain multisig accounts |
| `aptos_framework::governance` | `0x1` | On-chain governance |
| `aptos_framework::transaction_fee` | `0x1` | Gas fee collection |
| `aptos_framework::code` | `0x1` | Module publishing and upgrade policies |

## Standard Library (0x1)

| Module | Description |
|--------|-------------|
| `std::signer` | Extract address from signer |
| `std::string` | UTF-8 string type |
| `std::vector` | Dynamic arrays |
| `std::option` | Optional values |
| `std::error` | Error code helpers |
| `std::bcs` | Binary Canonical Serialization |
| `std::hash` | SHA2/SHA3 hashing |
| `std::debug` | Print for debugging (test only) |

## Extended Standard Library (0x1)

| Module | Description |
|--------|-------------|
| `aptos_std::table` | Hash map (key-value store, O(1) lookup) |
| `aptos_std::simple_map` | Sorted map (small collections, O(n) operations) |
| `aptos_std::smart_table` | Scalable hash map for large datasets |
| `aptos_std::smart_vector` | Scalable vector with bucket storage |
| `aptos_std::type_info` | Runtime type introspection |
| `aptos_std::math64` | Math utilities for u64 |
| `aptos_std::math128` | Math utilities for u128 |
| `aptos_std::comparator` | Value comparison |
| `aptos_std::ed25519` | Ed25519 signature verification |
| `aptos_std::multi_ed25519` | Multi-Ed25519 verification |
| `aptos_std::from_bcs` | Deserialize from BCS bytes |

## Token Modules

| Module | Address | Description |
|--------|---------|-------------|
| `aptos_token_objects::collection` | `0x4` | Token V2 collection creation |
| `aptos_token_objects::token` | `0x4` | Token V2 token creation and management |
| `aptos_token_objects::royalty` | `0x4` | Token V2 royalty configuration |
| `aptos_token_objects::property_map` | `0x4` | Token V2 on-chain properties |
| `aptos_token::token` | `0x3` | Token V1 (DEPRECATED) |
| `aptos_token::token_transfers` | `0x3` | Token V1 transfers (DEPRECATED) |

## DeFi Protocol Addresses (Mainnet)

These are well-known protocol addresses on Aptos mainnet. Verify on-chain before use.

| Protocol | Module Address | Description |
|----------|---------------|-------------|
| PancakeSwap | `0xc7efb4076dbe143f6575505e635a0dee70fe51ba165eb1291ea9a8d2b17de24e` | AMM DEX |
| Liquidswap (Pontem) | `0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12` | AMM DEX |
| Thala | `0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01` | Stablecoin + DEX |
| Aries Markets | `0x9770fa9c725cbd97eb50b2be5f7416efdfd1f1554beb0750d4dae4c64e860da3` | Lending |
| Echelon | `0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba` | Lending |

Last verified: 2025-12-01

## Named Addresses in Move.toml

```toml
[addresses]
# Framework addresses (always available)
std = "0x1"
aptos_framework = "0x1"
aptos_std = "0x1"
aptos_token_objects = "0x4"
aptos_token = "0x3"

# Your module address
my_addr = "_"  # replaced at compile time via --named-addresses
```

## Address Format

- Aptos addresses are 32 bytes (64 hex chars), prefixed with `0x`
- Short addresses like `0x1` are zero-padded: `0x0000000000000000000000000000000000000000000000000000000000000001`
- The SDK accepts both short and full forms
- Resource accounts have deterministic addresses derived from `sha3_256(creator_address | seed | 0xFF)`
