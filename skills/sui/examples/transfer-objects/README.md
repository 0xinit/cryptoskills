# Transfer Objects Examples

Working examples for transferring SUI coins and custom objects between addresses using the Sui TypeScript SDK.

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
const senderAddress = keypair.getPublicKey().toSuiAddress();
```

## Transfer SUI

Split from the gas coin and send to a recipient. This is the most common transfer pattern:

```typescript
async function transferSui(
  recipientAddress: string,
  amountMist: bigint
): Promise<string> {
  const tx = new Transaction();

  // Split the desired amount from the gas coin
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);

  // Transfer the split coin to the recipient
  tx.transferObjects([coin], tx.pure.address(recipientAddress));

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showBalanceChanges: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Transfer failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  console.log("Digest:", result.digest);
  console.log("Balance changes:", result.balanceChanges);
  return result.digest;
}

// Transfer 1 SUI (1_000_000_000 MIST)
await transferSui("0xRECIPIENT", 1_000_000_000n);
```

## Transfer Multiple Recipients

Send SUI to multiple recipients in a single transaction using a PTB:

```typescript
interface TransferTarget {
  address: string;
  amountMist: bigint;
}

async function transferToMultiple(
  targets: TransferTarget[]
): Promise<string> {
  if (targets.length === 0) {
    throw new Error("No transfer targets provided");
  }
  if (targets.length > 256) {
    throw new Error("Too many targets; split into multiple transactions");
  }

  const tx = new Transaction();

  const amounts = targets.map((t) => tx.pure.u64(t.amountMist));
  const coins = tx.splitCoins(tx.gas, amounts);

  for (let i = 0; i < targets.length; i++) {
    tx.transferObjects([coins[i]], tx.pure.address(targets[i].address));
  }

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Multi-transfer failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  return result.digest;
}

await transferToMultiple([
  { address: "0xALICE", amountMist: 500_000_000n },
  { address: "0xBOB", amountMist: 1_000_000_000n },
  { address: "0xCHARLIE", amountMist: 250_000_000n },
]);
```

## Transfer a Custom Object

Transfer an owned object (NFT, capability token, etc.) to another address:

```typescript
async function transferObject(
  objectId: string,
  recipientAddress: string
): Promise<string> {
  const tx = new Transaction();

  tx.transferObjects(
    [tx.object(objectId)],
    tx.pure.address(recipientAddress)
  );

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showObjectChanges: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Object transfer failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  return result.digest;
}
```

## Transfer Non-SUI Coin

Transfer a fungible token that is not SUI (e.g., USDC on Sui):

```typescript
async function transferCoin(
  coinType: string,
  recipientAddress: string,
  amountMist: bigint
): Promise<string> {
  // Fetch all coins of the given type owned by sender
  const coins = await client.getCoins({
    owner: senderAddress,
    coinType,
  });

  if (coins.data.length === 0) {
    throw new Error(`No coins of type ${coinType} found`);
  }

  const tx = new Transaction();

  // Merge all coins of this type into one, then split the desired amount
  const coinObjects = coins.data.map((c) => tx.object(c.coinObjectId));

  let primaryCoin = coinObjects[0];
  if (coinObjects.length > 1) {
    tx.mergeCoins(primaryCoin, coinObjects.slice(1));
  }

  const [transferCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(amountMist)]);
  tx.transferObjects([transferCoin], tx.pure.address(recipientAddress));

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showBalanceChanges: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Coin transfer failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  return result.digest;
}

// Example: transfer USDC on Sui
// Replace with actual USDC coin type on mainnet
await transferCoin(
  "0xUSDC_PACKAGE::usdc::USDC",
  "0xRECIPIENT",
  1_000_000n // USDC has 6 decimals
);
```

## Merge Dust Coins

Consolidate many small coin objects into one to reduce storage costs:

```typescript
async function mergeDustCoins(
  coinType: string = "0x2::sui::SUI"
): Promise<string | null> {
  const coins = await client.getCoins({
    owner: senderAddress,
    coinType,
  });

  if (coins.data.length <= 1) {
    console.log("Nothing to merge -- 0 or 1 coins of this type");
    return null;
  }

  const tx = new Transaction();

  const coinObjects = coins.data.map((c) => tx.object(c.coinObjectId));
  tx.mergeCoins(coinObjects[0], coinObjects.slice(1));

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Merge failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  console.log(`Merged ${coins.data.length} coins into 1`);
  return result.digest;
}
```

## Move: Custom Transfer with Events

Move module that emits events on transfer for indexing:

```move
module my_package::transferable_nft {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use std::string::String;

    public struct NFT has key, store {
        id: UID,
        name: String,
    }

    public struct NFTTransferred has copy, drop {
        nft_id: address,
        from: address,
        to: address,
    }

    public entry fun mint(name: String, ctx: &mut TxContext) {
        let nft = NFT {
            id: object::new(ctx),
            name,
        };
        transfer::public_transfer(nft, tx_context::sender(ctx));
    }

    public entry fun send(
        nft: NFT,
        recipient: address,
        ctx: &TxContext,
    ) {
        event::emit(NFTTransferred {
            nft_id: object::uid_to_address(&nft.id),
            from: tx_context::sender(ctx),
            to: recipient,
        });
        transfer::public_transfer(nft, recipient);
    }
}
```

## CLI Transfer

```bash
# Transfer SUI
sui client pay-sui \
  --amounts 1000000000 \
  --recipients 0xRECIPIENT \
  --input-coins 0xCOIN_ID \
  --gas-budget 10000000

# Transfer a custom object
sui client transfer \
  --to 0xRECIPIENT \
  --object-id 0xOBJECT_ID \
  --gas-budget 10000000
```
