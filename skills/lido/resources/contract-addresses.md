# Lido Contract Addresses

> **Last verified:** 2025-05-01

## Ethereum Mainnet

| Contract | Address |
|----------|---------|
| Lido (stETH proxy) | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` |
| wstETH | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` |
| WithdrawalQueueERC721 | `0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1` |
| Accounting Oracle | `0x852deD011285fe67063a08005c71a85690503Cee` |
| Execution Layer Rewards Vault | `0x388C818CA8B9251b393131C08a736A67ccB19297` |
| Staking Router | `0xFdDf38947aFB03C621C71b06C9C70bce73f12999` |
| Deposit Security Module | `0xC77F8768774E1c9244BEed705C4354f2113CFc09` |
| Lido DAO (Aragon) | `0xb8FFC3Cd6e7Cf5a098A1c92F48009765B24088Dc` |

## Holesky Testnet

| Contract | Address |
|----------|---------|
| Lido (stETH proxy) | `0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034` |
| wstETH | `0x8d09a4502Cc8Cf1547aD300E066060D043f6982D` |
| WithdrawalQueueERC721 | `0xc7cc160b58F8Bb0baC94b80847E2CF2800565C50` |

## wstETH on L2s

| Chain | wstETH Address |
|-------|----------------|
| Arbitrum | `0x5979D7b546E38E9Ab8F24815DCa0E57E830D4df6` |
| Optimism | `0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb` |
| Base | `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452` |
| Polygon | `0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD` |
| Scroll | `0xf610A9dfB7C89644979b4A0f27063E9e7d7Cda32` |
| zkSync Era | `0x703b52F2b28fEbcB60E1372858AF5b18849FE867` |
| Mantle | `0x458ed78EB972a369799fb278c0243b25e5242A83` |

## Chainlink Price Feeds (Mainnet)

| Pair | Address | Heartbeat |
|------|---------|-----------|
| wstETH/ETH | `0x536218f9E9Eb48863970252233c8F271f554C2d0` | 86400s |
| stETH/ETH | `0x86392dC19c0b719886221c78AB11eb8Cf5c52812` | 86400s |
| stETH/USD | `0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8` | 3600s |

## Verification

Verify any address on-chain before use:

```bash
# Check contract has code deployed
cast code 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84 --rpc-url $RPC_URL

# Check stETH proxy implementation
cast storage 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url $RPC_URL
```

## References

- [Lido Deployed Contracts](https://docs.lido.fi/deployed-contracts/)
- [wstETH Bridging Guide](https://docs.lido.fi/token-guides/wsteth-bridging-guide)
