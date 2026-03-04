# Farcaster Contract Addresses

> **Last verified:** March 2026

All Farcaster onchain registry contracts are deployed on OP Mainnet (Optimism, chain ID 10).

## Registry Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| IdRegistry | `0x00000000Fc6c5F01Fc30151999387Bb99A9f489b` | Maps FIDs to custody addresses |
| KeyRegistry | `0x00000000Fc1237824fb747aBDE0FF18990E59b7e` | Maps FIDs to Ed25519 app keys (signers) |
| StorageRegistry | `0x00000000FcCe7f938e7aE6D3c335bD6a1a7c593D` | Manages storage units per FID |

## Gateway Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| IdGateway | `0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69` | Permissioned FID registration entry point |
| KeyGateway | `0x00000000fC56947c7E7183f8Ca4B62398CaaDF0B` | Permissioned key addition entry point |

## Bundler

| Contract | Address | Purpose |
|----------|---------|---------|
| Bundler | `0x00000000FC04c910A0b5feA33b03E0447ad0B0aA` | Batches register + addKey + rent in one transaction |

## Verification

```bash
# Verify IdRegistry deployment
cast code 0x00000000Fc6c5F01Fc30151999387Bb99A9f489b --rpc-url https://mainnet.optimism.io

# Verify KeyRegistry deployment
cast code 0x00000000Fc1237824fb747aBDE0FF18990E59b7e --rpc-url https://mainnet.optimism.io

# Verify StorageRegistry deployment
cast code 0x00000000FcCe7f938e7aE6D3c335bD6a1a7c593D --rpc-url https://mainnet.optimism.io

# Lookup custody address for FID 3
cast call 0x00000000Fc6c5F01Fc30151999387Bb99A9f489b \
  "custodyOf(uint256)(address)" 3 \
  --rpc-url https://mainnet.optimism.io

# Check if a key is registered for an FID
cast call 0x00000000Fc1237824fb747aBDE0FF18990E59b7e \
  "keyDataOf(uint256,bytes)(uint8,uint32)" <fid> <pubkey_bytes> \
  --rpc-url https://mainnet.optimism.io
```

## Reference

- [Farcaster Contracts (GitHub)](https://github.com/farcasterxyz/contracts)
- [IdRegistry on Optimistic Etherscan](https://optimistic.etherscan.io/address/0x00000000Fc6c5F01Fc30151999387Bb99A9f489b)
- [Farcaster Protocol Spec -- Onchain](https://github.com/farcasterxyz/protocol/blob/main/docs/SPECIFICATION.md)
