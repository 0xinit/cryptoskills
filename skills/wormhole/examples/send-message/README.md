# Cross-Chain Message: Ethereum to Arbitrum

Working TypeScript example: publish a cross-chain message on Ethereum via Wormhole Core Bridge, fetch the signed VAA from the Guardian network, and redeem it on Arbitrum.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  decodeEventLog,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, arbitrum } from "viem/chains";

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const ethClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const ethWallet = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const arbClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARB_RPC_URL),
});

const arbWallet = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(process.env.ARB_RPC_URL),
});

const ETH_CORE_BRIDGE = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B" as const;
const WORMHOLE_ETHEREUM_CHAIN_ID = 2;
const WORMHOLE_ARBITRUM_CHAIN_ID = 23;
```

## ABIs

```typescript
const coreBridgeAbi = [
  {
    name: "publishMessage",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "nonce", type: "uint32" },
      { name: "payload", type: "bytes" },
      { name: "consistencyLevel", type: "uint8" },
    ],
    outputs: [{ name: "sequence", type: "uint64" }],
  },
  {
    name: "messageFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "parseAndVerifyVM",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "encodedVM", type: "bytes" }],
    outputs: [
      {
        name: "vm",
        type: "tuple",
        components: [
          { name: "version", type: "uint8" },
          { name: "timestamp", type: "uint32" },
          { name: "nonce", type: "uint32" },
          { name: "emitterChainId", type: "uint16" },
          { name: "emitterAddress", type: "bytes32" },
          { name: "sequence", type: "uint64" },
          { name: "consistencyLevel", type: "uint8" },
          { name: "payload", type: "bytes" },
          { name: "guardianSetIndex", type: "uint32" },
          { name: "signatures", type: "bytes" },
          { name: "hash", type: "bytes32" },
        ],
      },
      { name: "valid", type: "bool" },
      { name: "reason", type: "string" },
    ],
  },
] as const;

const logMessageAbi = [
  {
    type: "event",
    name: "LogMessagePublished",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "sequence", type: "uint64", indexed: false },
      { name: "nonce", type: "uint32", indexed: false },
      { name: "payload", type: "bytes", indexed: false },
      { name: "consistencyLevel", type: "uint8", indexed: false },
    ],
  },
] as const;
```

## Helper Functions

```typescript
function evmAddressToBytes32(address: Address): `0x${string}` {
  return `0x000000000000000000000000${address.slice(2)}` as `0x${string}`;
}

interface VaaResponse {
  data: { vaa: string };
}

async function fetchVaa(
  emitterChain: number,
  emitterAddress: string,
  sequence: bigint,
  maxRetries = 60,
  delayMs = 5000
): Promise<Uint8Array> {
  const url = `https://api.wormholescan.io/api/v1/vaas/${emitterChain}/${emitterAddress}/${sequence}`;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const json = (await response.json()) as VaaResponse;
        return Uint8Array.from(atob(json.data.vaa), (c) => c.charCodeAt(0));
      }
    } catch {
      // Guardian network not ready yet, retry
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    `VAA not available after ${maxRetries} retries: chain=${emitterChain} seq=${sequence}`
  );
}
```

## Step 1: Publish Message on Ethereum

```typescript
async function publishMessage(payload: Uint8Array): Promise<{
  hash: `0x${string}`;
  sequence: bigint;
}> {
  const messageFee = await ethClient.readContract({
    address: ETH_CORE_BRIDGE,
    abi: coreBridgeAbi,
    functionName: "messageFee",
  });

  const { request, result } = await ethClient.simulateContract({
    address: ETH_CORE_BRIDGE,
    abi: coreBridgeAbi,
    functionName: "publishMessage",
    args: [
      0,
      `0x${Buffer.from(payload).toString("hex")}`,
      15, // finalized consistency level
    ],
    value: messageFee,
    account: account.address,
  });

  const hash = await ethWallet.writeContract(request);
  const receipt = await ethClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("publishMessage reverted");

  // Parse the sequence number from LogMessagePublished event
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: logMessageAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "LogMessagePublished") {
        return { hash, sequence: decoded.args.sequence };
      }
    } catch {
      // Not a LogMessagePublished event
    }
  }

  throw new Error("LogMessagePublished event not found in receipt");
}
```

## Step 2: Fetch VAA from Guardian Network

```typescript
async function getSignedVaa(sequence: bigint): Promise<Uint8Array> {
  // The emitter is the sender contract address, left-padded to bytes32
  // For direct Core Bridge calls, the emitter is the tx sender (your EOA or contract)
  const emitterAddress = evmAddressToBytes32(account.address).slice(2);

  console.log("Waiting for Guardian signatures...");
  const vaa = await fetchVaa(
    WORMHOLE_ETHEREUM_CHAIN_ID,
    emitterAddress,
    sequence
  );

  console.log(`VAA received: ${vaa.length} bytes`);
  return vaa;
}
```

## Step 3: Verify and Consume on Arbitrum

```typescript
const ARB_CORE_BRIDGE = "0xa5f208e072434bC67592E4C49C1B991BA79BCA46" as const;

async function verifyAndConsumeOnArbitrum(
  vaaBytes: Uint8Array
): Promise<{ valid: boolean; payload: `0x${string}` }> {
  const encodedVaa = `0x${Buffer.from(vaaBytes).toString("hex")}` as `0x${string}`;

  const [vm, valid, reason] = await arbClient.readContract({
    address: ARB_CORE_BRIDGE,
    abi: coreBridgeAbi,
    functionName: "parseAndVerifyVM",
    args: [encodedVaa],
  });

  if (!valid) {
    throw new Error(`VAA verification failed: ${reason}`);
  }

  console.log(`Verified VAA from chain ${vm.emitterChainId}`);
  console.log(`Emitter: ${vm.emitterAddress}`);
  console.log(`Sequence: ${vm.sequence}`);

  return { valid: true, payload: vm.payload };
}
```

## Complete Usage

```typescript
async function main() {
  const message = new TextEncoder().encode(
    JSON.stringify({
      action: "updatePrice",
      token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      price: "2500000000", // 8 decimal price
      timestamp: Math.floor(Date.now() / 1000),
    })
  );

  // Step 1: Publish on Ethereum
  console.log("Publishing message on Ethereum...");
  const { hash, sequence } = await publishMessage(message);
  console.log(`Published: tx=${hash} sequence=${sequence}`);

  // Step 2: Fetch signed VAA (takes ~13 minutes for finality + guardian signing)
  console.log("Fetching signed VAA...");
  const vaaBytes = await getSignedVaa(sequence);

  // Step 3: Verify on Arbitrum
  console.log("Verifying on Arbitrum...");
  const { payload } = await verifyAndConsumeOnArbitrum(vaaBytes);
  console.log(`Payload delivered: ${payload}`);

  // In production, this verification would happen inside a receiver contract
  // that also processes the payload (update state, mint tokens, etc.)
}

main().catch(console.error);
```

## Notes

- The Guardian network takes ~13 minutes to produce a signed VAA after Ethereum finality (15 blocks at ~12s + guardian observation + signing).
- For automatic delivery without manual VAA fetching, use the Standard Relayer (see `SKILL.md` Standard Relayer section).
- The emitter address for direct Core Bridge calls from an EOA is the EOA address itself, left-padded to bytes32. For calls from a contract, it is the contract address.
- In production, always deploy a receiver contract that verifies the emitter address and chain to prevent spoofing.
