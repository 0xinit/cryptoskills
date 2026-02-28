// ============================================================
// The Graph Subgraph Starter Template
// ============================================================
//
// This file contains three sections that form a complete subgraph:
// 1. subgraph.yaml (manifest)
// 2. schema.graphql (entity definitions)
// 3. src/mapping.ts (AssemblyScript handlers)
//
// To use: copy each section into its respective file.
// Then run: graph codegen && graph build
//
// ============================================================
// FILE: subgraph.yaml
// ============================================================
//
// specVersion: 1.2.0
// indexerHints:
//   prune: auto
// schema:
//   file: ./schema.graphql
// dataSources:
//   - kind: ethereum
//     name: MyContract
//     network: mainnet
//     source:
//       address: "0xYOUR_CONTRACT_ADDRESS_HERE"
//       abi: MyContract
//       startBlock: 0       # IMPORTANT: set to contract deployment block
//     mapping:
//       kind: ethereum/events
//       apiVersion: 0.0.9
//       language: wasm/assemblyscript
//       entities:
//         - Account
//         - TransferEvent
//         - DailyStat
//       abis:
//         - name: MyContract
//           file: ./abis/MyContract.json
//       eventHandlers:
//         - event: Transfer(indexed address,indexed address,uint256)
//           handler: handleTransfer
//       file: ./src/mapping.ts
//
// ============================================================
// FILE: schema.graphql
// ============================================================
//
// type Account @entity {
//   id: Bytes!
//   balance: BigInt!
//   transferCount: BigInt!
//   lastActivityBlock: BigInt!
// }
//
// type TransferEvent @entity(immutable: true) {
//   id: Bytes!
//   from: Account!
//   to: Account!
//   value: BigInt!
//   blockNumber: BigInt!
//   blockTimestamp: BigInt!
//   transactionHash: Bytes!
// }
//
// type DailyStat @entity {
//   id: Bytes!
//   date: Int!
//   totalVolume: BigInt!
//   transferCount: BigInt!
// }
//
// ============================================================
// FILE: src/mapping.ts (AssemblyScript -- NOT TypeScript)
// ============================================================

import { Transfer as TransferEvent } from "../generated/MyContract/MyContract";
import {
  Account,
  TransferEvent as TransferEventEntity,
  DailyStat,
} from "../generated/schema";
import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts";

const ZERO = BigInt.fromI32(0);
const ONE = BigInt.fromI32(1);
const SECONDS_PER_DAY = 86400;

function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address);
  if (account == null) {
    account = new Account(address);
    account.balance = ZERO;
    account.transferCount = ZERO;
    account.lastActivityBlock = ZERO;
  }
  return account;
}

function getOrCreateDailyStat(timestamp: BigInt): DailyStat {
  let dayId = timestamp.toI32() / SECONDS_PER_DAY;
  let id = Bytes.fromI32(dayId);

  let stat = DailyStat.load(id);
  if (stat == null) {
    stat = new DailyStat(id);
    stat.date = dayId * SECONDS_PER_DAY;
    stat.totalVolume = ZERO;
    stat.transferCount = ZERO;
  }
  return stat;
}

export function handleTransfer(event: TransferEvent): void {
  let from = getOrCreateAccount(event.params.from);
  from.balance = from.balance.minus(event.params.value);
  from.transferCount = from.transferCount.plus(ONE);
  from.lastActivityBlock = event.block.number;
  from.save();

  let to = getOrCreateAccount(event.params.to);
  to.balance = to.balance.plus(event.params.value);
  to.transferCount = to.transferCount.plus(ONE);
  to.lastActivityBlock = event.block.number;
  to.save();

  let transfer = new TransferEventEntity(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  transfer.from = from.id;
  transfer.to = to.id;
  transfer.value = event.params.value;
  transfer.blockNumber = event.block.number;
  transfer.blockTimestamp = event.block.timestamp;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();

  let daily = getOrCreateDailyStat(event.block.timestamp);
  daily.totalVolume = daily.totalVolume.plus(event.params.value);
  daily.transferCount = daily.transferCount.plus(ONE);
  daily.save();
}
