# Programmable Transaction Block (PTB) Batch Examples

Working examples demonstrating Sui's PTB system for composing multiple operations into a single atomic transaction. PTBs are Sui's primary composability mechanism -- they replace the "router contract" pattern used on EVM chains.

## Setup

```typescript
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";

const client = new SuiClient({ url: getFullnodeUrl("testnet") });
const keypair = Ed25519Keypair.fromSecretKey(
  fromBase64(process.env.SUI_PRIVATE_KEY!)
);
```

## PTB Fundamentals

A PTB is a sequence of commands where each command can reference outputs from previous commands. Key constraints:

- Max 1024 commands per PTB
- Max 128 KB transaction size
- All commands execute atomically (all succeed or all revert)
- Objects used as input are locked for the duration

## Split, Call, Transfer in One TX

The most common pattern: split coins, use them in a Move call, transfer results.

```typescript
async function depositAndTransfer(
  packageId: string,
  vaultId: string,
  depositAmount: bigint,
  transferAmount: bigint,
  transferRecipient: string
): Promise<string> {
  const tx = new Transaction();

  // Command 1: Split gas coin into two amounts
  const [depositCoin, transferCoin] = tx.splitCoins(tx.gas, [
    tx.pure.u64(depositAmount),
    tx.pure.u64(transferAmount),
  ]);

  // Command 2: Deposit into a vault (Move call)
  tx.moveCall({
    target: `${packageId}::vault::deposit`,
    arguments: [tx.object(vaultId), depositCoin],
  });

  // Command 3: Transfer remaining coin to another address
  tx.transferObjects([transferCoin], tx.pure.address(transferRecipient));

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showEvents: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `PTB failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  return result.digest;
}
```

## Chain Move Call Results

Use the return value of one Move call as input to another:

```typescript
async function mintAndList(
  nftPackageId: string,
  marketplacePackageId: string,
  kioskId: string,
  kioskCapId: string,
  nftName: string,
  listPrice: bigint
): Promise<string> {
  const tx = new Transaction();

  // Command 1: Mint an NFT (returns the NFT object)
  const [nft] = tx.moveCall({
    target: `${nftPackageId}::nft::mint`,
    arguments: [tx.pure.string(nftName)],
  });

  // Command 2: Place the minted NFT into a Kiosk
  tx.moveCall({
    target: "0x2::kiosk::place",
    arguments: [tx.object(kioskId), tx.object(kioskCapId), nft],
    typeArguments: [`${nftPackageId}::nft::NFT`],
  });

  // Command 3: List the NFT for sale
  tx.moveCall({
    target: "0x2::kiosk::list",
    arguments: [
      tx.object(kioskId),
      tx.object(kioskCapId),
      tx.pure.address(nft), // the NFT ID
      tx.pure.u64(listPrice),
    ],
    typeArguments: [`${nftPackageId}::nft::NFT`],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showObjectChanges: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Mint+List failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  return result.digest;
}
```

## Batch Increment (Same Object, Multiple Calls)

Call the same function multiple times on a shared object in one transaction:

```typescript
async function batchIncrement(
  packageId: string,
  counterId: string,
  times: number
): Promise<string> {
  if (times <= 0 || times > 512) {
    throw new Error("times must be between 1 and 512");
  }

  const tx = new Transaction();

  for (let i = 0; i < times; i++) {
    tx.moveCall({
      target: `${packageId}::counter::increment`,
      arguments: [tx.object(counterId)],
    });
  }

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Batch increment failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  return result.digest;
}
```

## Multi-Recipient Airdrop

Mint and distribute objects to multiple recipients in one transaction:

```typescript
async function airdropNFTs(
  packageId: string,
  recipients: string[],
  nftName: string
): Promise<string> {
  if (recipients.length === 0) {
    throw new Error("No recipients provided");
  }
  if (recipients.length > 256) {
    throw new Error("Too many recipients for a single PTB; batch separately");
  }

  const tx = new Transaction();

  for (const recipient of recipients) {
    const [nft] = tx.moveCall({
      target: `${packageId}::nft::mint`,
      arguments: [tx.pure.string(nftName)],
    });
    tx.transferObjects([nft], tx.pure.address(recipient));
  }

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Airdrop failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  console.log(`Airdropped to ${recipients.length} recipients`);
  return result.digest;
}
```

## Coin Merge + Split Pattern

Consolidate coins and redistribute in precise amounts:

```typescript
async function reorganizeCoins(
  splitAmounts: bigint[]
): Promise<string> {
  const coins = await client.getCoins({
    owner: keypair.getPublicKey().toSuiAddress(),
    coinType: "0x2::sui::SUI",
  });

  if (coins.data.length === 0) {
    throw new Error("No SUI coins found");
  }

  const tx = new Transaction();

  // Merge all non-gas coins into a single coin
  const coinObjects = coins.data.map((c) => tx.object(c.coinObjectId));

  let primaryCoin: ReturnType<typeof tx.object>;
  if (coinObjects.length > 1) {
    primaryCoin = coinObjects[0];
    tx.mergeCoins(primaryCoin, coinObjects.slice(1));
  } else {
    primaryCoin = coinObjects[0];
  }

  // Split into desired amounts
  const amounts = splitAmounts.map((a) => tx.pure.u64(a));
  const splitCoins = tx.splitCoins(primaryCoin, amounts);

  // Transfer each split coin back to self (creates distinct coin objects)
  const selfAddress = keypair.getPublicKey().toSuiAddress();
  for (let i = 0; i < splitAmounts.length; i++) {
    tx.transferObjects([splitCoins[i]], tx.pure.address(selfAddress));
  }

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Reorganize failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  return result.digest;
}
```

## Sponsored PTB

Build a PTB where the gas is paid by a sponsor, not the user:

```typescript
async function sponsoredPTB(
  userKeypair: Ed25519Keypair,
  sponsorKeypair: Ed25519Keypair,
  packageId: string,
  counterId: string
): Promise<string> {
  const userAddress = userKeypair.getPublicKey().toSuiAddress();
  const sponsorAddress = sponsorKeypair.getPublicKey().toSuiAddress();

  const tx = new Transaction();
  tx.setSender(userAddress);
  tx.setGasOwner(sponsorAddress);
  tx.setGasBudget(10_000_000);

  tx.moveCall({
    target: `${packageId}::counter::increment`,
    arguments: [tx.object(counterId)],
  });

  // Build the transaction bytes
  const txBytes = await tx.build({ client });

  // Both parties sign
  const userSig = await userKeypair.signTransaction(txBytes);
  const sponsorSig = await sponsorKeypair.signTransaction(txBytes);

  const result = await client.executeTransaction({
    transaction: txBytes,
    signature: [userSig.signature, sponsorSig.signature],
  });

  return result.digest;
}
```

## Dry Run Before Execution

Simulate a PTB without executing to check effects and gas cost:

```typescript
async function dryRunPTB(tx: Transaction): Promise<void> {
  const txBytes = await tx.build({ client });
  const dryRunResult = await client.dryRunTransactionBlock({
    transactionBlock: txBytes,
  });

  console.log("Status:", dryRunResult.effects.status);
  console.log(
    "Gas used:",
    dryRunResult.effects.gasUsed.computationCost,
    "computation +",
    dryRunResult.effects.gasUsed.storageCost,
    "storage -",
    dryRunResult.effects.gasUsed.storageRebate,
    "rebate"
  );
  console.log("Events:", dryRunResult.events.length);

  if (dryRunResult.effects.status.status !== "success") {
    throw new Error(
      `Dry run failed: ${dryRunResult.effects.status.error ?? "unknown error"}`
    );
  }
}
```

## PTB Limits

| Limit | Value |
|-------|-------|
| Max commands | 1024 |
| Max transaction size | 128 KB |
| Max pure argument size | 16 KB |
| Max type arguments | 16 per command |
| Max arguments per command | 512 |
| Max gas budget | 50 SUI (50_000_000_000 MIST) |
