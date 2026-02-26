# Contract Addresses and Chain Configuration

## Chain Configuration

| Network | Chain ID | RPC HTTP | RPC WebSocket | Explorer |
|---------|----------|----------|---------------|----------|
| Mainnet | 4326 | `https://mainnet.megaeth.com/rpc` | `wss://mainnet.megaeth.com/ws` | `https://mega.etherscan.io` |
| Testnet | 6343 | `https://carrot.megaeth.com/rpc` | `wss://carrot.megaeth.com/ws` | `https://megaeth-testnet-v2.blockscout.com` |

Uptime: https://uptime.megaeth.com

## Predeployed Contracts (MegaETH)

| Contract | Address |
|----------|---------|
| WETH9 | `0x4200000000000000000000000000000000000006` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| High-Precision Timestamp | `0x6342000000000000000000000000000000000002` |
| MEGA Token | `0x28B7E77f82B25B95953825F1E3eA0E36c1c29861` |
| L2CrossDomainMessenger | `0x4200000000000000000000000000000000000007` |

## Bridge Contracts (Ethereum Mainnet)

| Contract | Address |
|----------|---------|
| L1StandardBridgeProxy | `0x0CA3A2FBC3D770b578223FBB6b062fa875a2eE75` |
| OptimismPortalProxy | `0x7f82f57F0Dd546519324392e408b01fcC7D709e8` |

## MegaNames Contracts (Mainnet, Chain ID: 4326)

| Contract | Address |
|----------|---------|
| MegaNames | `0x5B424C6CCba77b32b9625a6fd5A30D409d20d997` |
| MegaNameRenderer | `0x8d206c277E709c8F4f8882fc0157bE76dA0C48C4` |
| SubdomainRouter | `0xdB5e5Ab907e62714D7d9Ffde209A4E770a0507Fe` |
| SubdomainLogic | `0xf09fB5cB77b570A30D68b1Aa1d944256171C5172` |
| USDM | `0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7` |
| Fee Recipient | `0x25925C0191E8195aFb9dFA35Cd04071FF11D2e38` |

## Delegation Framework (Deterministic Deploys)

| Contract | Address |
|----------|---------|
| DelegationManager | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |
| EntryPoint (v0.7) | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| SimpleFactory | `0x69Aa2f9fe1572F1B640E1bbc512f5c3a734fc77c` |
| HybridDeleGator (impl) | `0x48dBe696A4D990079e039489bA2053B36E8FFEC4` |
| MultiSigDeleGator (impl) | `0x56a9EdB16a0105eb5a4C54f4C062e2868844f3A7` |

## Caveat Enforcers (Deterministic Deploys)

| Enforcer | Address |
|----------|---------|
| AllowedCalldataEnforcer | `0xc2b0d624c1c4319760C96503BA27C347F3260f55` |
| AllowedMethodsEnforcer | `0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5` |
| AllowedTargetsEnforcer | `0x7F20f61b1f09b08D970938F6fa563634d65c4EeB` |
| TimestampEnforcer | `0x1046bb45C8d673d4ea75321280DB34899413c069` |
| ValueLteEnforcer | `0x92Bf12322527cAA612fd31a0e810472BBB106A8F` |
| LimitedCallsEnforcer | `0x04658B29F6b82ed55274221a06Fc97D318E25416` |
| NativeTokenPeriodTransferEnforcer | `0x9BC0FAf4Aca5AE429F4c06aEEaC517520CB16BD9` |
| ERC20PeriodTransferEnforcer | `0x474e3Ae7E169e940607cC624Da8A15Eb120139aB` |
| NativeTokenTransferAmountEnforcer | `0xF71af580b9c3078fbc2BBF16FbB8EEd82b330320` |
| ERC20TransferAmountEnforcer | `0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc` |
| RedeemerEnforcer | `0xE144b0b2618071B4E56f746313528a669c7E65c5` |
| NonceEnforcer | `0xDE4f2FAC4B3D87A1d9953Ca5FC09FCa7F366254f` |
| IdEnforcer | `0xC8B5D93463c893401094cc70e66A206fb5987997` |
| BlockNumberEnforcer | `0x5d9818dF0AE3f66e9c3D0c5029DAF99d1823ca6c` |
| ERC20StreamingEnforcer | `0x56c97aE02f233B29fa03502Ecc0457266d9be00e` |
| NativeTokenStreamingEnforcer | `0xD10b97905a320b13a0608f7E9cC506b56747df19` |
| NativeTokenPaymentEnforcer | `0x4803a326ddED6dDBc60e659e5ed12d85c7582811` |
| MultiTokenPeriodEnforcer | `0xFB2f1a9BD76d3701B730E5d69C3219D42D80eBb7` |

## Token Addresses (Mainnet)

| Token | Address |
|-------|---------|
| WETH | `0x4200000000000000000000000000000000000006` |
| MEGA | `0x28B7E77f82B25B95953825F1E3eA0E36c1c29861` |
| USDM | `0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7` |

Official token list: https://github.com/megaeth-labs/mega-tokenlist

## RPC Providers

| Provider | Type | Notes |
|----------|------|-------|
| MegaETH | Public | Rate limited |
| Alchemy | Managed | Geo-distributed |
| QuickNode | Managed | Geo-distributed |

## Block Explorers

| Network | Explorer |
|---------|----------|
| Mainnet | https://mega.etherscan.io |
| Testnet | https://megaeth-testnet-v2.blockscout.com |

## DEX Aggregator

Kyber Network: `https://aggregator-api.kyberswap.com/megaeth/api/v1`

## Official Resources

- MegaETH Docs: https://docs.megaeth.com
- Real-time API: https://docs.megaeth.com/realtime-api
- MegaEVM Spec: https://github.com/megaeth-labs/mega-evm
- Token List: https://github.com/megaeth-labs/mega-tokenlist
- MegaNames Frontend: https://meganame.market
