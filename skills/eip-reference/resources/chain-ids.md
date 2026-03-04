# EIP-155 Chain IDs Reference

Common chain IDs per EIP-155 for transaction replay protection and multi-chain development.

Last verified: March 2026

## Mainnet Chains

| Chain | Chain ID | Currency | Type |
|-------|----------|----------|------|
| Ethereum Mainnet | 1 | ETH | L1 |
| Polygon PoS | 137 | POL | L1 |
| BNB Smart Chain | 56 | BNB | L1 |
| Avalanche C-Chain | 43114 | AVAX | L1 |
| Fantom Opera | 250 | FTM | L1 |
| Gnosis Chain | 100 | xDAI | L1 |
| Monad | 143 | MON | L1 |

## L2 / Rollup Chains

| Chain | Chain ID | Currency | Type |
|-------|----------|----------|------|
| Arbitrum One | 42161 | ETH | L2 (Optimistic) |
| Arbitrum Nova | 42170 | ETH | L2 (AnyTrust) |
| Optimism | 10 | ETH | L2 (Optimistic) |
| Base | 8453 | ETH | L2 (Optimistic) |
| Scroll | 534352 | ETH | L2 (zkRollup) |
| zkSync Era | 324 | ETH | L2 (zkRollup) |
| Polygon zkEVM | 1101 | ETH | L2 (zkRollup) |
| Linea | 59144 | ETH | L2 (zkRollup) |
| Blast | 81457 | ETH | L2 (Optimistic) |
| MegaETH | 6342 | ETH | L2 |

## Testnets

| Chain | Chain ID | Currency | Mainnet |
|-------|----------|----------|---------|
| Sepolia | 11155111 | ETH | Ethereum |
| Holesky | 17000 | ETH | Ethereum |
| Arbitrum Sepolia | 421614 | ETH | Arbitrum |
| Optimism Sepolia | 11155420 | ETH | Optimism |
| Base Sepolia | 84532 | ETH | Base |
| Polygon Amoy | 80002 | POL | Polygon |

## Usage in viem

```typescript
import { mainnet, arbitrum, optimism, base, sepolia } from 'viem/chains';

// Chain IDs are available as properties
console.log(mainnet.id);  // 1
console.log(arbitrum.id); // 42161
console.log(base.id);     // 8453
console.log(sepolia.id);  // 11155111
```

## Usage in EIP-712 Domain

```solidity
// Always use block.chainid for dynamic fork protection
bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(bytes("MyProtocol")),
    keccak256(bytes("1")),
    block.chainid,    // Dynamic — correct on any chain/fork
    address(this)
));
```

## How to Add a Custom Chain in viem

```typescript
import { defineChain } from 'viem';

const myChain = defineChain({
  id: 99999,
  name: 'My Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mychain.io'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.mychain.io' },
  },
});
```

## References

- [EIP-155](https://eips.ethereum.org/EIPS/eip-155) — Simple Replay Attack Protection
- [chainlist.org](https://chainlist.org) — Community-maintained chain registry
- [Viem Chains](https://viem.sh/docs/chains/introduction) — Built-in chain definitions
