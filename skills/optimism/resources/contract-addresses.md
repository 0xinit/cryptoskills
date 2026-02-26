# Optimism Contract Addresses

> Last verified: 2025-05-01

## OP Mainnet Predeploys (L2)

These contracts exist at genesis on every OP Stack chain at fixed addresses.

| Contract | Address |
|----------|---------|
| L2ToL1MessagePasser | `0x4200000000000000000000000000000000000016` |
| L2CrossDomainMessenger | `0x4200000000000000000000000000000000000007` |
| L2StandardBridge | `0x4200000000000000000000000000000000000010` |
| L2ERC721Bridge | `0x4200000000000000000000000000000000000014` |
| GasPriceOracle | `0x420000000000000000000000000000000000000F` |
| L1Block | `0x4200000000000000000000000000000000000015` |
| L1BlockNumber (deprecated) | `0x4200000000000000000000000000000000000013` |
| WETH9 | `0x4200000000000000000000000000000000000006` |
| SequencerFeeVault | `0x4200000000000000000000000000000000000011` |
| BaseFeeVault | `0x4200000000000000000000000000000000000019` |
| L1FeeVault | `0x420000000000000000000000000000000000001A` |
| GovernanceToken (OP) | `0x4200000000000000000000000000000000000042` |
| SuperchainTokenBridge | `0x4200000000000000000000000000000000000028` |
| SchemaRegistry | `0x4200000000000000000000000000000000000020` |
| EAS (Attestation Service) | `0x4200000000000000000000000000000000000021` |

## Ethereum L1 Contracts (OP Mainnet)

These are deployed on Ethereum mainnet and manage the L1 side of the rollup.

| Contract | Address |
|----------|---------|
| OptimismPortal | `0xbEb5Fc579115071764c7423A4f12eDde41f106Ed` |
| L1CrossDomainMessenger | `0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1` |
| L1StandardBridge | `0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1` |
| L1ERC721Bridge | `0x5a7749f83b81B301cAb5f48EB8516B986DAef23D` |
| SystemConfig | `0x229047fed2591dbec1eF1118d64F7aF3dB9EB290` |
| L2OutputOracle (legacy) | `0xdfe97868233d1aa22e815a266982f2cf17685a27` |
| DisputeGameFactory | `0xe5965Ab5962eDc7477C8520243A95517CD252fA9` |
| AddressManager | `0xdE1FCfB0851916CA5101820A69b13a4E276bd81F` |
| ProxyAdmin | `0x543bA4AADBAb8f9025686Bd03993043599c6fB04` |
| BatchInbox | `0xFF00000000000000000000000000000000000010` |
| Batcher (sender) | `0x6887246668a3b87F54DeB3b94Ba47a6f63F32985` |

## OP Sepolia Testnet Predeploys (L2)

Predeploy addresses are identical to mainnet — they are the same on every OP Stack chain.

| Contract | Address |
|----------|---------|
| L2CrossDomainMessenger | `0x4200000000000000000000000000000000000007` |
| L2StandardBridge | `0x4200000000000000000000000000000000000010` |
| GasPriceOracle | `0x420000000000000000000000000000000000000F` |
| L1Block | `0x4200000000000000000000000000000000000015` |

## OP Sepolia L1 Contracts (on Ethereum Sepolia)

| Contract | Address |
|----------|---------|
| OptimismPortal | `0x16Fc5058F25648194471939df75CF27A2fdC48BC` |
| L1CrossDomainMessenger | `0x58Cc85b8D04EA49cC6DBd3CbFFd00B4B8D6cb3ef` |
| L1StandardBridge | `0xFBb0621E0B23b5A62ADE4C7aF712bcbA1882dBB4` |
| SystemConfig | `0x034edD2A225f7f429A63E0f1D2084B9E0A93b538` |

## OP Token

| Network | Address |
|---------|---------|
| OP Mainnet (L2) | `0x4200000000000000000000000000000000000042` |
| Ethereum (L1) | `0x4200000000000000000000000000000000000042` (bridged from L2) |

## Common Tokens on OP Mainnet

| Token | Address |
|-------|---------|
| WETH | `0x4200000000000000000000000000000000000006` |
| USDC (native) | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |
| USDC.e (bridged) | `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` |
| USDT | `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58` |
| DAI | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` |
| WBTC | `0x68f180fcCe6836688e9084f035309E29Bf0A2095` |
| wstETH | `0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb` |
| rETH | `0x9Bcef72be871e61ED4fBbc7630889beE758eb81D` |

## Verification

Verify any contract address on-chain before using in production:

```bash
# Verify contract has code
cast code 0x4200000000000000000000000000000000000007 --rpc-url https://mainnet.optimism.io

# Verify L1 contract
cast code 0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1 --rpc-url https://eth.llamarpc.com
```
