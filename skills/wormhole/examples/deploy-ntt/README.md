# Deploy NTT for an ERC-20 Token Across Two Chains

Working example: deploy NTT (Native Token Transfers) for an existing ERC-20 token across Ethereum and Arbitrum. Includes NttManager deployment, Transceiver setup, and peer registration.

## Prerequisites

- An ERC-20 token deployed on both chains with `mint` and `burn` capabilities
- The token's `mint` function must be callable by the NttManager (set after deployment)
- Foundry installed for contract deployment

## Architecture

```
Ethereum                              Arbitrum
┌──────────┐                          ┌──────────┐
│  MyToken  │                          │  MyToken  │
│  (burn)   │                          │  (mint)   │
└─────┬─────┘                          └─────▲─────┘
      │                                      │
┌─────▼──────────┐                    ┌──────┴─────────┐
│  NttManager     │ ──── VAA ────>    │  NttManager     │
│  (Ethereum)     │                    │  (Arbitrum)     │
└─────┬──────────┘                    └──────▲─────────┘
      │                                      │
┌─────▼──────────┐                    ┌──────┴─────────┐
│  WormholeXcvr   │                    │  WormholeXcvr   │
│  (Transceiver)  │                    │  (Transceiver)  │
└────────────────┘                    └────────────────┘
```

## Step 1: Deploy NTT-Compatible Token

If you already have tokens deployed, skip to the minter configuration step. Otherwise, deploy this contract on both chains.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

error CallerNotMinter(address caller);

/// @title NTT-compatible ERC-20 token
/// @notice Token with mint/burn controlled by NttManager for cross-chain transfers
contract MyToken is ERC20, ERC20Burnable, Ownable {
    address public minter;

    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    constructor(address initialOwner) ERC20("MyToken", "MTK") Ownable(initialOwner) {
        _mint(initialOwner, 1_000_000 * 10 ** decimals());
    }

    /// @notice Update the minter address (NttManager)
    /// @param newMinter Address authorized to mint
    function setMinter(address newMinter) external onlyOwner {
        address old = minter;
        minter = newMinter;
        emit MinterUpdated(old, newMinter);
    }

    /// @notice Mint tokens -- restricted to NttManager
    /// @param to Recipient
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert CallerNotMinter(msg.sender);
        _mint(to, amount);
    }
}
```

Deploy on both chains:

```bash
# Ethereum
forge create src/MyToken.sol:MyToken \
  --rpc-url $ETH_RPC_URL \
  --private-key $PRIVATE_KEY \
  --constructor-args $DEPLOYER_ADDRESS \
  --verify --etherscan-api-key $ETHERSCAN_API_KEY

# Arbitrum
forge create src/MyToken.sol:MyToken \
  --rpc-url $ARB_RPC_URL \
  --private-key $PRIVATE_KEY \
  --constructor-args $DEPLOYER_ADDRESS \
  --verify --etherscan-api-key $ARBISCAN_API_KEY
```

## Step 2: Deploy NttManager and Transceiver

Use the Wormhole NTT CLI for streamlined deployment, or deploy contracts manually.

### Using NTT CLI

```bash
npm install -g @wormhole-foundation/ntt-cli

# Initialize NTT config
ntt init

# Add chains
ntt add-chain ethereum \
  --token $ETH_TOKEN_ADDRESS \
  --mode burning \
  --rpc $ETH_RPC_URL

ntt add-chain arbitrum \
  --token $ARB_TOKEN_ADDRESS \
  --mode burning \
  --rpc $ARB_RPC_URL

# Deploy
ntt deploy --private-key $PRIVATE_KEY
```

### Manual Deployment (TypeScript)

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, arbitrum } from "viem/chains";

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const ethClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const ethWallet = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const arbClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARB_RPC_URL),
});

const arbWallet = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(process.env.ARB_RPC_URL),
});

// Deployed addresses (fill after deployment)
const ETH_TOKEN = "0x..." as Address;
const ARB_TOKEN = "0x..." as Address;
const ETH_NTT_MANAGER = "0x..." as Address;
const ARB_NTT_MANAGER = "0x..." as Address;
const ETH_TRANSCEIVER = "0x..." as Address;
const ARB_TRANSCEIVER = "0x..." as Address;

const WORMHOLE_ETHEREUM_CHAIN_ID = 2;
const WORMHOLE_ARBITRUM_CHAIN_ID = 23;
```

## Step 3: Configure Peers

After deploying NttManager on both chains, register each as a peer of the other.

```typescript
function evmAddressToBytes32(address: Address): `0x${string}` {
  return `0x000000000000000000000000${address.slice(2)}` as `0x${string}`;
}

const nttManagerAbi = [
  {
    name: "setPeer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "peerChainId", type: "uint16" },
      { name: "peerContract", type: "bytes32" },
      { name: "decimals", type: "uint8" },
      { name: "inboundLimit", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "setTransceiver",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "transceiver", type: "address" }],
    outputs: [],
  },
  {
    name: "setOutboundLimit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "limit", type: "uint256" }],
    outputs: [],
  },
] as const;

// 1M token rate limit (adjust based on your token's supply and risk tolerance)
const RATE_LIMIT = 1_000_000_000000000000000000n; // 1M tokens with 18 decimals

async function configurePeers() {
  // --- Ethereum side ---
  // Register Arbitrum NttManager as peer
  const { request: ethPeerReq } = await ethClient.simulateContract({
    address: ETH_NTT_MANAGER,
    abi: nttManagerAbi,
    functionName: "setPeer",
    args: [
      WORMHOLE_ARBITRUM_CHAIN_ID,
      evmAddressToBytes32(ARB_NTT_MANAGER),
      18,
      RATE_LIMIT,
    ],
    account: account.address,
  });
  const ethPeerHash = await ethWallet.writeContract(ethPeerReq);
  const ethPeerReceipt = await ethClient.waitForTransactionReceipt({ hash: ethPeerHash });
  if (ethPeerReceipt.status !== "success") throw new Error("setPeer on Ethereum failed");

  // Register transceiver on Ethereum NttManager
  const { request: ethXcvrReq } = await ethClient.simulateContract({
    address: ETH_NTT_MANAGER,
    abi: nttManagerAbi,
    functionName: "setTransceiver",
    args: [ETH_TRANSCEIVER],
    account: account.address,
  });
  const ethXcvrHash = await ethWallet.writeContract(ethXcvrReq);
  const ethXcvrReceipt = await ethClient.waitForTransactionReceipt({ hash: ethXcvrHash });
  if (ethXcvrReceipt.status !== "success") throw new Error("setTransceiver on Ethereum failed");

  // Set outbound rate limit on Ethereum
  const { request: ethLimitReq } = await ethClient.simulateContract({
    address: ETH_NTT_MANAGER,
    abi: nttManagerAbi,
    functionName: "setOutboundLimit",
    args: [RATE_LIMIT],
    account: account.address,
  });
  const ethLimitHash = await ethWallet.writeContract(ethLimitReq);
  const ethLimitReceipt = await ethClient.waitForTransactionReceipt({ hash: ethLimitHash });
  if (ethLimitReceipt.status !== "success") throw new Error("setOutboundLimit on Ethereum failed");

  // --- Arbitrum side ---
  // Register Ethereum NttManager as peer
  const { request: arbPeerReq } = await arbClient.simulateContract({
    address: ARB_NTT_MANAGER,
    abi: nttManagerAbi,
    functionName: "setPeer",
    args: [
      WORMHOLE_ETHEREUM_CHAIN_ID,
      evmAddressToBytes32(ETH_NTT_MANAGER),
      18,
      RATE_LIMIT,
    ],
    account: account.address,
  });
  const arbPeerHash = await arbWallet.writeContract(arbPeerReq);
  const arbPeerReceipt = await arbClient.waitForTransactionReceipt({ hash: arbPeerHash });
  if (arbPeerReceipt.status !== "success") throw new Error("setPeer on Arbitrum failed");

  // Register transceiver on Arbitrum NttManager
  const { request: arbXcvrReq } = await arbClient.simulateContract({
    address: ARB_NTT_MANAGER,
    abi: nttManagerAbi,
    functionName: "setTransceiver",
    args: [ARB_TRANSCEIVER],
    account: account.address,
  });
  const arbXcvrHash = await arbWallet.writeContract(arbXcvrReq);
  const arbXcvrReceipt = await arbClient.waitForTransactionReceipt({ hash: arbXcvrHash });
  if (arbXcvrReceipt.status !== "success") throw new Error("setTransceiver on Arbitrum failed");

  // Set outbound rate limit on Arbitrum
  const { request: arbLimitReq } = await arbClient.simulateContract({
    address: ARB_NTT_MANAGER,
    abi: nttManagerAbi,
    functionName: "setOutboundLimit",
    args: [RATE_LIMIT],
    account: account.address,
  });
  const arbLimitHash = await arbWallet.writeContract(arbLimitReq);
  const arbLimitReceipt = await arbClient.waitForTransactionReceipt({ hash: arbLimitHash });
  if (arbLimitReceipt.status !== "success") throw new Error("setOutboundLimit on Arbitrum failed");

  console.log("Peers configured successfully on both chains");
}
```

## Step 4: Set NttManager as Token Minter

```typescript
const tokenAbi = [
  {
    name: "setMinter",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newMinter", type: "address" }],
    outputs: [],
  },
] as const;

async function setMinters() {
  // Set NttManager as minter on Ethereum token
  const { request: ethMintReq } = await ethClient.simulateContract({
    address: ETH_TOKEN,
    abi: tokenAbi,
    functionName: "setMinter",
    args: [ETH_NTT_MANAGER],
    account: account.address,
  });
  const ethMintHash = await ethWallet.writeContract(ethMintReq);
  const ethMintReceipt = await ethClient.waitForTransactionReceipt({ hash: ethMintHash });
  if (ethMintReceipt.status !== "success") throw new Error("setMinter on Ethereum failed");

  // Set NttManager as minter on Arbitrum token
  const { request: arbMintReq } = await arbClient.simulateContract({
    address: ARB_TOKEN,
    abi: tokenAbi,
    functionName: "setMinter",
    args: [ARB_NTT_MANAGER],
    account: account.address,
  });
  const arbMintHash = await arbWallet.writeContract(arbMintReq);
  const arbMintReceipt = await arbClient.waitForTransactionReceipt({ hash: arbMintHash });
  if (arbMintReceipt.status !== "success") throw new Error("setMinter on Arbitrum failed");

  console.log("NttManagers set as minters on both chains");
}
```

## Step 5: Test Transfer

```typescript
async function testTransfer() {
  const amount = 100_000000000000000000n; // 100 tokens (18 decimals)

  // Approve NttManager on Ethereum
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

  const { request: approveReq } = await ethClient.simulateContract({
    address: ETH_TOKEN,
    abi: erc20Abi,
    functionName: "approve",
    args: [ETH_NTT_MANAGER, amount],
    account: account.address,
  });
  const approveHash = await ethWallet.writeContract(approveReq);
  const approveReceipt = await ethClient.waitForTransactionReceipt({ hash: approveHash });
  if (approveReceipt.status !== "success") throw new Error("Approval failed");

  // Transfer via NTT (Ethereum -> Arbitrum)
  const nttTransferAbi = [
    {
      name: "transfer",
      type: "function",
      stateMutability: "payable",
      inputs: [
        { name: "amount", type: "uint256" },
        { name: "recipientChain", type: "uint16" },
        { name: "recipient", type: "bytes32" },
      ],
      outputs: [{ name: "messageSequence", type: "uint64" }],
    },
  ] as const;

  const recipientBytes32 = evmAddressToBytes32(account.address);

  const { request: transferReq } = await ethClient.simulateContract({
    address: ETH_NTT_MANAGER,
    abi: nttTransferAbi,
    functionName: "transfer",
    args: [amount, WORMHOLE_ARBITRUM_CHAIN_ID, recipientBytes32],
    value: 0n,
    account: account.address,
  });

  const transferHash = await ethWallet.writeContract(transferReq);
  const transferReceipt = await ethClient.waitForTransactionReceipt({ hash: transferHash });
  if (transferReceipt.status !== "success") throw new Error("NTT transfer failed");

  console.log(`Transfer initiated: ${transferHash}`);
  console.log("Tokens will be minted on Arbitrum after Guardian attestation");
}
```

## Complete Deployment Script

```typescript
async function main() {
  console.log("Step 1: Deploying tokens... (use forge create or deploy separately)");

  console.log("Step 2: Deploy NttManager + Transceiver... (use NTT CLI or forge)");

  console.log("Step 3: Configuring peers...");
  await configurePeers();

  console.log("Step 4: Setting NttManager as minter...");
  await setMinters();

  console.log("Step 5: Testing transfer...");
  await testTransfer();

  console.log("NTT deployment complete");
}

main().catch(console.error);
```

## Verification Checklist

- [ ] Token deployed on both chains with matching decimals
- [ ] NttManager deployed on both chains
- [ ] Transceiver deployed and registered on both NttManagers
- [ ] Peers set bidirectionally (Ethereum knows Arbitrum, Arbitrum knows Ethereum)
- [ ] Rate limits configured (both inbound and outbound)
- [ ] NttManager set as minter on the token contract (both chains)
- [ ] Test transfer completes end-to-end
- [ ] Contracts verified on block explorers
