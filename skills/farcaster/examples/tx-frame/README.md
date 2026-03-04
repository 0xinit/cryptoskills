# Transaction Frame

Working TypeScript example for a Farcaster Mini App that triggers an onchain transaction using the Frame SDK wallet provider and viem.

## Dependencies

```bash
npm install @farcaster/frame-sdk viem
```

## Wallet Provider Setup

The Frame SDK exposes an EIP-1193 compatible Ethereum provider through `sdk.wallet.ethProvider`. This connects to the user's wallet managed by the Farcaster client.

```typescript
import sdk from "@farcaster/frame-sdk";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  parseEther,
  encodeFunctionData,
  type Address,
  type Hash,
} from "viem";
import { base } from "viem/chains";

async function setupWallet() {
  const context = await sdk.context;
  sdk.actions.ready();

  const provider = sdk.wallet.ethProvider;

  const walletClient = createWalletClient({
    chain: base,
    transport: custom(provider),
  });

  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  const [address] = await walletClient.requestAddresses();

  return { walletClient, publicClient, address };
}
```

## Send ETH

```typescript
async function sendEth(to: Address, amount: string): Promise<Hash> {
  const { walletClient, publicClient, address } = await setupWallet();

  const hash = await walletClient.sendTransaction({
    account: address,
    to,
    value: parseEther(amount),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }

  return hash;
}
```

## Contract Interaction (Mint NFT)

```typescript
const NFT_CONTRACT = "0xNFTContract..." as const;

const mintAbi = [
  {
    type: "function",
    name: "mint",
    inputs: [{ name: "to", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "payable",
  },
] as const;

async function mintNft(): Promise<{ hash: Hash; tokenId: bigint }> {
  const { walletClient, publicClient, address } = await setupWallet();

  const hash = await walletClient.sendTransaction({
    account: address,
    to: NFT_CONTRACT,
    value: parseEther("0.001"),
    data: encodeFunctionData({
      abi: mintAbi,
      functionName: "mint",
      args: [address],
    }),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Mint reverted: ${hash}`);
  }

  const mintLog = receipt.logs[0];
  const tokenId = BigInt(mintLog.topics[3] ?? "0");

  return { hash, tokenId };
}
```

## ERC-20 Token Transfer

```typescript
const ERC20_ADDRESS = "0xTokenContract..." as const;

const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

async function transferTokens(
  to: Address,
  amount: bigint
): Promise<Hash> {
  const { walletClient, publicClient, address } = await setupWallet();

  const hash = await walletClient.sendTransaction({
    account: address,
    to: ERC20_ADDRESS,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount],
    }),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transfer reverted: ${hash}`);
  }

  return hash;
}
```

## Complete Mini App with Transaction UI

```typescript
import sdk from "@farcaster/frame-sdk";
import { createWalletClient, custom, parseEther, type Address } from "viem";
import { base } from "viem/chains";

async function main() {
  const context = await sdk.context;
  const provider = sdk.wallet.ethProvider;

  const walletClient = createWalletClient({
    chain: base,
    transport: custom(provider),
  });

  const [address] = await walletClient.requestAddresses();

  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div style="padding: 16px; font-family: system-ui;">
      <p>Connected: ${address.slice(0, 6)}...${address.slice(-4)}</p>
      <p>User: @${context.user.username} (FID: ${context.user.fid})</p>
      <button id="send-btn" style="padding: 12px 24px; font-size: 16px; cursor: pointer;">
        Send 0.001 ETH
      </button>
      <p id="status"></p>
    </div>
  `;

  document.getElementById("send-btn")!.addEventListener("click", async () => {
    const status = document.getElementById("status")!;
    status.textContent = "Confirming...";

    try {
      const hash = await walletClient.sendTransaction({
        account: address,
        to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address,
        value: parseEther("0.001"),
      });
      status.textContent = `Sent! Hash: ${hash}`;
    } catch (err) {
      status.textContent = `Error: ${err instanceof Error ? err.message : "Unknown"}`;
    }
  });

  sdk.actions.ready();
}

main().catch(console.error);
```

## Notes

- The wallet provider is only available inside a Farcaster client (Warpcast). Testing outside a client will throw
- `sdk.wallet.ethProvider` follows EIP-1193 -- it works with viem's `custom()` transport and wagmi connectors
- Users must confirm transactions in their Farcaster client's wallet UI before they are broadcast
- Always check `receipt.status` after `waitForTransactionReceipt` -- a mined transaction can still have reverted
- The connected chain depends on the Farcaster client's wallet configuration. Use `wallet_switchEthereumChain` to request a specific chain if needed
- Token amounts must use `bigint`, not JavaScript `number`, to avoid precision loss
