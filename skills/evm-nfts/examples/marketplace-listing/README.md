# NFT Marketplace Listing with Seaport 1.6

Complete TypeScript example for listing an ERC-721 NFT on Seaport 1.6, creating a signed order, and fulfilling it.

## Dependencies

```bash
npm install viem @opensea/seaport-js
```

## Approve Seaport

Before listing, the NFT owner must approve Seaport as an operator. This is a one-time operation per collection.

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const SEAPORT_ADDRESS = "0x0000000000000068F116A894984e2DB1123eB395" as const;

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const nftAbi = [
  {
    type: "function",
    name: "setApprovalForAll",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isApprovedForAll",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
] as const;

async function approveSeaport(nftAddress: Address) {
  const isApproved = await publicClient.readContract({
    address: nftAddress,
    abi: nftAbi,
    functionName: "isApprovedForAll",
    args: [account.address, SEAPORT_ADDRESS],
  });

  if (!isApproved) {
    const hash = await walletClient.writeContract({
      address: nftAddress,
      abi: nftAbi,
      functionName: "setApprovalForAll",
      args: [SEAPORT_ADDRESS, true],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      throw new Error("Approval transaction reverted");
    }
  }
}
```

## Create Listing with Seaport SDK

```typescript
import { Seaport } from "@opensea/seaport-js";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(
  process.env.PRIVATE_KEY as string,
  provider
);

const seaport = new Seaport(signer);

async function createListing(
  nftAddress: Address,
  tokenId: bigint,
  priceEth: string,
  durationSeconds: number
) {
  const now = Math.floor(Date.now() / 1000);

  const { executeAllActions } = await seaport.createOrder({
    offer: [
      {
        itemType: 2, // ERC721
        token: nftAddress,
        identifier: tokenId.toString(),
      },
    ],
    consideration: [
      {
        amount: ethers.parseEther(priceEth).toString(),
        recipient: signer.address,
      },
    ],
    startTime: now.toString(),
    endTime: (now + durationSeconds).toString(),
  });

  const order = await executeAllActions();
  return order;
}
```

## Fulfill Order (Buyer)

```typescript
async function fulfillListing(order: any) {
  const { executeAllActions } = await seaport.fulfillOrder({
    order,
    accountAddress: signer.address,
  });

  const transaction = await executeAllActions();
  return transaction;
}
```

## Direct Seaport Interaction (Without SDK)

For environments where the Seaport SDK is not available, interact directly with the contract:

```typescript
const seaportAbi = [
  {
    type: "function",
    name: "fulfillBasicOrder_efficient_6GL6yc",
    inputs: [
      {
        name: "parameters",
        type: "tuple",
        components: [
          { name: "considerationToken", type: "address" },
          { name: "considerationIdentifier", type: "uint256" },
          { name: "considerationAmount", type: "uint256" },
          { name: "offerer", type: "address" },
          { name: "zone", type: "address" },
          { name: "offerToken", type: "address" },
          { name: "offerIdentifier", type: "uint256" },
          { name: "offerAmount", type: "uint256" },
          { name: "basicOrderType", type: "uint8" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "zoneHash", type: "bytes32" },
          { name: "salt", type: "uint256" },
          { name: "offererConduitKey", type: "bytes32" },
          { name: "fulfillerConduitKey", type: "bytes32" },
          { name: "totalOriginalAdditionalRecipients", type: "uint256" },
          { name: "additionalRecipients", type: "tuple[]", components: [
            { name: "amount", type: "uint256" },
            { name: "recipient", type: "address" },
          ]},
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "fulfilled", type: "bool" }],
    stateMutability: "payable",
  },
] as const;

async function fulfillBasicOrder(
  offerer: Address,
  nftAddress: Address,
  tokenId: bigint,
  price: bigint,
  signature: `0x${string}`,
  startTime: bigint,
  endTime: bigint,
  salt: bigint
) {
  const hash = await walletClient.writeContract({
    address: SEAPORT_ADDRESS,
    abi: seaportAbi,
    functionName: "fulfillBasicOrder_efficient_6GL6yc",
    args: [{
      considerationToken: "0x0000000000000000000000000000000000000000",
      considerationIdentifier: 0n,
      considerationAmount: price,
      offerer,
      zone: "0x0000000000000000000000000000000000000000",
      offerToken: nftAddress,
      offerIdentifier: tokenId,
      offerAmount: 1n,
      basicOrderType: 0, // ETH_TO_ERC721_FULL_OPEN
      startTime,
      endTime,
      zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      salt,
      offererConduitKey: "0x0000000000000000000000000000000000000000000000000000000000000000",
      fulfillerConduitKey: "0x0000000000000000000000000000000000000000000000000000000000000000",
      totalOriginalAdditionalRecipients: 0n,
      additionalRecipients: [],
      signature,
    }],
    value: price,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error("Fulfillment transaction reverted");
  }

  return receipt;
}
```

## Notes

- Seaport 1.6 address `0x0000000000000068F116A894984e2DB1123eB395` is the same on all EVM chains (Ethereum, Arbitrum, Base, Optimism, Polygon, etc.).
- Orders are signed off-chain (EIP-712) and fulfilled on-chain. No gas is spent until someone fulfills the order.
- `basicOrderType: 0` is `ETH_TO_ERC721_FULL_OPEN` -- ETH payment for a full ERC-721 token, no zone restrictions.
- For ERC-1155 listings, use `itemType: 3` in the offer and `basicOrderType: 4` (`ETH_TO_ERC1155_FULL_OPEN`).
- The `@opensea/seaport-js` SDK uses ethers.js internally. For pure viem projects, use the direct contract interaction pattern.
- Never hardcode private keys. Use environment variables or a wallet connection for signing.
