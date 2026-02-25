# Send Cross-Chain Message

Send a message from Ethereum to Arbitrum via the Hyperlane Mailbox.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  pad,
  toHex,
  parseAbi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const MAILBOX = "0xc005dc82818d67AF737725bD4bf75435d065D239" as const;
const ARBITRUM_DOMAIN = 42161;
```

## Address Conversion

Hyperlane uses `bytes32` for cross-chain addresses. EVM addresses must be left-padded with zeros.

```typescript
function addressToBytes32(addr: Address): `0x${string}` {
  return pad(addr, { size: 32 });
}

function bytes32ToAddress(buf: `0x${string}`): Address {
  return `0x${buf.slice(26)}` as Address;
}
```

## Quote Interchain Gas Fee

Always quote before dispatching. The fee covers relayer gas costs on the destination chain.

```typescript
const mailboxAbi = parseAbi([
  "function dispatch(uint32 _destinationDomain, bytes32 _recipientAddress, bytes _messageBody) payable returns (bytes32 messageId)",
  "function quoteDispatch(uint32 _destinationDomain, bytes32 _recipientAddress, bytes _messageBody) view returns (uint256 fee)",
]);

async function quoteMessage(
  destinationDomain: number,
  recipient: Address,
  messageBody: `0x${string}`
): Promise<bigint> {
  const recipientBytes32 = addressToBytes32(recipient);

  const fee = await publicClient.readContract({
    address: MAILBOX,
    abi: mailboxAbi,
    functionName: "quoteDispatch",
    args: [destinationDomain, recipientBytes32, messageBody],
  });

  return fee;
}
```

## Send a Message

```typescript
async function sendMessage(
  destinationDomain: number,
  recipient: Address,
  messageBody: `0x${string}`
): Promise<{ hash: `0x${string}`; messageId: `0x${string}` }> {
  const recipientBytes32 = addressToBytes32(recipient);

  // Quote the interchain gas fee
  const fee = await quoteMessage(destinationDomain, recipient, messageBody);

  // Simulate to catch reverts before sending
  const { request, result } = await publicClient.simulateContract({
    address: MAILBOX,
    abi: mailboxAbi,
    functionName: "dispatch",
    args: [destinationDomain, recipientBytes32, messageBody],
    value: fee,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Dispatch reverted");

  return { hash, messageId: result };
}
```

## Parse Dispatch Event

The Mailbox emits a `Dispatch` event containing the full message and message ID.

```typescript
import { decodeEventLog } from "viem";

const mailboxEventAbi = parseAbi([
  "event Dispatch(address indexed sender, uint32 indexed destination, bytes32 indexed recipient, bytes message)",
  "event DispatchId(bytes32 indexed messageId)",
]);

function parseDispatchEvent(receipt: {
  logs: readonly {
    topics: readonly `0x${string}`[];
    data: `0x${string}`;
    address: Address;
  }[];
}) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: mailboxEventAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "DispatchId") {
        return { messageId: decoded.args.messageId };
      }
    } catch {
      // Log doesn't match, skip
    }
  }
  return null;
}
```

## Track Message Delivery

Use the Hyperlane Explorer API to check if a message has been delivered.

```typescript
async function checkMessageStatus(
  messageId: `0x${string}`
): Promise<"pending" | "delivered" | "failed"> {
  const response = await fetch(
    `https://explorer.hyperlane.xyz/api/v1/messages/${messageId}`
  );

  if (!response.ok) return "pending";

  const data = (await response.json()) as {
    status: "pending" | "delivered" | "failed";
  };
  return data.status;
}
```

## Complete Usage

```typescript
async function main() {
  const recipientOnArbitrum: Address = "0xYourRecipientContractOnArbitrum";
  const message = toHex("Execute trade: 100 USDC -> WETH");

  // Quote fee
  const fee = await quoteMessage(ARBITRUM_DOMAIN, recipientOnArbitrum, message);
  console.log(`Interchain gas fee: ${fee} wei`);

  // Send message
  const { hash, messageId } = await sendMessage(
    ARBITRUM_DOMAIN,
    recipientOnArbitrum,
    message
  );

  console.log(`Dispatched on Ethereum: ${hash}`);
  console.log(`Message ID: ${messageId}`);
  console.log(
    `Track delivery: https://explorer.hyperlane.xyz/message/${messageId}`
  );
}

main().catch(console.error);
```
