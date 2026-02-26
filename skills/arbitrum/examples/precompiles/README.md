# Arbitrum ArbOS Precompiles

ArbOS precompiles are system contracts at fixed addresses that expose Arbitrum-specific functionality. They are available on all Arbitrum chains (One, Nova, Sepolia, Orbit L3s).

## ArbSys (0x0000000000000000000000000000000000000064)

Core system functions — L2 block info, ETH withdrawals, L2-to-L1 messaging.

```typescript
import { createPublicClient, http, parseEther } from "viem";
import { arbitrum } from "viem/chains";

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const ARBSYS = "0x0000000000000000000000000000000000000064" as const;

const arbSysAbi = [
  {
    name: "arbBlockNumber",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "arbBlockHash",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "arbBlockNum", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "arbChainID",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "arbOSVersion",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "withdrawEth",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "destination", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
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

// Read the actual L2 block number (NOT block.number, which returns L1 block)
const l2Block = await publicClient.readContract({
  address: ARBSYS,
  abi: arbSysAbi,
  functionName: "arbBlockNumber",
});

const chainId = await publicClient.readContract({
  address: ARBSYS,
  abi: arbSysAbi,
  functionName: "arbChainID",
});

const arbOSVersion = await publicClient.readContract({
  address: ARBSYS,
  abi: arbSysAbi,
  functionName: "arbOSVersion",
});

console.log(`L2 block: ${l2Block}, Chain: ${chainId}, ArbOS: ${arbOSVersion}`);
```

### Solidity Usage

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IArbSys {
    function arbBlockNumber() external view returns (uint256);
    function arbBlockHash(uint256 blockNumber) external view returns (bytes32);
    function arbChainID() external view returns (uint256);
    function withdrawEth(address destination) external payable returns (uint256);
}

contract ArbSysExample {
    IArbSys constant ARBSYS = IArbSys(0x0000000000000000000000000000000000000064);

    function getL2BlockNumber() external view returns (uint256) {
        return ARBSYS.arbBlockNumber();
    }

    function withdrawToL1(address l1Destination) external payable returns (uint256 messageId) {
        // Initiates ETH withdrawal. Must wait 7-day challenge period, then claim on L1.
        messageId = ARBSYS.withdrawEth{value: msg.value}(l1Destination);
    }
}
```

## ArbRetryableTx (0x000000000000000000000000000000000000006E)

Manage retryable tickets (L1-to-L2 messages) that failed auto-execution.

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
    name: "getLifetime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getTimeout",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "ticketId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "keepalive",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "ticketId", type: "bytes32" }],
    outputs: [{ name: "newTimeout", type: "uint256" }],
  },
] as const;

// Default TTL is 7 days (604800 seconds)
const lifetime = await publicClient.readContract({
  address: ARB_RETRYABLE_TX,
  abi: arbRetryableAbi,
  functionName: "getLifetime",
});

// Check if a ticket is still alive
const timeout = await publicClient.readContract({
  address: ARB_RETRYABLE_TX,
  abi: arbRetryableAbi,
  functionName: "getTimeout",
  args: ["0xYourTicketIdHere"],
});

const isExpired = timeout <= BigInt(Math.floor(Date.now() / 1000));
```

## ArbGasInfo (0x000000000000000000000000000000000000006C)

Gas pricing information, especially the L1 data posting cost.

```typescript
const ARBGASINFO = "0x000000000000000000000000000000000000006C" as const;

const arbGasInfoAbi = [
  {
    name: "getPricesInWei",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "perL2Tx", type: "uint256" },
      { name: "perL1CalldataUnit", type: "uint256" },
      { name: "perStorageAlloc", type: "uint256" },
      { name: "perArbGasBase", type: "uint256" },
      { name: "perArbGasCongestion", type: "uint256" },
      { name: "perArbGasTotal", type: "uint256" },
    ],
  },
  {
    name: "getL1BaseFeeEstimate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getL1GasPriceEstimate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getCurrentTxL1GasFees",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const prices = await publicClient.readContract({
  address: ARBGASINFO,
  abi: arbGasInfoAbi,
  functionName: "getPricesInWei",
});

const [perL2Tx, perL1CalldataUnit, perStorageAlloc, perArbGasBase, perArbGasCongestion, perArbGasTotal] = prices;

const l1BaseFee = await publicClient.readContract({
  address: ARBGASINFO,
  abi: arbGasInfoAbi,
  functionName: "getL1BaseFeeEstimate",
});

console.log(`L2 gas price: ${perArbGasTotal} wei`);
console.log(`L1 base fee estimate: ${l1BaseFee} wei`);
console.log(`L1 calldata unit cost: ${perL1CalldataUnit} wei`);
```

## NodeInterface (0x00000000000000000000000000000000000000C8)

Virtual contract for gas estimation — callable only via `eth_call`, not from other contracts.

```typescript
const NODE_INTERFACE = "0x00000000000000000000000000000000000000C8" as const;

const nodeInterfaceAbi = [
  {
    name: "gasEstimateComponents",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "contractCreation", type: "bool" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "gasEstimate", type: "uint64" },
      { name: "gasEstimateForL1", type: "uint64" },
      { name: "baseFee", type: "uint256" },
      { name: "l1BaseFeeEstimate", type: "uint256" },
    ],
  },
  {
    name: "estimateRetryableTicket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sender", type: "address" },
      { name: "deposit", type: "uint256" },
      { name: "to", type: "address" },
      { name: "l2CallValue", type: "uint256" },
      { name: "excessFeeRefundAddress", type: "address" },
      { name: "callValueRefundAddress", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

// Get gas breakdown for a transaction
const { result } = await publicClient.simulateContract({
  address: NODE_INTERFACE,
  abi: nodeInterfaceAbi,
  functionName: "gasEstimateComponents",
  args: [
    "0xTargetContract",
    false,
    "0xEncodedCalldata",
  ],
});

const [totalGas, l1Gas, baseFee, l1BaseFee] = result;
const l2Gas = totalGas - l1Gas;

console.log(`Total gas: ${totalGas}`);
console.log(`L1 data gas: ${l1Gas}`);
console.log(`L2 execution gas: ${l2Gas}`);
console.log(`L2 base fee: ${baseFee} wei`);
console.log(`L1 base fee estimate: ${l1BaseFee} wei`);
```

## Precompile Address Reference

| Precompile | Address | Purpose |
|------------|---------|---------|
| ArbSys | `0x0000000000000000000000000000000000000064` | L2 block info, withdrawals, L2→L1 messaging |
| ArbInfo | `0x0000000000000000000000000000000000000065` | Account balance/code queries |
| ArbAddressTable | `0x0000000000000000000000000000000000000066` | Address compression table |
| ArbosTest | `0x0000000000000000000000000000000000000069` | ArbOS testing utilities |
| ArbOwner | `0x0000000000000000000000000000000000000070` | Chain owner admin functions |
| ArbGasInfo | `0x000000000000000000000000000000000000006C` | Gas pricing information |
| ArbAggregator | `0x000000000000000000000000000000000000006D` | Batch poster configuration |
| ArbRetryableTx | `0x000000000000000000000000000000000000006E` | Retryable ticket management |
| ArbStatistics | `0x000000000000000000000000000000000000006F` | Chain statistics |
| NodeInterface | `0x00000000000000000000000000000000000000C8` | Gas estimation (eth_call only) |
