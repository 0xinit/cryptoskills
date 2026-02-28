# Create a Digital Assets Collection (Token V2)

Create NFT collections and mint tokens using the Aptos Token V2 standard (`aptos_token_objects`). This is the current standard — Token V1 (`aptos_token`) is deprecated.

## Move Module: NFT Collection

```move
module nft_addr::my_nft {
    use std::signer;
    use std::string::{Self, String};
    use std::option;
    use aptos_framework::object::{Self, Object, ConstructorRef, DeleteRef};
    use aptos_token_objects::collection;
    use aptos_token_objects::token;
    use aptos_token_objects::royalty;

    struct CollectionConfig has key {
        /// Number of tokens minted so far
        minted: u64,
        /// Creator address for access control
        creator: address,
    }

    /// Stored at each token's object address for burn capability
    struct TokenMetadata has key {
        burn_ref: token::BurnRef,
        mutator_ref: token::MutatorRef,
    }

    const E_NOT_CREATOR: u64 = 1;
    const E_COLLECTION_NOT_INITIALIZED: u64 = 2;

    const COLLECTION_NAME: vector<u8> = b"My NFT Collection";
    const COLLECTION_DESCRIPTION: vector<u8> = b"A collection of unique digital assets on Aptos";
    const COLLECTION_URI: vector<u8> = b"https://example.com/collection.json";

    /// Create the collection. Call once per creator.
    public entry fun create_collection(creator: &signer) {
        // 5% royalty (numerator=5, denominator=100)
        let royalty_config = royalty::create(5, 100, signer::address_of(creator));

        collection::create_unlimited_collection(
            creator,
            string::utf8(COLLECTION_DESCRIPTION),
            string::utf8(COLLECTION_NAME),
            option::some(royalty_config),
            string::utf8(COLLECTION_URI),
        );

        move_to(creator, CollectionConfig {
            minted: 0,
            creator: signer::address_of(creator),
        });
    }

    /// Create a fixed-supply collection (max 10,000 tokens)
    public entry fun create_fixed_collection(creator: &signer) {
        collection::create_fixed_collection(
            creator,
            string::utf8(COLLECTION_DESCRIPTION),
            10_000, // max supply
            string::utf8(COLLECTION_NAME),
            option::none(), // no royalty
            string::utf8(COLLECTION_URI),
        );

        move_to(creator, CollectionConfig {
            minted: 0,
            creator: signer::address_of(creator),
        });
    }

    /// Mint a new token in the collection
    public entry fun mint(
        creator: &signer,
        token_name: String,
        token_description: String,
        token_uri: String,
    ) acquires CollectionConfig {
        let creator_addr = signer::address_of(creator);
        assert!(exists<CollectionConfig>(creator_addr), E_COLLECTION_NOT_INITIALIZED);

        let config = borrow_global_mut<CollectionConfig>(creator_addr);
        assert!(creator_addr == config.creator, E_NOT_CREATOR);

        let constructor_ref = token::create_named_token(
            creator,
            string::utf8(COLLECTION_NAME),
            token_description,
            token_name,
            option::none(), // inherit collection royalty
            token_uri,
        );

        let token_signer = object::generate_signer(&constructor_ref);
        let burn_ref = token::generate_burn_ref(&constructor_ref);
        let mutator_ref = token::generate_mutator_ref(&constructor_ref);

        move_to(&token_signer, TokenMetadata {
            burn_ref,
            mutator_ref,
        });

        config.minted = config.minted + 1;
    }

    /// Burn a token (only creator can burn)
    public entry fun burn(
        creator: &signer,
        token_obj: Object<TokenMetadata>,
    ) acquires TokenMetadata {
        let creator_addr = signer::address_of(creator);
        assert!(exists<CollectionConfig>(creator_addr), E_NOT_CREATOR);

        let token_addr = object::object_address(&token_obj);
        let TokenMetadata { burn_ref, mutator_ref: _ } = move_from<TokenMetadata>(token_addr);
        token::burn(burn_ref);
    }

    #[view]
    public fun get_minted_count(creator: address): u64 acquires CollectionConfig {
        borrow_global<CollectionConfig>(creator).minted
    }
}
```

## Move.toml

```toml
[package]
name = "my_nft"
version = "0.1.0"

[addresses]
nft_addr = "_"

[dependencies]
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework", rev = "mainnet" }
AptosTokenObjects = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-token-objects", rev = "mainnet" }
```

## TypeScript: Create Collection and Mint

```typescript
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  AccountAddress,
} from "@aptos-labs/ts-sdk";

const MODULE_ADDRESS = process.env.NFT_MODULE_ADDRESS ?? "";

async function createCollection(aptos: Aptos, creator: Account) {
  const transaction = await aptos.transaction.build.simple({
    sender: creator.accountAddress,
    data: {
      function: `${MODULE_ADDRESS}::my_nft::create_collection`,
      functionArguments: [],
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: creator,
    transaction,
  });

  const result = await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  if (!result.success) {
    throw new Error(`Create collection failed: ${result.vm_status}`);
  }

  console.log("Collection created:", result.hash);
  return result;
}

async function mintToken(
  aptos: Aptos,
  creator: Account,
  name: string,
  description: string,
  uri: string
) {
  const transaction = await aptos.transaction.build.simple({
    sender: creator.accountAddress,
    data: {
      function: `${MODULE_ADDRESS}::my_nft::mint`,
      functionArguments: [name, description, uri],
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: creator,
    transaction,
  });

  const result = await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  if (!result.success) {
    throw new Error(`Mint failed: ${result.vm_status}`);
  }

  console.log("Token minted:", result.hash);
  return result;
}

async function main() {
  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);

  const privateKey = new Ed25519PrivateKey(process.env.APTOS_PRIVATE_KEY ?? "");
  const creator = Account.fromPrivateKey({ privateKey });

  await createCollection(aptos, creator);

  await mintToken(
    aptos,
    creator,
    "Token #1",
    "The first token in the collection",
    "https://example.com/tokens/1.json"
  );
}

main().catch(console.error);
```

## Query Tokens via Indexer

```typescript
async function getCollectionTokens(
  collectionAddress: string
): Promise<unknown[]> {
  const query = `
    query GetCollectionTokens($collection_id: String!) {
      current_token_datas_v2(
        where: { collection_id: { _eq: $collection_id } }
        order_by: { token_name: asc }
        limit: 100
      ) {
        token_data_id
        token_name
        token_uri
        description
        current_collection {
          collection_name
          creator_address
        }
      }
    }
  `;

  const response = await fetch(
    "https://indexer.testnet.aptoslabs.com/v1/graphql",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { collection_id: collectionAddress },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Indexer query failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data.current_token_datas_v2;
}

async function getAccountNFTs(ownerAddress: string): Promise<unknown[]> {
  const query = `
    query GetAccountNFTs($owner: String!) {
      current_token_ownerships_v2(
        where: {
          owner_address: { _eq: $owner },
          amount: { _gt: "0" }
        }
      ) {
        token_data_id
        amount
        current_token_data {
          token_name
          token_uri
          collection_id
          current_collection {
            collection_name
          }
        }
      }
    }
  `;

  const response = await fetch(
    "https://indexer.testnet.aptoslabs.com/v1/graphql",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { owner: ownerAddress },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Indexer query failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data.current_token_ownerships_v2;
}
```

## Token V2 vs V1 Differences

| Feature | V1 (deprecated) | V2 (Digital Assets) |
|---------|-----------------|---------------------|
| Module | `aptos_token::token` | `aptos_token_objects::token` |
| Storage | Creator's `TokenStore` | Object at its own address |
| Transfer | Via `TokenStore` operations | `object::transfer` |
| Burn | Requires `BurnCapability` | Via `BurnRef` from constructor |
| Mutability | Mutable by default | Controlled via `MutatorRef` |
| Composability | Limited | Objects can own other objects |
| Royalty | Built into token data | Separate `royalty` module |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `ECOLLECTION_ALREADY_EXISTS` | Collection with same name exists for creator | Use a different collection name per creator |
| `ETOKEN_ALREADY_EXISTS` | Named token already exists | Named tokens are unique per (creator, collection, name) |
| Cannot transfer token | Transfer was disabled at creation | Generate and store `TransferRef` during creation |
| Royalty not enforced | Marketplace must check royalty | Royalty is advisory — marketplaces opt in |
