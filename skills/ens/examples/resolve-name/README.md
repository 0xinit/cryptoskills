# ENS Name Resolution

Examples for resolving ENS names using viem's built-in ENS actions.

## Setup

```typescript
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});
```

## Forward Resolution (Name to Address)

```typescript
const address = await client.getEnsAddress({
  name: "vitalik.eth",
});
// "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

if (!address) {
  console.log("No address record set for this name");
}
```

## Reverse Resolution (Address to Name)

```typescript
const name = await client.getEnsName({
  address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
});
// "vitalik.eth" or null if no primary name set

// Reverse resolution is opt-in -- the address owner must have
// explicitly set their primary name via the Reverse Registrar.
// Always handle null.
```

## Avatar Resolution

```typescript
const avatarUrl = await client.getEnsAvatar({
  name: "vitalik.eth",
});
// HTTPS URL to the avatar image, or null

// Supports HTTPS URLs, IPFS URIs, and NFT references (ENSIP-12):
// "eip155:1/erc721:0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d/1234"
// viem resolves NFT references to the token's image URL automatically.
```

## Text Record Resolution

```typescript
const twitter = await client.getEnsText({
  name: "vitalik.eth",
  key: "com.twitter",
});

const github = await client.getEnsText({
  name: "vitalik.eth",
  key: "com.github",
});

const url = await client.getEnsText({
  name: "vitalik.eth",
  key: "url",
});

const description = await client.getEnsText({
  name: "vitalik.eth",
  key: "description",
});

const email = await client.getEnsText({
  name: "vitalik.eth",
  key: "email",
});
```

## Multi-Chain Address Resolution (ENSIP-9)

ENS resolvers store addresses for any blockchain using SLIP-44 coin types.

```typescript
// ETH address (coin type 60, default)
const ethAddress = await client.getEnsAddress({
  name: "vitalik.eth",
});

// BTC address (coin type 0)
const btcAddress = await client.getEnsAddress({
  name: "vitalik.eth",
  coinType: 0,
});

// Solana address (coin type 501)
const solAddress = await client.getEnsAddress({
  name: "vitalik.eth",
  coinType: 501,
});

// Arbitrum One (coin type 2147525809 = 0x80000000 + 42161)
// EVM chains use coin type = 0x80000000 | chainId (ENSIP-11)
const arbAddress = await client.getEnsAddress({
  name: "vitalik.eth",
  coinType: 2147525809,
});
```

## Batch Resolution with Multicall

Resolve multiple records for a single name in one RPC call.

```typescript
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { namehash } from "viem/ens";

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const RESOLVER_ABI = parseAbi([
  "function addr(bytes32 node) view returns (address)",
  "function text(bytes32 node, string key) view returns (string)",
]);

const name = "vitalik.eth";
const node = namehash(name);

const resolverAddress = await client.getEnsResolver({ name });

const results = await client.multicall({
  contracts: [
    {
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: "addr",
      args: [node],
    },
    {
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: "text",
      args: [node, "com.twitter"],
    },
    {
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: "text",
      args: [node, "com.github"],
    },
    {
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: "text",
      args: [node, "avatar"],
    },
    {
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: "text",
      args: [node, "url"],
    },
  ],
});

const [addr, twitter, github, avatar, url] = results.map((r) => r.result);
```

## CCIP-Read / Offchain Resolution

Offchain subdomains (cb.id, uni.eth) resolve transparently through CCIP-Read (ERC-3668). No client-side changes are needed -- viem handles the offchain lookup automatically.

```typescript
// Offchain names resolve identically to onchain names
const cbAddress = await client.getEnsAddress({
  name: "myuser.cb.id",
});

const uniAvatar = await client.getEnsAvatar({
  name: "myuser.uni.eth",
});
```

## Safe Resolution with Error Handling

```typescript
async function resolveEnsProfile(name: string) {
  try {
    const [address, ensName, avatar] = await Promise.allSettled([
      client.getEnsAddress({ name }),
      client.getEnsName({
        address: await client.getEnsAddress({ name }).then((a) => a!),
      }),
      client.getEnsAvatar({ name }),
    ]);

    return {
      address: address.status === "fulfilled" ? address.value : null,
      primaryName: ensName.status === "fulfilled" ? ensName.value : null,
      avatar: avatar.status === "fulfilled" ? avatar.value : null,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Could not find resolver")) {
      return null;
    }
    throw error;
  }
}
```

## Name Validation

```typescript
import { normalize } from "viem/ens";

function isValidEnsName(name: string): boolean {
  try {
    normalize(name);
    return true;
  } catch {
    return false;
  }
}

// normalize() applies UTS-46 normalization (required before any ENS operation).
// viem's getEnsAddress/getEnsName call normalize() internally, but you
// must call it yourself when building raw contract calldata.
```
