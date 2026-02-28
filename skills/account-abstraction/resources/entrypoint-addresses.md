# EntryPoint Contract Addresses

> **Last verified:** February 2026

EntryPoint contracts are deployed at deterministic addresses via CREATE2. The same address is valid on every EVM chain that supports the deployment.

## EntryPoint v0.7

| Chain | Address | Status |
|-------|---------|--------|
| Ethereum | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Active |
| Arbitrum | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Active |
| Base | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Active |
| Optimism | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Active |
| Polygon | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Active |
| Avalanche | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Active |
| BSC | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Active |
| Sepolia | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Active |

## EntryPoint v0.6 (Legacy)

| Chain | Address | Status |
|-------|---------|--------|
| Ethereum | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | Active (legacy) |
| Arbitrum | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | Active (legacy) |
| Base | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | Active (legacy) |
| Optimism | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | Active (legacy) |
| Polygon | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | Active (legacy) |

## SimpleAccountFactory

| Version | Address | Chains |
|---------|---------|--------|
| v0.7 | `0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985` | Ethereum, Arbitrum, Base, Optimism, Polygon |
| v0.6 | `0x9406Cc6185a346906296840746125a0E44976454` | Ethereum, Arbitrum, Base, Optimism, Polygon |

## Verification

```bash
# Check EntryPoint v0.7 has code deployed
cast code 0x0000000071727De22E5E9d8BAf0edAc6f37da032 --rpc-url $RPC_URL

# Check EntryPoint v0.6 has code deployed
cast code 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789 --rpc-url $RPC_URL

# Read EntryPoint version (v0.7 returns the SenderCreator address)
cast call 0x0000000071727De22E5E9d8BAf0edAc6f37da032 "senderCreator()(address)" --rpc-url $RPC_URL

# Check SimpleAccountFactory
cast code 0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985 --rpc-url $RPC_URL
```

## Reference

- [eth-infinitism/account-abstraction (official repo)](https://github.com/eth-infinitism/account-abstraction)
- [ERC-4337 EntryPoint deployments](https://github.com/eth-infinitism/account-abstraction/tree/develop/deployments)
- [ERC-4337 specification](https://eips.ethereum.org/EIPS/eip-4337)
