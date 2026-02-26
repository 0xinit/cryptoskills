# OpenZeppelin Contract Addresses & Infrastructure

Reference addresses for OpenZeppelin-related infrastructure.

## ERC1967 Implementation Slot

All ERC1967-compatible proxies (UUPS, Transparent) store the implementation address at this slot:

```
// EIP-1967 implementation slot
// bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
```

Admin slot (TransparentProxy):

```
// bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1)
0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103
```

Beacon slot:

```
// bytes32(uint256(keccak256("eip1967.proxy.beacon")) - 1)
0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50
```

## Create2 Factory (Deterministic Deployment)

The canonical Create2 deployer used across chains:

| Resource | Address |
|----------|---------|
| Nick's Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |

Available on Ethereum, Arbitrum, Optimism, Base, Polygon, and most EVM chains. Used by `forge create2` and deterministic deployment scripts.

## Common Proxy Patterns

### Reading Implementation Address

```bash
# Get the implementation behind a UUPS or Transparent proxy
cast storage <PROXY_ADDRESS> 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url $RPC_URL
```

```typescript
import { getAddress, hexToString } from "viem";

const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const raw = await publicClient.getStorageAt({ address: proxyAddress, slot: implSlot });
const implementation = getAddress(`0x${raw.slice(26)}`);
```

### Verifying a Proxy on Etherscan

```bash
# Verify the implementation contract (not the proxy)
forge verify-contract <IMPL_ADDRESS> ContractName \
  --chain-id 1 \
  --etherscan-api-key $ETHERSCAN_KEY

# Then link the proxy to the implementation on Etherscan UI:
# "Is this a proxy?" -> "Verify" -> auto-detects implementation
```

## OpenZeppelin Defender

Defender relayer infrastructure addresses are per-deployment (generated when you create a relayer in the Defender dashboard). There are no fixed global addresses.

Key endpoints:

| Service | URL |
|---------|-----|
| Defender Dashboard | `https://defender.openzeppelin.com` |
| Defender API | `https://api.defender.openzeppelin.com` |

## ERC-7201 Namespace Formula

V5 uses ERC-7201 for storage namespaces in upgradeable contracts. The storage location is computed as:

```
keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ERC20")) - 1)) & ~bytes32(uint256(0xff))
```

This places each extension's storage in a predictable, collision-free slot.

## References

- [EIP-1967: Proxy Storage Slots](https://eips.ethereum.org/EIPS/eip-1967)
- [EIP-7201: Namespaced Storage Layout](https://eips.ethereum.org/EIPS/eip-7201)
- [Nick's Create2 Factory](https://github.com/Arachnid/deterministic-deployment-proxy)
