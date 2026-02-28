# Sei Contract Addresses

> **Last verified:** February 2026. Verify onchain with `cast code <address> --rpc-url https://evm-rpc.sei-apis.com` before production use.

## Precompile Contracts

These are built into the Sei node at fixed addresses. They exist on all Sei networks (mainnet, testnet, devnet).

| Precompile | Address | Purpose |
|------------|---------|---------|
| Bank | `0x0000000000000000000000000000000000001001` | Query/send native Cosmos tokens |
| Wasm | `0x0000000000000000000000000000000000001002` | Instantiate/execute/query CosmWasm contracts |
| JSON | `0x0000000000000000000000000000000000001003` | Parse JSON on-chain |
| Address | `0x0000000000000000000000000000000000001004` | Convert EVM (0x) <> Cosmos (sei1) addresses |
| Staking | `0x0000000000000000000000000000000000001005` | Delegate/undelegate/redelegate |
| Governance | `0x0000000000000000000000000000000000001006` | Vote on governance proposals |
| Distribution | `0x0000000000000000000000000000000000001007` | Claim staking rewards |
| IBC | `0x0000000000000000000000000000000000001009` | Cross-chain IBC transfers |
| Pointer | `0x000000000000000000000000000000000000100b` | Query/register pointer contracts |

## Precompile Call Restrictions

| Precompile | CALL | STATICCALL | DELEGATECALL |
|------------|------|------------|--------------|
| Bank (read) | Yes | Yes | No |
| Bank (write) | Yes | No | No |
| Wasm (query) | Yes | Yes | No |
| Wasm (execute) | Yes | No | No |
| Address | Yes | Yes | No |
| Staking | Yes | No | No |
| Governance | Yes | No | No |
| Distribution | Yes | No | No |
| IBC | Yes | No | No |
| JSON | Yes | Yes | No |
| Pointer | Yes | Yes | No |

## Infrastructure Contracts (Mainnet, pacific-1)

| Contract | Address | Notes |
|----------|---------|-------|
| WSEI (Wrapped SEI) | `0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7` | ERC20-wrapped native SEI |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | Standard CREATE2 address |

## DEX Contracts (Mainnet)

| Protocol | Contract | Address |
|----------|----------|---------|
| DragonSwap | Router | Verify on Seitrace |
| DragonSwap | Factory | Verify on Seitrace |
| Yaka Finance | Router | Verify on Seitrace |

> DEX addresses should be verified on Seitrace (https://seitrace.com) or the protocol's official documentation before use. DEX contracts may be upgraded or redeployed.

## Common IBC Denoms

| Token | Denom | Source Chain |
|-------|-------|-------------|
| SEI (native) | `usei` | Sei |
| ATOM | `ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2` | Cosmos Hub |
| OSMO | `ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE12566649D0C2F97716B8518` | Osmosis |

> IBC denoms are derived from the transfer path (port/channel/denom). The hash is deterministic per path but varies if the channel changes. Always verify the active IBC channel and denom hash.

## RPC Endpoints

### Mainnet (pacific-1)

| Type | URL |
|------|-----|
| EVM JSON-RPC | `https://evm-rpc.sei-apis.com` |
| EVM WebSocket | `wss://evm-ws.sei-apis.com` |
| Cosmos REST | `https://rest.sei-apis.com` |
| Cosmos RPC | `https://rpc.sei-apis.com` |
| Cosmos gRPC | `https://grpc.sei-apis.com` |

### Testnet (atlantic-2)

| Type | URL |
|------|-----|
| EVM JSON-RPC | `https://evm-rpc-testnet.sei-apis.com` |
| EVM WebSocket | `wss://evm-ws-testnet.sei-apis.com` |
| Cosmos REST | `https://rest-testnet.sei-apis.com` |
| Cosmos RPC | `https://rpc-testnet.sei-apis.com` |

### Devnet (arctic-1)

| Type | URL |
|------|-----|
| EVM JSON-RPC | `https://evm-rpc-arctic-1.sei-apis.com` |

## Block Explorers

| Network | Explorer | URL |
|---------|----------|-----|
| Mainnet | Seitrace | https://seitrace.com |
| Mainnet | Seistream | https://seistream.app |
| Mainnet | Seiscan (Cosmos) | https://seiscan.app |
| Testnet | Seitrace | https://seitrace.com/?chain=atlantic-2 |
| Devnet | Seitrace | https://seitrace.com/?chain=arctic-1 |
