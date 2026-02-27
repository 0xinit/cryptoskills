# Bridging on zkSync Era

zkSync Era uses a canonical bridge for moving assets between L1 (Ethereum) and L2 (zkSync Era). The `zksync-ethers` SDK provides high-level methods for deposits, withdrawals, and message passing.

## Setup

```typescript
import { Provider, Wallet } from "zksync-ethers";
import { ethers } from "ethers";

// L1 provider (Ethereum)
const l1Provider = ethers.getDefaultProvider("mainnet");

// L2 provider (zkSync Era)
const l2Provider = new Provider("https://mainnet.era.zksync.io");

// Wallet connected to both L1 and L2
const wallet = new Wallet(
  process.env.PRIVATE_KEY!,
  l2Provider,  // L2 provider
  l1Provider   // L1 provider
);
```

## L1 to L2: ETH Deposit

Deposits take approximately 1-3 minutes to appear on L2.

```typescript
async function depositETH(amount: string) {
  const depositTx = await wallet.deposit({
    token: ethers.ZeroAddress, // ETH
    amount: ethers.parseEther(amount),
  });

  console.log(`L1 deposit tx: ${depositTx.hash}`);
  console.log("Waiting for L2 confirmation...");

  const l2Receipt = await depositTx.waitFinalize();
  console.log(`Deposit confirmed on L2: ${l2Receipt.transactionHash}`);
  return l2Receipt;
}

await depositETH("0.1");
```

## L1 to L2: ERC20 Deposit

The SDK handles ERC-20 approval automatically when `approveERC20: true` is set.

```typescript
async function depositERC20(tokenL1Address: string, amount: bigint) {
  const depositTx = await wallet.deposit({
    token: tokenL1Address,
    amount,
    approveERC20: true, // auto-approve the bridge to spend tokens
  });

  console.log(`L1 deposit tx: ${depositTx.hash}`);

  const l2Receipt = await depositTx.waitFinalize();
  console.log(`ERC20 deposit confirmed on L2: ${l2Receipt.transactionHash}`);
  return l2Receipt;
}

// Deposit 100 USDC (6 decimals)
const USDC_L1 = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
await depositERC20(USDC_L1, 100_000_000n);
```

## L2 to L1: ETH Withdrawal

Withdrawals require a ZK proof to be generated and verified on L1. This can take several hours.

```typescript
async function withdrawETH(amount: string) {
  const withdrawTx = await wallet.withdraw({
    token: ethers.ZeroAddress,
    amount: ethers.parseEther(amount),
    to: wallet.address, // L1 recipient
  });

  console.log(`L2 withdrawal tx: ${withdrawTx.hash}`);

  const receipt = await withdrawTx.waitFinalize();
  console.log(`Withdrawal initiated: ${receipt.transactionHash}`);
  console.log("Withdrawal must be finalized on L1 after proof verification");
  return receipt;
}

await withdrawETH("0.05");
```

## L2 to L1: ERC20 Withdrawal

```typescript
async function withdrawERC20(tokenL2Address: string, amount: bigint) {
  const withdrawTx = await wallet.withdraw({
    token: tokenL2Address,
    amount,
    to: wallet.address,
  });

  const receipt = await withdrawTx.waitFinalize();
  console.log(`ERC20 withdrawal initiated: ${receipt.transactionHash}`);
  return receipt;
}
```

## Finalizing Withdrawals on L1

After the ZK proof is submitted and verified on L1 (can take hours), the withdrawal must be claimed.

```typescript
async function finalizeWithdrawal(l2TxHash: string) {
  // Check if the withdrawal is ready to finalize
  const isFinalized = await wallet.isWithdrawalFinalized(l2TxHash);

  if (!isFinalized) {
    console.log("Withdrawal not yet finalized. ZK proof still pending.");
    return null;
  }

  // Finalize on L1
  const finalizeTx = await wallet.finalizeWithdrawal(l2TxHash);
  const receipt = await finalizeTx.wait();
  console.log(`Withdrawal finalized on L1: ${receipt?.hash}`);
  return receipt;
}
```

### Polling for Finalization

```typescript
async function waitForFinalization(l2TxHash: string, pollIntervalMs = 60_000) {
  console.log("Waiting for ZK proof verification on L1...");

  while (true) {
    const isFinalized = await wallet.isWithdrawalFinalized(l2TxHash);
    if (isFinalized) {
      console.log("Withdrawal ready to finalize");
      return finalizeWithdrawal(l2TxHash);
    }
    console.log("Not ready yet, checking again...");
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
```

## L2 to L1 Messaging (Arbitrary Data)

Send arbitrary messages from L2 to L1 using the `L1Messenger` system contract.

### L2 Side (Solidity)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@matterlabs/zk-contracts/l2/system-contracts/Constants.sol";
import "@matterlabs/zk-contracts/l2/system-contracts/interfaces/IL1Messenger.sol";

contract L2Messenger {
    event MessageSent(bytes message);

    function sendMessageToL1(bytes calldata message) external {
        IL1Messenger(L1_MESSENGER_SYSTEM_CONTRACT).sendToL1(message);
        emit MessageSent(message);
    }
}
```

### L1 Side (Verifying Messages)

L1 contracts can verify L2 messages using the Mailbox on L1.

```typescript
import { Provider } from "zksync-ethers";

// Get the L2->L1 message proof
const l2Provider = new Provider("https://mainnet.era.zksync.io");
const proof = await l2Provider.getMessageProof(
  blockNumber,  // L2 block where the message was sent
  senderAddress, // L2 contract that sent the message
  ethers.keccak256(message) // hash of the message
);
```

## Withdrawal Timeline

| Step | Duration |
|------|----------|
| L2 transaction confirmation | ~1-2 seconds |
| Batch commitment to L1 | ~minutes |
| ZK proof generation | ~1-3 hours |
| L1 proof verification | ~minutes |
| Finalization (manual claim) | 1 L1 transaction |

## Troubleshooting

- **Deposit not appearing on L2**: Wait 1-3 minutes. Check the L1 tx on Etherscan to confirm it succeeded.
- **Withdrawal stuck**: ZK proof generation takes hours. Use `isWithdrawalFinalized` to check status.
- **"Insufficient allowance"**: For ERC-20 deposits, set `approveERC20: true` or manually approve the bridge contract.
- **Wrong token address**: L1 and L2 token addresses differ. Use `l2TokenAddress` method to get the L2 address of an L1 token.

```typescript
// Get the L2 address for an L1 token
const l2TokenAddress = await l2Provider.l2TokenAddress(l1TokenAddress);
```
