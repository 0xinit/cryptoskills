# Create Subgraph Examples

Creating a subgraph from scratch for an ERC-20 token contract. Covers schema design, manifest configuration, and AssemblyScript mapping handlers.

## Project Setup

```bash
# Install graph-cli globally or use npx
npm install -g @graphprotocol/graph-cli

# Initialize from a deployed contract (non-interactive)
graph init --studio my-token-subgraph \
  --protocol ethereum \
  --network mainnet \
  --contract-name USDC \
  --contract-address 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --abi ./abis/ERC20.json \
  --start-block 6082465

cd my-token-subgraph
npm install
```

## Minimal ERC-20 Schema

```graphql
# schema.graphql
type Account @entity {
  id: Bytes!
  balances: [AccountBalance!]! @derivedFrom(field: "account")
  transfersFrom: [Transfer!]! @derivedFrom(field: "from")
  transfersTo: [Transfer!]! @derivedFrom(field: "to")
}

type Token @entity {
  id: Bytes!
  name: String!
  symbol: String!
  decimals: Int!
  totalSupply: BigInt!
  transferCount: BigInt!
}

type AccountBalance @entity {
  id: Bytes!
  account: Account!
  token: Token!
  amount: BigInt!
  lastUpdatedBlock: BigInt!
}

type Transfer @entity(immutable: true) {
  id: Bytes!
  token: Token!
  from: Account!
  to: Account!
  amount: BigInt!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}
```

Key decisions:
- `Transfer` is `immutable: true` because transfers are append-only events -- never modified after creation
- `AccountBalance` tracks per-token balance per account, keyed by `tokenAddress.concat(accountAddress)`
- `@derivedFrom` creates reverse lookups without storing duplicate data

## Manifest

```yaml
# subgraph.yaml
specVersion: 1.2.0
indexerHints:
  prune: auto
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: USDC
    network: mainnet
    source:
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      abi: ERC20
      startBlock: 6082465
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities:
        - Account
        - Token
        - AccountBalance
        - Transfer
      abis:
        - name: ERC20
          file: ./abis/ERC20.json
      eventHandlers:
        - event: Transfer(indexed address,indexed address,uint256)
          handler: handleTransfer
      file: ./src/mapping.ts
```

## AssemblyScript Mapping

```typescript
// src/mapping.ts
import { Transfer as TransferEvent } from "../generated/USDC/ERC20";
import { Account, Token, AccountBalance, Transfer } from "../generated/schema";
import { BigInt, Address } from "@graphprotocol/graph-ts";
import { ERC20 } from "../generated/USDC/ERC20";

const ZERO = BigInt.fromI32(0);
const ONE = BigInt.fromI32(1);
const ZERO_ADDRESS = Address.fromString(
  "0x0000000000000000000000000000000000000000"
);

function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address);
  if (account == null) {
    account = new Account(address);
    account.save();
  }
  return account;
}

function getOrCreateToken(address: Address): Token {
  let token = Token.load(address);
  if (token == null) {
    token = new Token(address);
    let contract = ERC20.bind(address);

    let nameResult = contract.try_name();
    token.name = nameResult.reverted ? "Unknown" : nameResult.value;

    let symbolResult = contract.try_symbol();
    token.symbol = symbolResult.reverted ? "???" : symbolResult.value;

    let decimalsResult = contract.try_decimals();
    token.decimals = decimalsResult.reverted ? 18 : decimalsResult.value;

    token.totalSupply = ZERO;
    token.transferCount = ZERO;
    token.save();
  }
  return token;
}

function getOrCreateBalance(token: Token, account: Account): AccountBalance {
  let id = token.id.concat(account.id);
  let balance = AccountBalance.load(id);
  if (balance == null) {
    balance = new AccountBalance(id);
    balance.account = account.id;
    balance.token = token.id;
    balance.amount = ZERO;
    balance.lastUpdatedBlock = ZERO;
  }
  return balance;
}

export function handleTransfer(event: TransferEvent): void {
  let token = getOrCreateToken(event.address);
  token.transferCount = token.transferCount.plus(ONE);

  let fromAccount = getOrCreateAccount(event.params.from);
  let toAccount = getOrCreateAccount(event.params.to);

  // Track mint (from zero address increases supply)
  if (event.params.from == ZERO_ADDRESS) {
    token.totalSupply = token.totalSupply.plus(event.params.value);
  }

  // Track burn (to zero address decreases supply)
  if (event.params.to == ZERO_ADDRESS) {
    token.totalSupply = token.totalSupply.minus(event.params.value);
  }

  token.save();

  // Update sender balance
  if (event.params.from != ZERO_ADDRESS) {
    let fromBalance = getOrCreateBalance(token, fromAccount);
    fromBalance.amount = fromBalance.amount.minus(event.params.value);
    fromBalance.lastUpdatedBlock = event.block.number;
    fromBalance.save();
  }

  // Update receiver balance
  if (event.params.to != ZERO_ADDRESS) {
    let toBalance = getOrCreateBalance(token, toAccount);
    toBalance.amount = toBalance.amount.plus(event.params.value);
    toBalance.lastUpdatedBlock = event.block.number;
    toBalance.save();
  }

  // Create immutable transfer record
  let transfer = new Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  transfer.token = token.id;
  transfer.from = fromAccount.id;
  transfer.to = toAccount.id;
  transfer.amount = event.params.value;
  transfer.blockNumber = event.block.number;
  transfer.blockTimestamp = event.block.timestamp;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();
}
```

## Build and Verify

```bash
# Generate typed classes from schema and ABIs
graph codegen

# Compile to WebAssembly -- validates all AssemblyScript
graph build
```

Expected output on success:
```
Build completed: build/USDC/USDC.wasm

  Schema: schema.graphql
  Manifest: subgraph.yaml
  Mappings: src/mapping.ts

  Entities: Account, Token, AccountBalance, Transfer
  Data Sources: USDC (mainnet)
```

## Common Mistakes

1. **Forgetting `graph codegen` before build** -- imports from `../generated/` will fail
2. **Using `Array.map()` in mappings** -- AssemblyScript does not support array higher-order functions. Use `for` loops.
3. **Omitting `startBlock`** -- indexer starts from block 0, taking hours to reach relevant events
4. **Not using `try_` for contract reads** -- if the contract reverts (e.g., proxy upgrade), the entire handler fails and indexing halts
5. **String entity IDs for address-derived keys** -- use `Bytes` for address-based IDs to avoid hex encoding overhead
