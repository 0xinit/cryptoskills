# ENS Name Registration

Examples for registering and renewing `.eth` names using the ETHRegistrarController.

## Overview

ENS `.eth` registration uses a two-step commit-reveal process to prevent frontrunning:

1. **Commit** -- Submit a hash of your registration intent
2. **Wait** -- At least 60 seconds (max 24 hours)
3. **Register** -- Submit the actual registration with payment

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodePacked,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const ETH_REGISTRAR_CONTROLLER =
  "0x253553366Da8546fC250F225fe3d25d0C782303b" as const;

const PUBLIC_RESOLVER =
  "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63" as const;

const CONTROLLER_ABI = parseAbi([
  "function rentPrice(string name, uint256 duration) view returns (tuple(uint256 base, uint256 premium))",
  "function available(string name) view returns (bool)",
  "function makeCommitment(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint16 ownerControlledFuses) pure returns (bytes32)",
  "function commit(bytes32 commitment) external",
  "function register(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint16 ownerControlledFuses) payable",
  "function renew(string name, uint256 duration) payable",
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
```

## Check Availability

```typescript
async function isNameAvailable(label: string): Promise<boolean> {
  return client.readContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: CONTROLLER_ABI,
    functionName: "available",
    args: [label],
  });
}

const available = await isNameAvailable("myname");
console.log(`myname.eth available: ${available}`);
```

## Get Registration Price

```typescript
const ONE_YEAR = 31536000n; // 365 days in seconds

async function getPrice(label: string, duration: bigint) {
  const rentPrice = await client.readContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: CONTROLLER_ABI,
    functionName: "rentPrice",
    args: [label, duration],
  });

  return {
    base: rentPrice.base,
    premium: rentPrice.premium,
    total: rentPrice.base + rentPrice.premium,
  };
}

const price = await getPrice("myname", ONE_YEAR);
// price.total is in wei
```

## Full Commit-Reveal Registration

```typescript
async function registerName(label: string, durationSeconds: bigint) {
  // Step 1: Check availability
  const isAvailable = await client.readContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: CONTROLLER_ABI,
    functionName: "available",
    args: [label],
  });
  if (!isAvailable) throw new Error(`${label}.eth is not available`);

  // Step 2: Get price (add 10% buffer for ETH/USD fluctuation during wait)
  const rentPrice = await client.readContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: CONTROLLER_ABI,
    functionName: "rentPrice",
    args: [label, durationSeconds],
  });
  const totalPrice = ((rentPrice.base + rentPrice.premium) * 110n) / 100n;

  // Step 3: Generate secret
  const secret = keccak256(
    encodePacked(
      ["address", "uint256"],
      [account.address, BigInt(Date.now())]
    )
  );

  // Step 4: Create commitment hash
  const commitment = await client.readContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: CONTROLLER_ABI,
    functionName: "makeCommitment",
    args: [
      label,
      account.address,
      durationSeconds,
      secret,
      PUBLIC_RESOLVER,
      [],    // data: encoded resolver calls to set records at registration time
      true,  // reverseRecord: set as primary name
      0,     // ownerControlledFuses: 0 = no fuses burned
    ],
  });

  // Step 5: Submit commitment
  const commitHash = await walletClient.writeContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: CONTROLLER_ABI,
    functionName: "commit",
    args: [commitment],
  });
  await client.waitForTransactionReceipt({ hash: commitHash });
  console.log("Commitment submitted. Waiting 65 seconds...");

  // Step 6: Wait (minCommitmentAge = 60s, add 5s buffer)
  await new Promise((resolve) => setTimeout(resolve, 65_000));

  // Step 7: Register
  const registerHash = await walletClient.writeContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: CONTROLLER_ABI,
    functionName: "register",
    args: [
      label,
      account.address,
      durationSeconds,
      secret,
      PUBLIC_RESOLVER,
      [],
      true,
      0,
    ],
    value: totalPrice,
  });

  const receipt = await client.waitForTransactionReceipt({
    hash: registerHash,
  });
  if (receipt.status !== "success") {
    throw new Error("Registration transaction reverted");
  }

  console.log(`Registered ${label}.eth`);
  return receipt;
}

// Register for 1 year
await registerName("myname", 31536000n);
```

## Renewal

Renewal is a single transaction -- no commit-reveal needed.

```typescript
async function renewName(label: string, durationSeconds: bigint) {
  const rentPrice = await client.readContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: CONTROLLER_ABI,
    functionName: "rentPrice",
    args: [label, durationSeconds],
  });
  // 5% buffer for price changes
  const totalPrice = ((rentPrice.base + rentPrice.premium) * 105n) / 100n;

  const hash = await walletClient.writeContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: CONTROLLER_ABI,
    functionName: "renew",
    args: [label, durationSeconds],
    value: totalPrice,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Renewal transaction reverted");
  }

  console.log(`Renewed ${label}.eth`);
  return receipt;
}
```

## Fuses and Name Wrapper

The Name Wrapper wraps ENS names as ERC-1155 tokens with permission fuses. Fuses are irreversible restrictions that can be burned on wrapped names.

```typescript
import { parseAbi } from "viem";

const NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401" as const;

const WRAPPER_ABI = parseAbi([
  "function isWrapped(bytes32 node) view returns (bool)",
  "function getData(uint256 id) view returns (address owner, uint32 fuses, uint64 expiry)",
]);

// Parent-controlled fuses (set by parent owner)
const CANNOT_UNWRAP = 1;
const CANNOT_BURN_FUSES = 2;
const CANNOT_TRANSFER = 4;
const CANNOT_SET_RESOLVER = 8;
const CANNOT_SET_TTL = 16;
const CANNOT_CREATE_SUBDOMAIN = 32;
const CANNOT_APPROVE = 64;

// To burn fuses, the name must first be wrapped and CANNOT_UNWRAP must be set.
// Fuses are permanent and cannot be unburned.
```

## Registration with Records at Creation

Set text records and addresses during registration by encoding resolver calls in the `data` parameter.

```typescript
import { encodeFunctionData, parseAbi } from "viem";
import { namehash } from "viem/ens";

const RESOLVER_ABI = parseAbi([
  "function setText(bytes32 node, string key, string value) external",
  "function setAddr(bytes32 node, address addr) external",
]);

// The node for the name being registered
const node = namehash("myname.eth");

// Encode resolver calls to execute at registration
const data = [
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [node, "com.twitter", "myhandle"],
  }),
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [node, "url", "https://mysite.com"],
  }),
  encodeFunctionData({
    abi: RESOLVER_ABI,
    functionName: "setAddr",
    args: [node, account.address],
  }),
];

// Pass data array to makeCommitment and register
// This sets records atomically during registration
const commitment = await client.readContract({
  address: ETH_REGISTRAR_CONTROLLER,
  abi: CONTROLLER_ABI,
  functionName: "makeCommitment",
  args: [
    "myname",
    account.address,
    31536000n,
    secret,
    PUBLIC_RESOLVER,
    data,   // encoded resolver calls
    true,
    0,
  ],
});
```

## Common Registration Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `CommitmentTooNew` | Register called < 60s after commit | Wait at least 60 seconds |
| `CommitmentTooOld` | Commitment older than 24 hours | Submit a new commitment |
| `NameNotAvailable` | Name registered or in grace period | Check `available()` first |
| `DurationTooShort` | Duration under 28 days | Use at least `2419200n` seconds |
| `InsufficientValue` | Not enough ETH sent | Add 5-10% buffer to `rentPrice()` |
