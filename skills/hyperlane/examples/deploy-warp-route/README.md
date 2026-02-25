# Deploy a Warp Route

Deploy a Hyperlane Warp Route to bridge an existing ERC-20 token between Ethereum and Arbitrum. The origin chain holds collateral (locked tokens), and the destination chain mints synthetic tokens.

## Architecture

```
Ethereum (Origin)              Arbitrum (Destination)
┌──────────────────────┐       ┌──────────────────────┐
│  HypERC20Collateral  │──────>│      HypERC20        │
│  (locks real USDC)   │       │ (mints synthetic)    │
└──────────────────────┘       └──────────────────────┘
        │                                │
        └── Mailbox ────────────── Mailbox ──┘
```

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  pad,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, arbitrum } from "viem/chains";

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const ethereumClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const ethereumWallet = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const arbitrumWallet = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});
```

## Deploy via Hyperlane CLI (Recommended)

The CLI handles contract deployment, ISM configuration, and enrollment in one step.

### 1. Create Warp Route Config

```yaml
# warp-route-config.yaml
tokens:
  - chainName: ethereum
    type: collateral
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" # USDC
    mailbox: "0xc005dc82818d67AF737725bD4bf75435d065D239"
    name: "Hyperlane Bridged USDC"
    symbol: "hypUSDC"
    decimals: 6

  - chainName: arbitrum
    type: synthetic
    mailbox: "0x979Ca5202784112f4738403dBec5D0F3B9daabB9"
    name: "Hyperlane Bridged USDC"
    symbol: "hypUSDC"
    decimals: 6
```

### 2. Deploy

```bash
hyperlane deploy warp \
  --config warp-route-config.yaml \
  --key $PRIVATE_KEY
```

### 3. Verify Deployment

```bash
# Check collateral contract on Ethereum
cast code <COLLATERAL_ADDRESS> --rpc-url $ETHEREUM_RPC_URL

# Check synthetic contract on Arbitrum
cast code <SYNTHETIC_ADDRESS> --rpc-url $ARBITRUM_RPC_URL

# Verify enrollment — collateral knows about synthetic and vice versa
cast call <COLLATERAL_ADDRESS> \
  "routers(uint32)(bytes32)" 42161 \
  --rpc-url $ETHEREUM_RPC_URL

cast call <SYNTHETIC_ADDRESS> \
  "routers(uint32)(bytes32)" 1 \
  --rpc-url $ARBITRUM_RPC_URL
```

## Transfer Tokens via the Deployed Warp Route

```typescript
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const WARP_COLLATERAL: Address = "0xYourDeployedCollateralContract";
const ARBITRUM_DOMAIN = 42161;

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const warpRouteAbi = parseAbi([
  "function transferRemote(uint32 _destination, bytes32 _recipient, uint256 _amountOrId) payable returns (bytes32 messageId)",
  "function quoteGasPayment(uint32 _destinationDomain) view returns (uint256)",
]);

async function bridgeTokens(
  amount: bigint,
  recipient: Address
): Promise<{ hash: `0x${string}`; messageId: `0x${string}` }> {
  // Check and set approval
  const allowance = await ethereumClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, WARP_COLLATERAL],
  });

  if (allowance < amount) {
    const { request: approveReq } = await ethereumClient.simulateContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [WARP_COLLATERAL, amount],
      account: account.address,
    });
    const approveHash = await ethereumWallet.writeContract(approveReq);
    const approveReceipt = await ethereumClient.waitForTransactionReceipt({
      hash: approveHash,
    });
    if (approveReceipt.status !== "success") {
      throw new Error("Token approval reverted");
    }
  }

  // Quote interchain gas
  const gasFee = await ethereumClient.readContract({
    address: WARP_COLLATERAL,
    abi: warpRouteAbi,
    functionName: "quoteGasPayment",
    args: [ARBITRUM_DOMAIN],
  });

  // Execute transfer
  const recipientBytes32 = pad(recipient, { size: 32 });

  const { request, result } = await ethereumClient.simulateContract({
    address: WARP_COLLATERAL,
    abi: warpRouteAbi,
    functionName: "transferRemote",
    args: [ARBITRUM_DOMAIN, recipientBytes32, amount],
    value: gasFee,
    account: account.address,
  });

  const hash = await ethereumWallet.writeContract(request);
  const receipt = await ethereumClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transfer reverted");

  return { hash, messageId: result };
}
```

## Bridge Back (Synthetic to Collateral)

Bridging back burns the synthetic token on Arbitrum and unlocks the collateral on Ethereum.

```typescript
const WARP_SYNTHETIC: Address = "0xYourDeployedSyntheticContract";
const ETHEREUM_DOMAIN = 1;

async function bridgeBack(
  amount: bigint,
  recipient: Address
): Promise<{ hash: `0x${string}`; messageId: `0x${string}` }> {
  // Synthetic tokens are burned directly — no approval needed for the Warp Route
  // (the Warp Route IS the token contract for synthetics)

  const gasFee = await arbitrumClient.readContract({
    address: WARP_SYNTHETIC,
    abi: warpRouteAbi,
    functionName: "quoteGasPayment",
    args: [ETHEREUM_DOMAIN],
  });

  const recipientBytes32 = pad(recipient, { size: 32 });

  const { request, result } = await arbitrumClient.simulateContract({
    address: WARP_SYNTHETIC,
    abi: warpRouteAbi,
    functionName: "transferRemote",
    args: [ETHEREUM_DOMAIN, recipientBytes32, amount],
    value: gasFee,
    account: account.address,
  });

  const hash = await arbitrumWallet.writeContract(request);
  const receipt = await arbitrumClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Bridge-back reverted");

  return { hash, messageId: result };
}
```

## Complete Usage

```typescript
async function main() {
  const amount = 1000_000000n; // 1000 USDC (6 decimals)

  // Bridge Ethereum -> Arbitrum
  const { hash, messageId } = await bridgeTokens(amount, account.address);
  console.log(`Bridged 1000 USDC to Arbitrum`);
  console.log(`Ethereum tx: ${hash}`);
  console.log(`Message ID: ${messageId}`);
  console.log(
    `Track: https://explorer.hyperlane.xyz/message/${messageId}`
  );
}

main().catch(console.error);
```
