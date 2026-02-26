# Cross-Chain Messaging on Optimism

Send arbitrary messages between Ethereum L1 and OP Mainnet L2 using the `CrossDomainMessenger`.

## L1 → L2 Deposit (Fast, ~1-3 minutes)

### Solidity: Send Message from L1

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IL1CrossDomainMessenger {
    function sendMessage(
        address _target,
        bytes calldata _message,
        uint32 _minGasLimit
    ) external payable;
}

contract L1Messenger {
    /// @dev OP Mainnet L1CrossDomainMessenger on Ethereum
    IL1CrossDomainMessenger public constant MESSENGER =
        IL1CrossDomainMessenger(0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1);

    /// @notice Send a greeting to an L2 contract.
    /// @param l2Greeter The L2 contract that will receive the greeting.
    /// @param greeting The greeting string to send.
    function sendGreeting(address l2Greeter, string calldata greeting) external {
        bytes memory message = abi.encodeWithSignature(
            "receiveGreeting(string)",
            greeting
        );

        // 200_000 gas limit for L2 execution — adjust based on your L2 function
        MESSENGER.sendMessage(l2Greeter, message, 200_000);
    }
}
```

### Solidity: Receive Message on L2

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICrossDomainMessenger {
    function xDomainMessageSender() external view returns (address);
}

contract L2Greeter {
    ICrossDomainMessenger public constant MESSENGER =
        ICrossDomainMessenger(0x4200000000000000000000000000000000000007);

    address public immutable l1Messenger;
    string public greeting;

    event GreetingReceived(string greeting, address indexed sender);

    constructor(address _l1Messenger) {
        l1Messenger = _l1Messenger;
    }

    function receiveGreeting(string calldata _greeting) external {
        require(msg.sender == address(MESSENGER), "Only messenger");
        require(
            MESSENGER.xDomainMessageSender() == l1Messenger,
            "Only L1 messenger contract"
        );

        greeting = _greeting;
        emit GreetingReceived(_greeting, l1Messenger);
    }
}
```

### TypeScript: Send L1→L2 Message with Viem

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const l1Client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const L1_CROSS_DOMAIN_MESSENGER: Address =
  "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1";

const messengerAbi = parseAbi([
  "function sendMessage(address _target, bytes calldata _message, uint32 _minGasLimit) external payable",
]);

async function sendL1ToL2Message(
  l2Target: Address,
  message: `0x${string}`,
  minGasLimit: number
) {
  const hash = await l1Client.writeContract({
    address: L1_CROSS_DOMAIN_MESSENGER,
    abi: messengerAbi,
    functionName: "sendMessage",
    args: [l2Target, message, minGasLimit],
  });

  console.log(`L1 tx sent: ${hash}`);
  console.log("Message will arrive on L2 in ~1-3 minutes");

  return hash;
}
```

## L2 → L1 Withdrawal (Slow, ~7 days)

### Step 1: Initiate Withdrawal on L2

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { optimism } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const l2WalletClient = createWalletClient({
  account,
  chain: optimism,
  transport: http(process.env.OP_MAINNET_RPC),
});

const l2PublicClient = createPublicClient({
  chain: optimism,
  transport: http(process.env.OP_MAINNET_RPC),
});

const L2_CROSS_DOMAIN_MESSENGER: Address =
  "0x4200000000000000000000000000000000000007";

const l2MessengerAbi = parseAbi([
  "function sendMessage(address _target, bytes calldata _message, uint32 _minGasLimit) external payable",
]);

async function initiateWithdrawalMessage(
  l1Target: Address,
  message: `0x${string}`,
  minGasLimit: number
) {
  const hash = await l2WalletClient.writeContract({
    address: L2_CROSS_DOMAIN_MESSENGER,
    abi: l2MessengerAbi,
    functionName: "sendMessage",
    args: [l1Target, message, minGasLimit],
  });

  const receipt = await l2PublicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === "reverted") {
    throw new Error("Withdrawal initiation reverted");
  }

  console.log(`Withdrawal initiated: ${hash}`);
  console.log("Next: prove on L1 after output root is proposed (~1 hour)");
  console.log("Then: finalize on L1 after 7-day challenge period");

  return receipt;
}
```

### Step 2: Prove Withdrawal on L1

After the L2 output root containing your withdrawal is proposed on L1 (~1 hour), prove the withdrawal:

```typescript
import { mainnet } from "viem/chains";

const l1WalletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const l1PublicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

// Use viem's built-in OP Stack actions for proving and finalizing
// These handle the complex proof generation and contract interactions
async function proveAndFinalizeWithdrawal(l2TxHash: `0x${string}`) {
  const l2Receipt = await l2PublicClient.getTransactionReceipt({
    hash: l2TxHash,
  });

  // Wait for output root to be proposed on L1 (~1 hour)
  // Then prove the withdrawal
  console.log("Waiting for output root proposal...");
  console.log("After proving, wait 7 days for the challenge period");
  console.log("Then call finalizeWithdrawalTransaction on OptimismPortal");
}
```

### Step 3: Finalize Withdrawal on L1

After the 7-day challenge period passes:

```typescript
import { parseAbi, type Address } from "viem";

const OPTIMISM_PORTAL: Address = "0xbEb5Fc579115071764c7423A4f12eDde41f106Ed";

const portalAbi = parseAbi([
  "function finalizeWithdrawalTransaction((uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data) _tx) external",
]);

// Finalize the withdrawal with the original withdrawal transaction parameters
async function finalizeWithdrawal(withdrawalTx: {
  nonce: bigint;
  sender: Address;
  target: Address;
  value: bigint;
  gasLimit: bigint;
  data: `0x${string}`;
}) {
  const hash = await l1WalletClient.writeContract({
    address: OPTIMISM_PORTAL,
    abi: portalAbi,
    functionName: "finalizeWithdrawalTransaction",
    args: [withdrawalTx],
  });

  console.log(`Withdrawal finalized: ${hash}`);
  return hash;
}
```

## Using the Optimism SDK

For a higher-level abstraction, use the `@eth-optimism/sdk`:

```bash
npm install @eth-optimism/sdk
```

```typescript
import { CrossChainMessenger, MessageStatus } from "@eth-optimism/sdk";
import { ethers } from "ethers";

const l1Provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
const l2Provider = new ethers.JsonRpcProvider(process.env.OP_MAINNET_RPC);
const l1Signer = new ethers.Wallet(process.env.PRIVATE_KEY!, l1Provider);
const l2Signer = new ethers.Wallet(process.env.PRIVATE_KEY!, l2Provider);

const messenger = new CrossChainMessenger({
  l1ChainId: 1,
  l2ChainId: 10,
  l1SignerOrProvider: l1Signer,
  l2SignerOrProvider: l2Signer,
});

// Check message status
async function checkMessageStatus(l2TxHash: string) {
  const status = await messenger.getMessageStatus(l2TxHash);

  const statusLabels: Record<MessageStatus, string> = {
    [MessageStatus.UNCONFIRMED_L1_TO_L2_MESSAGE]: "L1→L2 message sent, waiting for relay",
    [MessageStatus.FAILED_L1_TO_L2_MESSAGE]: "L1→L2 message failed",
    [MessageStatus.STATE_ROOT_NOT_PUBLISHED]: "Waiting for state root publication",
    [MessageStatus.READY_TO_PROVE]: "Ready to prove on L1",
    [MessageStatus.IN_CHALLENGE_PERIOD]: "In 7-day challenge period",
    [MessageStatus.READY_FOR_RELAY]: "Ready to finalize",
    [MessageStatus.RELAYED]: "Message delivered",
  };

  console.log(`Status: ${statusLabels[status]}`);
  return status;
}
```

## Important Notes

- L1→L2 messages cost gas on both chains. The L1 sender pays L1 gas. The `minGasLimit` parameter determines how much L2 gas is allocated.
- L2→L1 messages require THREE separate L1 transactions: initiate (on L2), prove (on L1), finalize (on L1 after 7 days).
- If the L2 execution of an L1→L2 message reverts, the message can be replayed by calling `relayMessage` on the L2 messenger.
- Always validate the cross-domain sender using `xDomainMessageSender()` — never trust `msg.sender` alone for cross-chain auth.
- The `minGasLimit` on L1→L2 deposits is a minimum — the actual gas used may be higher. Unused gas is NOT refunded to L1.
