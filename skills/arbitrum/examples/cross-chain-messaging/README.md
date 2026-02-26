# Cross-Chain Messaging on Arbitrum

## Overview

Arbitrum provides two directions of cross-chain messaging:
- **L1 to L2**: Retryable Tickets via the Inbox contract (~10 minutes)
- **L2 to L1**: ArbSys messages via the Outbox (~7 days challenge period)

## L1 to L2: Retryable Tickets

### How It Works

1. Call `createRetryableTicket` on the L1 Inbox contract with ETH for L2 gas
2. The sequencer picks up the ticket and auto-executes it on L2
3. If L2 execution fails (out of gas), the ticket sits in the retry buffer for 7 days
4. Anyone can manually redeem a failed ticket within the TTL

### Solidity: L1 Contract Sending to L2

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IInbox {
    function createRetryableTicket(
        address to,
        uint256 l2CallValue,
        uint256 maxSubmissionCost,
        address excessFeeRefundAddress,
        address callValueRefundAddress,
        uint256 gasLimit,
        uint256 maxFeePerGas,
        bytes calldata data
    ) external payable returns (uint256);
}

contract L1Messenger {
    IInbox public immutable inbox;

    // Arbitrum One Inbox
    constructor() {
        inbox = IInbox(0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f);
    }

    /// @notice Send a message from L1 to an L2 contract
    /// @dev msg.value must cover: l2CallValue + maxSubmissionCost + (gasLimit * maxFeePerGas)
    function sendToL2(
        address l2Target,
        bytes calldata l2Calldata,
        uint256 maxSubmissionCost,
        uint256 gasLimit,
        uint256 maxFeePerGas
    ) external payable returns (uint256 ticketId) {
        ticketId = inbox.createRetryableTicket{value: msg.value}(
            l2Target,
            0,                    // l2CallValue — no ETH sent to target
            maxSubmissionCost,
            msg.sender,           // refund excess fees to caller
            msg.sender,           // refund call value on failure
            gasLimit,
            maxFeePerGas,
            l2Calldata
        );
    }
}
```

### TypeScript: Send L1 to L2 Message

```typescript
import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const l1PublicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const l1WalletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const INBOX = "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f" as const;

const inboxAbi = [
  {
    name: "createRetryableTicket",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "l2CallValue", type: "uint256" },
      { name: "maxSubmissionCost", type: "uint256" },
      { name: "excessFeeRefundAddress", type: "address" },
      { name: "callValueRefundAddress", type: "address" },
      { name: "gasLimit", type: "uint256" },
      { name: "maxFeePerGas", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Encode the L2 function call
const l2Target = "0xYourL2Contract" as `0x${string}`;
const l2Calldata = encodeFunctionData({
  abi: [{ name: "receiveMessage", type: "function", inputs: [{ name: "data", type: "uint256" }], outputs: [] }],
  functionName: "receiveMessage",
  args: [42n],
});

// Gas parameters — overestimate, excess is refunded
const maxSubmissionCost = parseEther("0.001");
const gasLimit = 1_000_000n;
const maxFeePerGas = 100_000_000n; // 0.1 gwei

const totalValue = maxSubmissionCost + gasLimit * maxFeePerGas;

const { request } = await l1PublicClient.simulateContract({
  address: INBOX,
  abi: inboxAbi,
  functionName: "createRetryableTicket",
  args: [
    l2Target,
    0n,
    maxSubmissionCost,
    account.address,
    account.address,
    gasLimit,
    maxFeePerGas,
    l2Calldata,
  ],
  value: totalValue,
  account: account.address,
});

const hash = await l1WalletClient.writeContract(request);
const receipt = await l1PublicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("Retryable ticket creation failed on L1");

console.log(`L1 tx: ${hash}`);
console.log("Retryable ticket created. L2 execution should complete within ~10 minutes.");
```

### Retryable Ticket Lifecycle

```
L1 createRetryableTicket() → Sequencer picks up → L2 auto-execute
                                                      ↓
                                            Success → Done
                                            Failure → Retry buffer (7-day TTL)
                                                      ↓
                                            Manual redeem via ArbRetryableTx.redeem()
                                                      ↓
                                            Expired → Ticket deleted, funds lost
```

### Redeeming Failed Retryable Tickets

```typescript
const ARB_RETRYABLE_TX = "0x000000000000000000000000000000000000006E" as const;

const arbRetryableAbi = [
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "ticketId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "getTimeout",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "ticketId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getLifetime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

import { createPublicClient, createWalletClient, http } from "viem";
import { arbitrum } from "viem/chains";

const l2PublicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

// Check if ticket is still redeemable
const timeout = await l2PublicClient.readContract({
  address: ARB_RETRYABLE_TX,
  abi: arbRetryableAbi,
  functionName: "getTimeout",
  args: ["0xYourTicketId"],
});

const now = BigInt(Math.floor(Date.now() / 1000));
if (timeout > now) {
  // Ticket still alive — redeem it
  const { request } = await l2PublicClient.simulateContract({
    address: ARB_RETRYABLE_TX,
    abi: arbRetryableAbi,
    functionName: "redeem",
    args: ["0xYourTicketId"],
    account: account.address,
  });
  const hash = await l2WalletClient.writeContract(request);
  console.log(`Redeemed ticket: ${hash}`);
} else {
  console.log("Ticket has expired. Funds are lost.");
}
```

## L2 to L1: ArbSys Messages

### How It Works

1. Call `ArbSys.sendTxToL1()` on L2 with the L1 target and calldata
2. Wait for the 7-day challenge period
3. Execute the message on L1 via the Outbox contract

### Solidity: L2 Contract Sending to L1

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IArbSys {
    function sendTxToL1(address destination, bytes calldata data)
        external
        payable
        returns (uint256);
}

contract L2Messenger {
    IArbSys constant ARBSYS = IArbSys(0x0000000000000000000000000000000000000064);

    event MessageSentToL1(uint256 indexed messageId, address indexed l1Target);

    /// @notice Send an arbitrary message from L2 to L1
    /// @dev After 7-day challenge period, execute on L1 via Outbox
    function sendToL1(address l1Target, bytes calldata l1Calldata) external {
        uint256 messageId = ARBSYS.sendTxToL1(l1Target, l1Calldata);
        emit MessageSentToL1(messageId, l1Target);
    }
}
```

### TypeScript: Send L2 to L1 Message

```typescript
import { createPublicClient, createWalletClient, http, encodeFunctionData } from "viem";
import { arbitrum } from "viem/chains";

const ARBSYS = "0x0000000000000000000000000000000000000064" as const;

const arbSysAbi = [
  {
    name: "sendTxToL1",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "destination", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const l1Target = "0xYourL1Contract" as `0x${string}`;
const l1Calldata = encodeFunctionData({
  abi: [{ name: "handleL2Message", type: "function", inputs: [{ name: "value", type: "uint256" }], outputs: [] }],
  functionName: "handleL2Message",
  args: [42n],
});

const { request } = await l2PublicClient.simulateContract({
  address: ARBSYS,
  abi: arbSysAbi,
  functionName: "sendTxToL1",
  args: [l1Target, l1Calldata],
  account: account.address,
});

const hash = await l2WalletClient.writeContract(request);
console.log(`L2 tx: ${hash}`);
console.log("Message sent. Must wait ~7 days before executing on L1 via Outbox.");
```

### Executing on L1 via Outbox

After the 7-day challenge period, the message can be executed on L1.

```typescript
const OUTBOX = "0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840" as const;

const outboxAbi = [
  {
    name: "executeTransaction",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes32[]" },
      { name: "index", type: "uint256" },
      { name: "l2Sender", type: "address" },
      { name: "to", type: "address" },
      { name: "l2Block", type: "uint256" },
      { name: "l1Block", type: "uint256" },
      { name: "l2Timestamp", type: "uint256" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

// The proof and parameters come from the Arbitrum SDK or by querying
// the NodeInterface for the outbox proof. Use the Arbitrum SDK for this:
// import { getL2ToL1MessageStatus } from "@arbitrum/sdk";
```

## Address Aliasing

When an L1 **contract** sends a retryable ticket, the `msg.sender` on L2 is aliased to prevent address collision between L1 and L2 contracts at the same address.

```
L2 alias = L1 address + 0x1111000000000000000000000000000000001111
```

EOA (externally owned account) senders are NOT aliased — only contract senders.

```solidity
// Solidity helper to reverse the alias
function undoL1ToL2Alias(address l2Sender) internal pure returns (address l1Sender) {
    uint160 offset = uint160(0x1111000000000000000000000000000000001111);
    unchecked {
        l1Sender = address(uint160(l2Sender) - offset);
    }
}
```
