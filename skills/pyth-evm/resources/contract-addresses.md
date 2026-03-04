# Pyth EVM Contract Addresses

> **Last verified:** March 2026

Pyth contract addresses are NOT the same across all chains. Always verify the address for your target chain before deployment.

## Mainnet Addresses

| Chain | Pyth Contract | Chain ID |
|-------|---------------|----------|
| Ethereum | `0x4305FB66699C3B2702D4d05CF36551390A4c69C6` | 1 |
| Arbitrum One | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` | 42161 |
| Optimism | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` | 10 |
| Base | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` | 8453 |
| Polygon | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` | 137 |
| Avalanche C-Chain | `0x4305FB66699C3B2702D4d05CF36551390A4c69C6` | 43114 |
| BNB Chain | `0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594` | 56 |
| Gnosis | `0x2880aB155794e7179c9eE2e38200202908C17B43` | 100 |
| Fantom | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` | 250 |
| Celo | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` | 42220 |
| Mantle | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` | 5000 |
| Blast | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` | 81457 |
| Sei | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` | 1329 |

## Testnet Addresses

| Chain | Pyth Contract | Chain ID |
|-------|---------------|----------|
| Sepolia | `0xDd24F84d36BF92C65F92307595335bdFab5Bbd21` | 11155111 |
| Arbitrum Sepolia | `0x4374e5a8b9C22271E9EB878A2AA31DE97aBE67b7` | 421614 |
| Base Sepolia | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` | 84532 |
| Optimism Sepolia | `0x0708325268dF9F66270F1401206434524814508b` | 11155420 |

## Address Groups

Common pattern -- chains sharing the same contract address use the same deployment bytecode and CREATE2 salt:

| Address | Chains |
|---------|--------|
| `0x4305FB66...` | Ethereum, Avalanche |
| `0xff1a0f47...` | Arbitrum, Optimism, Base, Polygon, Fantom, Celo, Sei |
| `0x4D7E825f...` | BNB Chain |
| `0xA2aa501b...` | Mantle, Blast |
| `0x2880aB15...` | Gnosis |

## Verification

```bash
# Verify Pyth contract deployment
cast code 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C --rpc-url $ARBITRUM_RPC

# Read Pyth contract version
cast call 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C "version()(string)" --rpc-url $ARBITRUM_RPC

# Get update fee for empty update (should revert or return minimal fee)
cast call 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C "getUpdateFee(bytes[])(uint256)" "[]" --rpc-url $ARBITRUM_RPC
```

## Reference

- [Pyth Contract Addresses (official)](https://docs.pyth.network/price-feeds/contract-addresses/evm)
- [Pyth Crosschain Deployments (GitHub)](https://github.com/pyth-network/pyth-crosschain/tree/main/target_chains/ethereum)
