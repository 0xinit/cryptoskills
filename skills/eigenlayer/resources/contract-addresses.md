# EigenLayer Contract Addresses

> **Last verified:** February 2026

All addresses are checksummed proxy contract addresses on Ethereum mainnet. EigenLayer uses the transparent proxy pattern -- always interact with proxy addresses, never implementation addresses. Implementations can be upgraded by the EigenLayer governance multisig.

## Core Protocol Contracts

| Contract | Proxy Address |
|----------|--------------|
| StrategyManager | `0x858646372CC42E1A627fcE94aa7A7033e7CF075A` |
| DelegationManager | `0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A` |
| EigenPodManager | `0x91E677b07F7AF907ec9a428aafA9fc14a0d3A338` |
| AVSDirectory | `0x135DDa560e946695d6f155dACaFC6f1F25C1F5AF` |
| RewardsCoordinator | `0x7750d328b314EfFa365A0402CcfD489B80B0adda` |
| AllocationManager | `0xAbC000003ca6769b5bc218E94e0296b39a19A8c3` |
| Slasher (legacy) | `0xD92145c07f8Ed1D392c1B88017934E301CC1c3Cd` |

## Token Contracts

| Token | Address | Notes |
|-------|---------|-------|
| EIGEN | `0xec53bF9167f50cDEB3Ae105f56099aaaB9061F83` | Governance/utility token |
| bEIGEN | `0x83E9115d334D248Ce39a6f36144aEaB5b3456e75` | Backing EIGEN token |

## LST Strategy Contracts

Each supported LST has a dedicated strategy contract that holds the deposited tokens and tracks shares.

| LST | Strategy Proxy | Token Address | Token Decimals |
|-----|---------------|---------------|----------------|
| stETH | `0x93c4b944D05dfe6df7645A86cd2206016c51564D` | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` | 18 |
| rETH | `0x1BeE69b7dFFfA4E2d53C2a2Df135C388AD25dCD2` | `0xae78736Cd615f374D3085123A210448E74Fc6393` | 18 |
| cbETH | `0x54945180dB7943c0ed0FEE7EdaB2Bd24620256bc` | `0xBe9895146f7AF43049ca1c1AE358B0541Ea49BBa` | 18 |
| wBETH | `0x7CA911E83dabf90C90dD3De5411a10F1A6112184` | `0xa2E3356610840701BDf5611a53974510Ae27E2e1` | 18 |
| sfrxETH | `0x8CA7A5d6f3acd3A7A8bC468a8CD0FB14B6BD28b6` | `0xac3E018457B222d93114458476f3E3416Abbe38F` | 18 |
| ETHx | `0x9d7eD45EE2E8FC5482fa2428f15C971e6369011d` | `0xA35b1B31Ce002FBF2058D22F30f95D405200A15b` | 18 |
| osETH | `0x57ba429517c3473B6d34CA9aCd56c0e735b94c02` | `0xf1C9acDc66974dFB6dEcB12aA385b9cD01190E38` | 18 |
| swETH | `0x0Fe4F44beE93503346A3Ac9EE5A26b130a5796d6` | `0xf951E335afb289353dc249e82926178EaC7DEd78` | 18 |
| OETH | `0xa4C637e0F704745D182e4D38cAb7E7485321d059` | `0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3` | 18 |
| ankrETH | `0x13760F50a9d7377e4F20CB8CF9e4c26586c658ff` | `0xE95A203B1a91a908F9B9CE46459d101078c2c3cb` | 18 |

## Holesky Testnet

| Contract | Proxy Address |
|----------|--------------|
| StrategyManager | `0xdfB5f6CE42aAA7830E94ECFCcAd411beF4d4D5b6` |
| DelegationManager | `0xA44151489861Fe9e3055d95adC98FbD462B948e7` |
| EigenPodManager | `0x30770d7E3e71112d7A6b7259542D1f680a70e315` |
| AVSDirectory | `0x055733000064333CaDDbC92763c58BF0192fFeBf` |
| RewardsCoordinator | `0xAcc1fb458a1317E886dB376Fc8141540537E68fE` |

## Verification

Verify any address on-chain before use:

```bash
# Check contract has code deployed
cast code 0x858646372CC42E1A627fcE94aa7A7033e7CF075A --rpc-url $RPC_URL

# Read proxy implementation address (EIP-1967 storage slot)
cast storage 0x858646372CC42E1A627fcE94aa7A7033e7CF075A 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url $RPC_URL

# Verify contract on Etherscan
# https://etherscan.io/address/0x858646372CC42E1A627fcE94aa7A7033e7CF075A#readProxyContract
```

## Reference

- [EigenLayer Deployed Contracts (official docs)](https://docs.eigenlayer.xyz/eigenlayer/deployed-contracts)
- [eigenlayer-contracts GitHub](https://github.com/Layr-Labs/eigenlayer-contracts)
- [EigenLayer Mainnet Deployment Script](https://github.com/Layr-Labs/eigenlayer-contracts/tree/dev/script/configs/mainnet)
