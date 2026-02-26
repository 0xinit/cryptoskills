# Arbitrum Token Bridge

## Overview

Arbitrum's token bridge uses a gateway system. The **Gateway Router** routes bridge requests to the correct gateway based on the token:

- **Standard Gateway**: Default for most ERC20 tokens
- **WETH Gateway**: Handles WETH unwrap on L1, wrap on L2
- **Custom Gateway**: For tokens with special bridging logic (e.g., USDC with Circle's CCTP)

## Bridging ETH (L1 to L2)

ETH bridging uses the Inbox contract directly. ETH arrives on L2 at the same address within ~10 minutes.

```typescript
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { mainnet, arbitrum } from "viem/chains";
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
    name: "depositEth",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const { request } = await l1PublicClient.simulateContract({
  address: INBOX,
  abi: inboxAbi,
  functionName: "depositEth",
  value: parseEther("0.1"),
  account: account.address,
});

const hash = await l1WalletClient.writeContract(request);
const receipt = await l1PublicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("ETH deposit failed");
console.log(`ETH deposited. L1 tx: ${hash}`);
```

## Bridging ETH (L2 to L1)

ETH withdrawals use the ArbSys precompile. After the 7-day challenge period, claim on L1 via the Outbox.

```typescript
const ARBSYS = "0x0000000000000000000000000000000000000064" as const;

const arbSysAbi = [
  {
    name: "withdrawEth",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "destination", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const l2PublicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const l2WalletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const { request } = await l2PublicClient.simulateContract({
  address: ARBSYS,
  abi: arbSysAbi,
  functionName: "withdrawEth",
  args: [account.address],
  value: parseEther("0.1"),
  account: account.address,
});

const hash = await l2WalletClient.writeContract(request);
console.log(`ETH withdrawal initiated. L2 tx: ${hash}`);
console.log("Wait ~7 days, then execute on L1 via Outbox contract.");
```

## Bridging ERC20 (L1 to L2)

### Step 1: Look Up the Gateway

```typescript
const GATEWAY_ROUTER_L1 = "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef" as const;

const gatewayRouterAbi = [
  {
    name: "getGateway",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_token", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "outboundTransfer",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_token", type: "address" },
      { name: "_to", type: "address" },
      { name: "_amount", type: "uint256" },
      { name: "_maxGas", type: "uint256" },
      { name: "_gasPriceBid", type: "uint256" },
      { name: "_data", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
] as const;

const USDC_L1 = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

const gateway = await l1PublicClient.readContract({
  address: GATEWAY_ROUTER_L1,
  abi: gatewayRouterAbi,
  functionName: "getGateway",
  args: [USDC_L1],
});

console.log(`Gateway for USDC: ${gateway}`);
```

### Step 2: Approve the Gateway

Tokens must be approved to the **gateway** (not the router).

```typescript
const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const bridgeAmount = 1000_000000n; // 1000 USDC (6 decimals)

const { request: approveRequest } = await l1PublicClient.simulateContract({
  address: USDC_L1,
  abi: erc20Abi,
  functionName: "approve",
  args: [gateway, bridgeAmount],
  account: account.address,
});

const approveHash = await l1WalletClient.writeContract(approveRequest);
await l1PublicClient.waitForTransactionReceipt({ hash: approveHash });
```

### Step 3: Bridge via Gateway Router

```typescript
import { encodeAbiParameters, parseAbiParameters, parseEther } from "viem";

const maxSubmissionCost = parseEther("0.001");
const gasLimit = 300_000n;
const gasPriceBid = 100_000_000n; // 0.1 gwei

// Encode the extra data: maxSubmissionCost + caller-specific data
const extraData = encodeAbiParameters(
  parseAbiParameters("uint256, bytes"),
  [maxSubmissionCost, "0x"]
);

// msg.value must cover: maxSubmissionCost + (gasLimit * gasPriceBid)
const totalValue = maxSubmissionCost + gasLimit * gasPriceBid;

const { request } = await l1PublicClient.simulateContract({
  address: GATEWAY_ROUTER_L1,
  abi: gatewayRouterAbi,
  functionName: "outboundTransfer",
  args: [
    USDC_L1,
    account.address,
    bridgeAmount,
    gasLimit,
    gasPriceBid,
    extraData,
  ],
  value: totalValue,
  account: account.address,
});

const hash = await l1WalletClient.writeContract(request);
console.log(`ERC20 bridge tx: ${hash}`);
console.log("Token should arrive on L2 within ~10 minutes.");
```

## Bridging ERC20 (L2 to L1)

### Initiate Withdrawal on L2

```typescript
const GATEWAY_ROUTER_L2 = "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933" as const;

const l2GatewayRouterAbi = [
  {
    name: "outboundTransfer",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_l1Token", type: "address" },
      { name: "_to", type: "address" },
      { name: "_amount", type: "uint256" },
      { name: "_data", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
] as const;

// Withdraw 1000 USDC from L2 to L1
// Note: use the L1 token address as the identifier
const { request } = await l2PublicClient.simulateContract({
  address: GATEWAY_ROUTER_L2,
  abi: l2GatewayRouterAbi,
  functionName: "outboundTransfer",
  args: [
    USDC_L1,           // L1 token address
    account.address,   // L1 recipient
    1000_000000n,      // amount
    "0x",              // no extra data
  ],
  account: account.address,
});

const hash = await l2WalletClient.writeContract(request);
console.log(`Withdrawal initiated. L2 tx: ${hash}`);
console.log("Wait ~7 days challenge period, then claim on L1 via Outbox.");
```

## Claiming Withdrawal on L1 (After Challenge Period)

After the 7-day challenge period, execute the withdrawal on L1 using the Outbox.

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

// Use the Arbitrum SDK to fetch the outbox proof:
// npm install @arbitrum/sdk
// The SDK provides helpers to get proof data from the NodeInterface
```

## Custom Gateway Registration

Tokens with special bridging logic (e.g., rebasing tokens, fee-on-transfer) need a custom gateway.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Register a custom gateway for your token on the L1 Gateway Router
/// @dev Only the token contract owner can register a custom gateway
interface IL1GatewayRouter {
    function setGateway(
        address _gateway,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        uint256 _maxSubmissionCost
    ) external payable returns (uint256);
}
```

## Gateway Contract Addresses

| Contract | L1 Address | L2 Address |
|----------|-----------|-----------|
| Gateway Router | `0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef` | `0x5288c571Fd7aD117beA99bF60FE0846C4E84F933` |
| Standard Gateway | `0xa3A7B6F88361F48403514059F1F16C8E78d60EeC` | `0x09e9222E96E7B4AE2a407B98d48e330053351EEe` |
| WETH Gateway | `0xd92023E9d9911199a6711321D1277285e6d4e2db` | `0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B` |
| Inbox | `0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f` | N/A |
| Outbox | `0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840` | N/A |
