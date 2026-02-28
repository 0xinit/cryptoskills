# Sui System Object IDs and Package Addresses

## System Packages

| Package | Address | Description |
|---------|---------|-------------|
| Move Standard Library | `0x1` | Core Move types: `vector`, `option`, `string`, `ascii`, `fixed_point32` |
| Sui Framework | `0x2` | Sui-specific modules: `object`, `transfer`, `coin`, `tx_context`, `clock`, `table`, `bag`, `dynamic_field`, `event`, `package`, `display`, `kiosk` |
| Sui System | `0x3` | System operations: `sui_system`, `staking_pool`, `validator`, `validator_set`, `voting_power` |

## Singleton Objects

These objects exist at fixed addresses and are available on all networks:

| Object | ID | Type | Usage |
|--------|----|------|-------|
| System State | `0x5` | `sui::sui_system::SuiSystemState` | Validator set, epoch info, total stake |
| Clock | `0x6` | `sui::clock::Clock` | On-chain timestamp (milliseconds). Shared object. |
| Authenticator State | `0x7` | `sui::authenticator_state::AuthenticatorState` | JWK keys for zkLogin |
| Random | `0x8` | `sui::random::Random` | On-chain verifiable randomness |
| Deny List | `0x403` | `sui::deny_list::DenyList` | Regulated coin deny list |

## RPC Endpoints

### Mainnet

| Provider | URL |
|----------|-----|
| Mysten Labs | `https://fullnode.mainnet.sui.io:443` |
| GraphQL | `https://sui-mainnet.mystenlabs.com/graphql` |

### Testnet

| Provider | URL |
|----------|-----|
| Mysten Labs | `https://fullnode.testnet.sui.io:443` |
| GraphQL | `https://sui-testnet.mystenlabs.com/graphql` |
| Faucet | `https://faucet.testnet.sui.io` |

### Devnet

| Provider | URL |
|----------|-----|
| Mysten Labs | `https://fullnode.devnet.sui.io:443` |
| Faucet | `https://faucet.devnet.sui.io` |

## Common Coin Types

| Coin | Type | Decimals |
|------|------|----------|
| SUI | `0x2::sui::SUI` | 9 |
| USDC (Mainnet) | `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC` | 6 |
| USDT (Mainnet) | `0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN` | 6 |
| WETH (Mainnet) | `0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN` | 8 |

Note: Coin type addresses on Sui represent the package that published the coin, not a contract holding balances. Verify these on-chain before production use.

## DeFi Protocol Packages (Mainnet)

| Protocol | Package ID | Description |
|----------|-----------|-------------|
| DeepBook v3 | `0xdee9bc4f08a19cfdc47e8c3c53da4753a13153e2c62e7df06bb1a0b10c070e53` | Central limit order book |

Note: DeFi package IDs change with upgrades. The package address is updated each time a protocol publishes an upgrade. Always verify the latest package ID on the protocol's documentation or SuiScan before integrating.

## Block Explorers

| Explorer | Mainnet URL | Testnet URL |
|----------|-------------|-------------|
| SuiScan | `https://suiscan.xyz/mainnet` | `https://suiscan.xyz/testnet` |
| SuiVision | `https://suivision.xyz` | `https://testnet.suivision.xyz` |
| Sui Explorer | `https://suiexplorer.com` | `https://suiexplorer.com/?network=testnet` |

## SDK Package

| Package | npm |
|---------|-----|
| Sui TypeScript SDK | `@mysten/sui` |
| zkLogin | `@mysten/zklogin` |
| Kiosk SDK | `@mysten/kiosk` |
| SuiNS SDK | `@mysten/suins` |
| BCS (serialization) | `@mysten/bcs` |
| GraphQL Transport | `@mysten/sui/graphql` |

## SUI Denomination

| Unit | Value |
|------|-------|
| 1 MIST | Smallest unit (like wei/lamport) |
| 1 SUI | 1,000,000,000 MIST (10^9) |

Always use MIST in code. SUI has 9 decimal places.

Last verified: 2026-02-26
