# Deploy Move Module Examples

Working examples for publishing a Sui Move package using the Sui CLI and the TypeScript SDK.

## Prerequisites

- Sui CLI installed (`cargo install --locked --git https://github.com/MystenLabs/sui.git --branch main sui`)
- A Sui wallet with testnet SUI (`sui client faucet`)
- Node.js 18+ for TypeScript examples
- `@mysten/sui` installed (`npm install @mysten/sui`)

## Move Package Structure

A minimal Move package requires `Move.toml` and a `sources/` directory:

```
my_counter/
  Move.toml
  sources/
    counter.move
```

### Move.toml

```toml
[package]
name = "my_counter"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
my_counter = "0x0"
```

### counter.move

```move
module my_counter::counter {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;

    public struct Counter has key {
        id: UID,
        count: u64,
        owner: address,
    }

    public struct CounterCreated has copy, drop {
        counter_id: address,
        creator: address,
    }

    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let counter = Counter {
            id: object::new(ctx),
            count: 0,
            owner: sender,
        };
        event::emit(CounterCreated {
            counter_id: object::uid_to_address(&counter.id),
            creator: sender,
        });
        transfer::share_object(counter);
    }

    public entry fun increment(counter: &mut Counter) {
        counter.count = counter.count + 1;
    }

    public entry fun reset(counter: &mut Counter, ctx: &TxContext) {
        assert!(counter.owner == tx_context::sender(ctx), 0);
        counter.count = 0;
    }

    public fun value(counter: &Counter): u64 {
        counter.count
    }
}
```

## Deploy via CLI

```bash
cd my_counter

sui move build

sui move test

sui client publish --gas-budget 100000000
```

Expected output includes:

```
----- Transaction Effects ----
Status: Success

----- Object Changes ----
Published Objects:
  PackageID: 0x<PACKAGE_ID>

Created Objects:
  ObjectID: 0x<COUNTER_ID> (shared)
  ObjectType: 0x<PACKAGE_ID>::counter::Counter
```

Save the `PackageID` and `Counter` object ID for subsequent interactions.

## Interact via CLI

```bash
# Increment the counter
sui client call \
  --package 0x<PACKAGE_ID> \
  --module counter \
  --function increment \
  --args 0x<COUNTER_ID> \
  --gas-budget 10000000

# Read the counter object
sui client object 0x<COUNTER_ID> --json
```

## Deploy via TypeScript SDK

```typescript
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { execSync } from "child_process";
import { fromBase64 } from "@mysten/sui/utils";

const client = new SuiClient({ url: getFullnodeUrl("testnet") });
const keypair = Ed25519Keypair.fromSecretKey(
  fromBase64(process.env.SUI_PRIVATE_KEY!)
);

async function publishPackage(packagePath: string): Promise<string> {
  const { modules, dependencies } = JSON.parse(
    execSync(
      `sui move build --dump-bytecode-as-base64 --path ${packagePath}`,
      { encoding: "utf-8" }
    )
  );

  const tx = new Transaction();
  const [upgradeCap] = tx.publish({ modules, dependencies });
  tx.transferObjects(
    [upgradeCap],
    keypair.getPublicKey().toSuiAddress()
  );

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Publish failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  const published = result.objectChanges?.find(
    (change) => change.type === "published"
  );
  if (!published || published.type !== "published") {
    throw new Error("Could not find published package in transaction results");
  }

  console.log("Package ID:", published.packageId);
  console.log("Digest:", result.digest);

  return published.packageId;
}

publishPackage("./my_counter").catch(console.error);
```

## Post-Deploy Interaction (TypeScript)

```typescript
async function incrementCounter(
  packageId: string,
  counterId: string
): Promise<string> {
  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::counter::increment`,
    arguments: [tx.object(counterId)],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Increment failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  return result.digest;
}

async function readCounter(counterId: string): Promise<bigint> {
  const object = await client.getObject({
    id: counterId,
    options: { showContent: true },
  });

  if (object.data?.content?.dataType !== "moveObject") {
    throw new Error("Object is not a Move object");
  }

  const fields = object.data.content.fields as Record<string, string>;
  return BigInt(fields.count);
}
```

## Upgrade Published Package

```typescript
async function upgradePackage(
  packagePath: string,
  currentPackageId: string,
  upgradeCapId: string
): Promise<string> {
  const { modules, dependencies, digest } = JSON.parse(
    execSync(
      `sui move build --dump-bytecode-as-base64 --path ${packagePath}`,
      { encoding: "utf-8" }
    )
  );

  const tx = new Transaction();

  const upgradeTicket = tx.moveCall({
    target: "0x2::package::authorize_upgrade",
    arguments: [
      tx.object(upgradeCapId),
      tx.pure.u8(0), // compatible upgrade policy
      tx.pure(digest),
    ],
  });

  const upgradeReceipt = tx.upgrade({
    modules,
    dependencies,
    package: currentPackageId,
    ticket: upgradeTicket,
  });

  tx.moveCall({
    target: "0x2::package::commit_upgrade",
    arguments: [tx.object(upgradeCapId), upgradeReceipt],
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showObjectChanges: true },
  });

  const upgraded = result.objectChanges?.find(
    (change) => change.type === "published"
  );
  if (!upgraded || upgraded.type !== "published") {
    throw new Error("Could not find upgraded package in transaction results");
  }

  console.log("New Package ID:", upgraded.packageId);
  return upgraded.packageId;
}
```
