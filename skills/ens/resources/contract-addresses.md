# ENS Contract Addresses

## Ethereum Mainnet

Last verified: 2025-03-01

| Contract | Address | Purpose |
|----------|---------|---------|
| ENS Registry | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` | Core registry -- maps names to owners and resolvers |
| Public Resolver | `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63` | Default resolver for address, text, contenthash, and ABI records |
| ETH Registrar Controller | `0x253553366Da8546fC250F225fe3d25d0C782303b` | Handles .eth name registration and renewal (commit-reveal) |
| Name Wrapper | `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401` | Wraps names as ERC-1155 tokens with permission fuses |
| Reverse Registrar | `0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb` | Manages reverse records (address-to-name mapping) |
| Base Registrar (NFT) | `0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85` | ERC-721 NFT for .eth second-level names |
| Universal Resolver | `0xce01f8eee7E30F8E3BfC1C22bCBc01faBc8680E4` | Batch resolution with CCIP-Read support |

### TypeScript Constants

```typescript
const ENS_ADDRESSES = {
  registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  publicResolver: "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63",
  ethRegistrarController: "0x253553366Da8546fC250F225fe3d25d0C782303b",
  nameWrapper: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
  reverseRegistrar: "0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb",
  baseRegistrar: "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
  universalResolver: "0xce01f8eee7E30F8E3BfC1C22bCBc01faBc8680E4",
} as const satisfies Record<string, `0x${string}`>;
```

## Sepolia Testnet

Last verified: 2025-03-01

| Contract | Address |
|----------|---------|
| ENS Registry | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` |
| Public Resolver | `0x8FADE66B79cC9f707aB26799354482EB93a5B7dD` |
| ETH Registrar Controller | `0xFED6a969AaA60E4961FCD3EBF1A2e8913DeBe6c7` |
| Name Wrapper | `0x0635513f179D50A207757E05759CbD106d7dFcE8` |
| Reverse Registrar | `0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6` |

### Sepolia TypeScript Constants

```typescript
const ENS_SEPOLIA_ADDRESSES = {
  registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  publicResolver: "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD",
  ethRegistrarController: "0xFED6a969AaA60E4961FCD3EBF1A2e8913DeBe6c7",
  nameWrapper: "0x0635513f179D50A207757E05759CbD106d7dFcE8",
  reverseRegistrar: "0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6",
} as const satisfies Record<string, `0x${string}`>;
```

## Notes

- The ENS Registry address is the same on mainnet and all testnets (deployed via CREATE2).
- The Universal Resolver is the recommended entry point for client-side resolution -- it handles CCIP-Read, wildcard resolution, and batch queries.
- The Base Registrar is the ERC-721 contract that holds .eth name NFTs. Ownership of the NFT = ownership of the name (for unwrapped names).
- Always verify addresses against the official deployment list: https://docs.ens.domains/learn/deployments
