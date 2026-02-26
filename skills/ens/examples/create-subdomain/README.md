# ENS Subdomains

Examples for creating and managing ENS subdomains, including onchain subdomains, Name Wrapper integration, and offchain resolution via CCIP-Read.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { namehash, labelhash } from "viem/ens";

const ENS_REGISTRY =
  "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const;
const NAME_WRAPPER =
  "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401" as const;
const PUBLIC_RESOLVER =
  "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63" as const;

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});
```

## Creating an Onchain Subdomain (Registry)

For unwrapped names, use the ENS Registry directly.

```typescript
const REGISTRY_ABI = parseAbi([
  "function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external",
  "function owner(bytes32 node) view returns (address)",
  "function resolver(bytes32 node) view returns (address)",
]);

const parentNode = namehash("myname.eth");
const subLabel = labelhash("sub");

const hash = await walletClient.writeContract({
  address: ENS_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: "setSubnodeRecord",
  args: [
    parentNode,
    subLabel,
    account.address,   // owner of sub.myname.eth
    PUBLIC_RESOLVER,   // resolver
    0n,                // TTL
  ],
});
await client.waitForTransactionReceipt({ hash });
// sub.myname.eth is now live
```

## Creating Subdomains on Name Wrapper

For wrapped names, use the Name Wrapper to create subdomains with fuse permissions.

```typescript
const WRAPPER_ABI = parseAbi([
  "function setSubnodeOwner(bytes32 parentNode, string label, address owner, uint32 fuses, uint64 expiry) external returns (bytes32)",
  "function setSubnodeRecord(bytes32 parentNode, string label, address owner, address resolver, uint64 ttl, uint32 fuses, uint64 expiry) external returns (bytes32)",
  "function isWrapped(bytes32 node) view returns (bool)",
  "function getData(uint256 id) view returns (address owner, uint32 fuses, uint64 expiry)",
]);

const parentNode = namehash("myname.eth");

// Expiry must be <= parent expiry. 0 = no expiry (inherits parent).
const hash = await walletClient.writeContract({
  address: NAME_WRAPPER,
  abi: WRAPPER_ABI,
  functionName: "setSubnodeRecord",
  args: [
    parentNode,
    "sub",             // label (not labelhash -- Name Wrapper takes the string)
    account.address,   // owner
    PUBLIC_RESOLVER,   // resolver
    0n,                // TTL
    0,                 // fuses (0 = no restrictions)
    0n,                // expiry (0 = inherits parent)
  ],
});
await client.waitForTransactionReceipt({ hash });
```

## Fuses and Permissions on Subdomains

Fuses restrict what can be done with a wrapped subdomain. Once burned, they cannot be unburned until the name expires.

```typescript
// Parent-controlled fuses
const CANNOT_UNWRAP = 1;
const CANNOT_BURN_FUSES = 2;
const CANNOT_TRANSFER = 4;
const CANNOT_SET_RESOLVER = 8;
const CANNOT_SET_TTL = 16;
const CANNOT_CREATE_SUBDOMAIN = 32;
const CANNOT_APPROVE = 64;

// PARENT_CANNOT_CONTROL = 65536 -- once set, parent cannot modify the subname
// This requires CANNOT_UNWRAP to be set on both the parent and the subname.

// Create a subdomain the parent cannot revoke
const PARENT_CANNOT_CONTROL = 65536;

const hash = await walletClient.writeContract({
  address: NAME_WRAPPER,
  abi: WRAPPER_ABI,
  functionName: "setSubnodeRecord",
  args: [
    parentNode,
    "permanent",
    account.address,
    PUBLIC_RESOLVER,
    0n,
    CANNOT_UNWRAP | PARENT_CANNOT_CONTROL, // fuses
    BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60), // 1 year expiry
  ],
});
await client.waitForTransactionReceipt({ hash });
```

## Setting Subdomain Records

After creating a subdomain, set its records like any other name.

```typescript
import { encodeFunctionData } from "viem";

const RESOLVER_ABI = parseAbi([
  "function setText(bytes32 node, string key, string value) external",
  "function setAddr(bytes32 node, address addr) external",
  "function multicall(bytes[] data) external returns (bytes[])",
]);

const subNode = namehash("sub.myname.eth");

const calls = [
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setAddr",
    args: [subNode, account.address],
  }),
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [subNode, "description", "My subdomain"],
  }),
];

const hash = await walletClient.writeContract({
  address: PUBLIC_RESOLVER,
  abi: RESOLVER_ABI,
  functionName: "multicall",
  args: [calls],
});
await client.waitForTransactionReceipt({ hash });
```

## Offchain Subdomains (CCIP-Read / ERC-3668)

Offchain subdomains allow issuing unlimited subdomains without gas costs. The parent resolver implements ERC-3668, returning an `OffchainLookup` error that directs the client to a gateway. This is how cb.id, uni.eth, and lens.xyz work.

From the client side, offchain subdomains resolve transparently -- viem handles CCIP-Read automatically:

```typescript
// No special handling needed for offchain names
const address = await client.getEnsAddress({
  name: "user.cb.id",
});

const avatar = await client.getEnsAvatar({
  name: "user.cb.id",
});
```

To build your own offchain subdomain service, you need:

1. **An onchain resolver** that reverts with `OffchainLookup` (implements ENSIP-10 wildcard `resolve(bytes,bytes)`)
2. **A gateway server** that handles lookups and returns signed responses
3. **A callback function** on the resolver that verifies the gateway's signature

See the SKILL.md `OffchainResolver` Solidity example for the contract pattern.

## Subdomain Management Patterns

### Check if subdomain exists

```typescript
const owner = await client.readContract({
  address: ENS_REGISTRY,
  abi: parseAbi(["function owner(bytes32 node) view returns (address)"]),
  functionName: "owner",
  args: [namehash("sub.myname.eth")],
});

const exists = owner !== "0x0000000000000000000000000000000000000000";
```

### Delete a subdomain

Set owner to zero address to remove a subdomain.

```typescript
const REGISTRY_ABI = parseAbi([
  "function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl) external",
]);

const hash = await walletClient.writeContract({
  address: ENS_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: "setSubnodeRecord",
  args: [
    namehash("myname.eth"),
    labelhash("sub"),
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    0n,
  ],
});
await client.waitForTransactionReceipt({ hash });
```
