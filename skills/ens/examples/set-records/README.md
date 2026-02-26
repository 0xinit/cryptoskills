# Setting ENS Records

Examples for setting address records, text records, and content hashes on ENS names.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { namehash } from "viem/ens";

const PUBLIC_RESOLVER =
  "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63" as const;

const RESOLVER_ABI = parseAbi([
  "function setText(bytes32 node, string key, string value) external",
  "function setAddr(bytes32 node, address addr) external",
  "function setAddr(bytes32 node, uint256 coinType, bytes value) external",
  "function setContenthash(bytes32 node, bytes hash) external",
  "function multicall(bytes[] data) external returns (bytes[])",
  "function text(bytes32 node, string key) view returns (string)",
  "function addr(bytes32 node) view returns (address)",
  "function contenthash(bytes32 node) view returns (bytes)",
]);

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

const node = namehash("myname.eth");
```

## Setting a Text Record

```typescript
const hash = await walletClient.writeContract({
  address: PUBLIC_RESOLVER,
  abi: RESOLVER_ABI,
  functionName: "setText",
  args: [node, "com.twitter", "myhandle"],
});
await client.waitForTransactionReceipt({ hash });
```

## Setting the ETH Address Record

```typescript
const hash = await walletClient.writeContract({
  address: PUBLIC_RESOLVER,
  abi: RESOLVER_ABI,
  functionName: "setAddr",
  args: [node, account.address],
});
await client.waitForTransactionReceipt({ hash });
```

## Setting Multi-Coin Addresses (ENSIP-9)

Non-ETH addresses use the overloaded `setAddr(bytes32, uint256, bytes)` with SLIP-44 coin types.

```typescript
import { toBytes } from "viem";

// BTC address (coin type 0) -- must be raw bytes, not the bech32/base58 string
// Encoding depends on the chain's address format.
const btcAddressBytes = toBytes("0x..."); // Decoded BTC address bytes

const hash = await walletClient.writeContract({
  address: PUBLIC_RESOLVER,
  abi: RESOLVER_ABI,
  functionName: "setAddr",
  args: [node, 0n, btcAddressBytes],
});
await client.waitForTransactionReceipt({ hash });
```

## Setting Content Hash

Content hashes point to decentralized storage (IPFS, Arweave, Swarm).

```typescript
// IPFS content hash -- must be encoded as multicodec bytes
// Use @ensdomains/content-hash to encode from CID string
// import { encode } from "@ensdomains/content-hash";
// const encodedHash = encode("ipfs", "QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4");

const hash = await walletClient.writeContract({
  address: PUBLIC_RESOLVER,
  abi: RESOLVER_ABI,
  functionName: "setContenthash",
  args: [node, "0x..." as `0x${string}`], // encoded content hash bytes
});
await client.waitForTransactionReceipt({ hash });
```

## Batch Record Setting with Multicall

Set multiple records in a single transaction using the resolver's built-in multicall.

```typescript
const calls = [
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [node, "com.twitter", "myhandle"],
  }),
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [node, "com.github", "mygithub"],
  }),
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [node, "url", "https://mysite.com"],
  }),
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [node, "email", "me@mysite.com"],
  }),
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [node, "avatar", "https://mysite.com/avatar.png"],
  }),
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [node, "description", "Web3 builder"],
  }),
];

const hash = await walletClient.writeContract({
  address: PUBLIC_RESOLVER,
  abi: RESOLVER_ABI,
  functionName: "multicall",
  args: [calls],
});

const receipt = await client.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  throw new Error("Multicall record update reverted");
}
```

## Reading Records

```typescript
// Read text records
const twitter = await client.getEnsText({
  name: "myname.eth",
  key: "com.twitter",
});

const github = await client.getEnsText({
  name: "myname.eth",
  key: "com.github",
});

// Read address record
const address = await client.getEnsAddress({
  name: "myname.eth",
});

// Read content hash via direct contract call
const resolverAddress = await client.getEnsResolver({
  name: "myname.eth",
});

const contenthash = await client.readContract({
  address: resolverAddress,
  abi: RESOLVER_ABI,
  functionName: "contenthash",
  args: [namehash("myname.eth")],
});
```

## Setting the Primary Name (Reverse Record)

The primary name is what `getEnsName()` returns for your address. You must explicitly set it.

```typescript
const REVERSE_REGISTRAR =
  "0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb" as const;

const REVERSE_ABI = parseAbi([
  "function setName(string name) external returns (bytes32)",
]);

const hash = await walletClient.writeContract({
  address: REVERSE_REGISTRAR,
  abi: REVERSE_ABI,
  functionName: "setName",
  args: ["myname.eth"],
});
await client.waitForTransactionReceipt({ hash });
```
