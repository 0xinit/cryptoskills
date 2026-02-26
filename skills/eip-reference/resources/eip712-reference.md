# EIP-712 Typed Structured Data Reference

Complete reference for EIP-712 typed data signing — domain separator construction, encoding rules, Solidity verification, and viem integration.

## Domain Separator

The domain separator binds a signature to a specific contract on a specific chain. Omitting fields enables cross-chain or cross-contract replay.

```solidity
bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(bytes("MyProtocol")),
    keccak256(bytes("1")),
    block.chainid,
    address(this)
));
```

**Optional fields** (per spec): `name`, `version`, `chainId`, `verifyingContract`, `salt`. Only include fields present in your type string. In practice, always include `chainId` and `verifyingContract` to prevent replay.

**Fork protection**: Cache the domain separator at deployment, but recompute if `block.chainid` changes at runtime (chain fork). OpenZeppelin's `EIP712` base contract handles this automatically.

## Type Hash Calculation

Each struct type gets a type hash derived from its type string.

```solidity
bytes32 constant ORDER_TYPEHASH = keccak256(
    "Order(address maker,address token,uint256 amount,uint256 nonce)"
);
```

**Nested structs**: Include referenced types alphabetically after the primary type, with no separator:

```solidity
// If Order references Asset: "Asset(address token,uint256 amount)"
bytes32 constant ORDER_TYPEHASH = keccak256(
    "Order(address maker,Asset asset,uint256 nonce)Asset(address token,uint256 amount)"
);
```

## Encoding Rules by Solidity Type

| Solidity Type | Encoding |
|---------------|----------|
| `address` | `abi.encode(value)` (left-padded to 32 bytes) |
| `uint*` / `int*` | `abi.encode(value)` |
| `bool` | `abi.encode(value)` (0 or 1) |
| `bytes32` | `abi.encode(value)` |
| `bytes` (dynamic) | `keccak256(value)` |
| `string` | `keccak256(bytes(value))` |
| `address[]` | `keccak256(abi.encodePacked(array))` |
| `uint256[]` | `keccak256(abi.encodePacked(array))` |
| Struct | `hashStruct(value)` (recursive) |
| Struct[] | `keccak256(abi.encodePacked(hashStruct(s) for each s))` |

## hashStruct Implementation

```solidity
// hashStruct(s) = keccak256(abi.encode(typeHash, encodeData(s)))
function hashOrder(Order memory order) internal pure returns (bytes32) {
    return keccak256(abi.encode(
        ORDER_TYPEHASH,
        order.maker,
        order.token,
        order.amount,
        order.nonce
    ));
}
```

## Full Digest — The Final Hash to Sign

```solidity
// EIP-712 digest = keccak256("\x19\x01" || domainSeparator || hashStruct(message))
bytes32 digest = keccak256(abi.encodePacked(
    "\x19\x01",
    DOMAIN_SEPARATOR,
    hashOrder(order)
));
```

The `\x19\x01` prefix is EIP-191 version `0x01`, which designates EIP-712 structured data.

## Solidity Verification

```solidity
function verifyOrder(Order calldata order, bytes calldata signature) external view {
    bytes32 digest = keccak256(abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        hashOrder(order)
    ));

    address signer = ECDSA.recover(digest, signature);
    require(signer == order.maker, "Invalid signature");
}
```

For smart contract signers, use ERC-1271 verification as a fallback. See the SKILL.md ERC-1271 section.

## Viem — signTypedData

```typescript
import { createWalletClient, custom } from "viem";
import { mainnet } from "viem/chains";

const walletClient = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum!),
});

const signature = await walletClient.signTypedData({
  account: "0xUserAddress...",
  domain: {
    name: "MyProtocol",
    version: "1",
    chainId: 1,
    verifyingContract: "0xContractAddress...",
  },
  types: {
    Order: [
      { name: "maker", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
  },
  primaryType: "Order",
  message: {
    maker: "0xUserAddress...",
    token: "0xTokenAddress...",
    amount: 1000000000000000000n,
    nonce: 0n,
  },
});
```

Viem computes the domain separator and type hashes automatically. The `EIP712Domain` type must NOT be listed in `types` — viem derives it from the `domain` object.

## Common Use Cases

| Use Case | Primary Type | Key Fields |
|----------|-------------|------------|
| ERC-2612 Permit | `Permit` | owner, spender, value, nonce, deadline |
| Uniswap Permit2 | `PermitSingle` / `PermitBatch` | token, amount, expiration, nonce |
| Seaport orders | `OrderComponents` | offerer, zone, offer[], consideration[] |
| Meta-transactions (ERC-2771) | `ForwardRequest` | from, to, value, gas, nonce, data |
| Governance votes (ERC-5805) | `Ballot` | proposalId, support |
| EIP-7702 authorization | `Authorization` | chainId, address, nonce |

## Common Mistakes

- **Missing `chainId` in domain**: Allows cross-chain replay. Always include it.
- **Wrong type string for nested structs**: Referenced types must be appended alphabetically. `Order(...)Asset(...)` not `Order(...)`.
- **Forgetting to hash `string` and `bytes`**: Dynamic types must be `keccak256`-ed before encoding. Passing the raw value produces an incorrect digest.
- **Including `EIP712Domain` in type definitions**: The domain type is implicit in the spec. Wallets and libraries derive it from the domain fields. Explicitly listing it causes double-hashing in some libraries.
- **Stale domain separator after fork**: If you cache the separator at deploy time and the chain forks, signatures from the other fork become valid. Always compare `block.chainid` against the cached value.

## References

- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) — Typed Structured Data Hashing and Signing
- [EIP-191](https://eips.ethereum.org/EIPS/eip-191) — Signed Data Standard
- [Viem signTypedData](https://viem.sh/docs/actions/wallet/signTypedData) — TypeScript signing
- [OpenZeppelin EIP712](https://docs.openzeppelin.com/contracts/5.x/api/utils#EIP712) — Base contract
