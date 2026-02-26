# Supply to MetaMorpho Vault

Deposit assets into a MetaMorpho vault to earn yield across curated Morpho Blue markets. MetaMorpho vaults implement ERC-4626, so the interface is standard `deposit`/`withdraw`/`redeem`.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
```

## ABIs

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
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const vaultAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maxDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToShares",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

## Deposit into Vault

```typescript
async function depositToVault(
  vaultAddress: Address,
  assetAddress: Address,
  amount: bigint,
  assetDecimals: number
): Promise<{ hash: `0x${string}`; sharesReceived: bigint }> {
  // Check deposit cap
  const maxDeposit = await publicClient.readContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "maxDeposit",
    args: [account.address],
  });

  if (amount > maxDeposit) {
    throw new Error(
      `Deposit exceeds cap. Max: ${formatUnits(maxDeposit, assetDecimals)}`
    );
  }

  // Approve vault to spend asset
  const allowance = await publicClient.readContract({
    address: assetAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, vaultAddress],
  });

  if (allowance < amount) {
    const approveHash = await walletClient.writeContract({
      address: assetAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [vaultAddress, amount],
    });
    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveHash,
    });
    if (approveReceipt.status !== "success") {
      throw new Error("Approval reverted");
    }
  }

  // Simulate deposit
  const { request, result } = await publicClient.simulateContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "deposit",
    args: [amount, account.address],
    account: account.address,
  });

  // Execute deposit
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error("Vault deposit reverted");
  }

  return { hash, sharesReceived: result };
}
```

## Withdraw from Vault

```typescript
async function withdrawFromVault(
  vaultAddress: Address,
  amount: bigint
): Promise<{ hash: `0x${string}`; sharesBurned: bigint }> {
  const { request, result } = await publicClient.simulateContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "withdraw",
    args: [amount, account.address, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error("Vault withdraw reverted");
  }

  return { hash, sharesBurned: result };
}
```

## Redeem All Shares

```typescript
async function redeemAllShares(
  vaultAddress: Address
): Promise<{ hash: `0x${string}`; assetsReceived: bigint }> {
  const shares = await publicClient.readContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (shares === 0n) {
    throw new Error("No vault shares to redeem");
  }

  const { request, result } = await publicClient.simulateContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: "redeem",
    args: [shares, account.address, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error("Vault redeem reverted");
  }

  return { hash, assetsReceived: result };
}
```

## Check Vault Position

```typescript
async function getVaultPosition(vaultAddress: Address) {
  const [shares, totalAssets] = await Promise.all([
    publicClient.readContract({
      address: vaultAddress,
      abi: vaultAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: vaultAbi,
      functionName: "totalAssets",
    }),
  ]);

  const assetsValue = shares > 0n
    ? await publicClient.readContract({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "convertToAssets",
        args: [shares],
      })
    : 0n;

  return { shares, assetsValue, totalAssets };
}
```

## Complete Usage

```typescript
async function main() {
  const VAULT = "0xBEEF01735c132Ada46AA9aA9B6290e7a2CE81cd" as Address;
  const depositAmount = parseUnits("10000", 6); // 10,000 USDC

  // Deposit
  const { hash, sharesReceived } = await depositToVault(
    VAULT,
    USDC,
    depositAmount,
    6
  );
  console.log(`Deposited. Shares received: ${sharesReceived}`);
  console.log(`Transaction: ${hash}`);

  // Check position
  const position = await getVaultPosition(VAULT);
  console.log(`Shares held: ${position.shares}`);
  console.log(`Asset value: ${formatUnits(position.assetsValue, 6)} USDC`);
}

main().catch(console.error);
```
