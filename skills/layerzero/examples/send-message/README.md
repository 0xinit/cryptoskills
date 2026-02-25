# Send Cross-Chain Message Examples

Working TypeScript examples for sending a cross-chain message from Ethereum to Arbitrum using a LayerZero V2 OApp and viem.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodePacked,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, arbitrum } from "viem/chains";

const ethereumClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const OAPP_ETHEREUM: Address = "0xYourOAppOnEthereum" as Address;
const ARBITRUM_EID = 30110;
```

## Build Message Options

LayerZero V2 options encode execution parameters for the destination chain. The minimum is an `lzReceive` gas limit.

```typescript
// Option type constants
const EXECUTOR_WORKER_ID = 1;
const OPTION_TYPE_LZRECEIVE = 1;

function buildLzReceiveOption(gasLimit: bigint, value: bigint = 0n): `0x${string}` {
  const TYPE_3 = "0x0003";
  const encoded = encodePacked(
    ["uint8", "uint16", "uint8", "uint128", "uint128"],
    [EXECUTOR_WORKER_ID, 34, OPTION_TYPE_LZRECEIVE, gasLimit, value]
  );
  return `${TYPE_3}${encoded.slice(2)}` as `0x${string}`;
}

const options = buildLzReceiveOption(200_000n);
```

## Quote the Messaging Fee

Always quote before sending. The fee covers DVN verification + Executor gas on the destination.

```typescript
const oappAbi = parseAbi([
  "function quote(uint32 dstEid, bytes calldata payload, bytes calldata options) view returns ((uint256 nativeFee, uint256 lzTokenFee) fee)",
  "function sendMessage(uint32 dstEid, bytes calldata payload, bytes calldata options) payable",
]);

async function quoteSend(
  dstEid: number,
  payload: `0x${string}`,
  options: `0x${string}`
): Promise<{ nativeFee: bigint; lzTokenFee: bigint }> {
  const fee = await ethereumClient.readContract({
    address: OAPP_ETHEREUM,
    abi: oappAbi,
    functionName: "quote",
    args: [dstEid, payload, options],
  });

  return { nativeFee: fee.nativeFee, lzTokenFee: fee.lzTokenFee };
}
```

## Send a Cross-Chain Message

```typescript
import { encodeAbiParameters, parseAbiParameters } from "viem";

async function sendCrossChainMessage(message: string): Promise<`0x${string}`> {
  const payload = encodeAbiParameters(
    parseAbiParameters("string message, uint256 timestamp"),
    [message, BigInt(Math.floor(Date.now() / 1000))]
  );

  const options = buildLzReceiveOption(200_000n);

  // Quote the fee
  const { nativeFee } = await quoteSend(ARBITRUM_EID, payload, options);

  // Send with exact quoted fee as msg.value
  const { request } = await ethereumClient.simulateContract({
    address: OAPP_ETHEREUM,
    abi: oappAbi,
    functionName: "sendMessage",
    args: [ARBITRUM_EID, payload, options],
    value: nativeFee,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await ethereumClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("sendMessage reverted");

  return hash;
}
```

## Verify Message Delivery

After sending, poll the destination chain for the received event.

```typescript
const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const OAPP_ARBITRUM: Address = "0xYourOAppOnArbitrum" as Address;

const receiveEventAbi = parseAbi([
  "event MessageReceived(uint32 srcEid, bytes32 sender, bytes payload)",
]);

async function watchForDelivery(fromBlock: bigint): Promise<void> {
  const logs = await arbitrumClient.getLogs({
    address: OAPP_ARBITRUM,
    event: receiveEventAbi[0],
    fromBlock,
  });

  for (const log of logs) {
    console.log(`Message received from eid ${log.args.srcEid}`);
    console.log(`Payload: ${log.args.payload}`);
  }
}
```

## Complete Usage

```typescript
async function main() {
  const hash = await sendCrossChainMessage("Hello from Ethereum!");
  console.log(`Message sent on Ethereum: ${hash}`);
  console.log(`Track delivery at: https://layerzeroscan.com/tx/${hash}`);
}

main().catch(console.error);
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `NoPeer` revert | Peer not set for Arbitrum on source OApp | Call `setPeer(30110, bytes32(arbitrumOAppAddress))` |
| `InsufficientFee` revert | `msg.value` below quoted fee | Re-quote immediately before sending |
| Message stuck "Verifying" | DVNs waiting for block confirmations | Wait; Ethereum requires ~15 confirmations |
| Message delivered but no event | `lzReceive` reverted on destination | Increase gas limit in options (try 300k+) |
