# Base Contract Addresses

## OP Stack Predeploys (Base L2)

These are deployed at the same addresses on all OP Stack chains.

| Contract | Address |
|----------|---------|
| L2CrossDomainMessenger | `0x4200000000000000000000000000000000000007` |
| L2StandardBridge | `0x4200000000000000000000000000000000000010` |
| L2ToL1MessagePasser | `0x4200000000000000000000000000000000000016` |
| GasPriceOracle | `0x420000000000000000000000000000000000000F` |
| L1Block | `0x4200000000000000000000000000000000000015` |
| L2ERC721Bridge | `0x4200000000000000000000000000000000000014` |
| SequencerFeeVault | `0x4200000000000000000000000000000000000011` |
| BaseFeeVault | `0x4200000000000000000000000000000000000019` |
| L1FeeVault | `0x420000000000000000000000000000000000001A` |
| WETH (predeploy) | `0x4200000000000000000000000000000000000006` |

## L1 Contracts (Ethereum Mainnet)

Base contracts deployed on Ethereum L1.

| Contract | Address |
|----------|---------|
| OptimismPortal | `0x49048044D57e1C92A77f79988d21Fa8fAF36f97B` |
| L1CrossDomainMessenger | `0x866E82a600A1414e583f7F13623F1aC5d58b0Afa` |
| L1StandardBridge | `0x3154Cf16ccdb4C6d922629664174b904d80F2C35` |
| L2OutputOracle | `0x56315b90c40730925ec5485cf004d835058518A0` |
| SystemConfig | `0x73a79Fab69143498Ed3712e519A88a918e1f4072` |
| AddressManager | `0x8EfB6B5c4767B09Dc9AA6Af4eAA89F749522BaE2` |
| ProxyAdmin | `0x0475cBCAebd9CE8AfA5025828d5b98DFb67E059E` |
| BatchInbox | `0xFf00000000000000000000000000000000008453` |
| BatchSender (sequencer) | `0x5050F69a10BB8d904dB63C838a62FfD6C1B1d864` |

## Base Sepolia (Testnet) L1 Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| OptimismPortal | `0x49f53e41452C74589E85cA1677426Ba426459e85` |
| L1CrossDomainMessenger | `0xC34855F4De64F1840e5686e64278da901e261f20` |
| L1StandardBridge | `0xfd0Bf71F60660E2f608ed56e1659C450eB113120` |
| L2OutputOracle | `0x84457ca9D0163FbC4bbfe4Dfbb20ba46e48DF254` |

## Token Addresses (Base Mainnet)

| Token | Symbol | Address | Decimals |
|-------|--------|---------|----------|
| Wrapped Ether | WETH | `0x4200000000000000000000000000000000000006` | 18 |
| USD Coin (native) | USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| USD Coin (bridged) | USDbC | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6D` | 6 |
| Coinbase Wrapped Staked ETH | cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | 18 |
| Dai | DAI | `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` | 18 |
| Aerodrome | AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | 18 |
| Wrapped BTC (cbBTC) | cbBTC | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | 8 |
| Tether USD | USDT | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | 6 |

## Protocol Addresses (Base Mainnet)

| Protocol | Contract | Address |
|----------|----------|---------|
| Uniswap V3 | SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| Uniswap V3 | NonfungiblePositionManager | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` |
| Uniswap V3 | Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| Aerodrome | Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome | Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Aave V3 | Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |
| Aave V3 | PoolAddressesProvider | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` |

## ERC-4337 (Account Abstraction)

| Contract | Address |
|----------|---------|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| Coinbase Smart Wallet Factory | `0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a` |

> Last verified: 2025-04. Always verify onchain before production use:
> ```bash
> cast code <address> --rpc-url https://mainnet.base.org
> ```
