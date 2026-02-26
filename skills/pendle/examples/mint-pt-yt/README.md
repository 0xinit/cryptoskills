# Mint PT and YT from Underlying Asset

Working TypeScript example for minting PT (Principal Token) and YT (Yield Token) from an underlying asset via Pendle Router. This example uses stETH/wstETH as the underlying.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEther,
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

const PENDLE_ROUTER = "0x888888888889758F76e7103c6CbF23ABbF58F946" as const;
const SY_WSTETH = "0xcbC72d92b2dc8187414F6734718563898740C0BC" as const;
const YT_WSTETH = "0x7B6C3e5486D9e6959441ab554A889099ead23c1F" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
```

## Token Approval

Before minting, approve the Router to spend your tokens. For native ETH, no approval is needed.

```typescript
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

async function ensureApproval(
  token: Address,
  spender: Address,
  amount: bigint
): Promise<void> {
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, spender],
  });

  if (allowance >= amount) return;

  const { request } = await publicClient.simulateContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Approval failed for ${token}`);
}
```

## Mint PT + YT from Token (One-Step via Router)

The Router handles token -> SY -> PT+YT atomically. For ETH input, send as `msg.value`.

```typescript
const mintPyFromTokenAbi = parseAbi([
  "function mintPyFromToken(address receiver, address YT, uint256 minPyOut, (address tokenIn, uint256 netTokenIn, address tokenMintSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData) input) payable returns (uint256 netPyOut)",
]);

async function mintPtYtFromEth(
  ethAmount: bigint,
  minPyOut: bigint
): Promise<{ hash: `0x${string}`; netPyOut: bigint }> {
  const tokenInput = {
    tokenIn: "0x0000000000000000000000000000000000000000" as const,
    netTokenIn: ethAmount,
    tokenMintSy: "0x0000000000000000000000000000000000000000" as const,
    pendleSwap: "0x0000000000000000000000000000000000000000" as const,
    swapData: {
      swapType: 0,
      extRouter: "0x0000000000000000000000000000000000000000" as const,
      extCalldata: "0x" as `0x${string}`,
      needScale: false,
    },
  };

  const { request, result } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: mintPyFromTokenAbi,
    functionName: "mintPyFromToken",
    args: [account.address, YT_WSTETH, minPyOut, tokenInput],
    account: account.address,
    value: ethAmount,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("mintPyFromToken reverted");

  return { hash, netPyOut: result };
}
```

## Mint PT + YT from ERC-20 (WETH Example)

```typescript
async function mintPtYtFromWeth(
  wethAmount: bigint,
  minPyOut: bigint
): Promise<{ hash: `0x${string}`; netPyOut: bigint }> {
  await ensureApproval(WETH, PENDLE_ROUTER, wethAmount);

  const tokenInput = {
    tokenIn: WETH,
    netTokenIn: wethAmount,
    tokenMintSy: WETH,
    pendleSwap: "0x0000000000000000000000000000000000000000" as const,
    swapData: {
      swapType: 0,
      extRouter: "0x0000000000000000000000000000000000000000" as const,
      extCalldata: "0x" as `0x${string}`,
      needScale: false,
    },
  };

  const { request, result } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: mintPyFromTokenAbi,
    functionName: "mintPyFromToken",
    args: [account.address, YT_WSTETH, minPyOut, tokenInput],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("mintPyFromToken reverted");

  return { hash, netPyOut: result };
}
```

## Mint from SY (Two-Step: You Already Have SY)

If you already hold SY tokens, mint PT+YT directly without the token-to-SY conversion.

```typescript
const mintPyFromSyAbi = parseAbi([
  "function mintPyFromSy(address receiver, address YT, uint256 netSyIn, uint256 minPyOut) returns (uint256 netPyOut)",
]);

async function mintPtYtFromSy(
  syAmount: bigint,
  minPyOut: bigint
): Promise<{ hash: `0x${string}`; netPyOut: bigint }> {
  await ensureApproval(SY_WSTETH, PENDLE_ROUTER, syAmount);

  const { request, result } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: mintPyFromSyAbi,
    functionName: "mintPyFromSy",
    args: [account.address, YT_WSTETH, syAmount, minPyOut],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("mintPyFromSy reverted");

  return { hash, netPyOut: result };
}
```

## Redeem PT + YT Back to Token

Combine equal amounts of PT and YT to recover the underlying.

```typescript
const redeemPyToTokenAbi = parseAbi([
  "function redeemPyToToken(address receiver, address YT, uint256 netPyIn, (address tokenOut, uint256 minTokenOut, address tokenRedeemSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData) output) returns (uint256 netTokenOut)",
]);

async function redeemPtYtToEth(
  pyAmount: bigint,
  minTokenOut: bigint
): Promise<{ hash: `0x${string}`; netTokenOut: bigint }> {
  const PT_WSTETH = "0xB253A3370B1Db752D65b890B1fE093A26C398bDE" as const;
  await ensureApproval(PT_WSTETH, PENDLE_ROUTER, pyAmount);
  await ensureApproval(YT_WSTETH, PENDLE_ROUTER, pyAmount);

  const tokenOutput = {
    tokenOut: "0x0000000000000000000000000000000000000000" as const,
    minTokenOut,
    tokenRedeemSy: "0x0000000000000000000000000000000000000000" as const,
    pendleSwap: "0x0000000000000000000000000000000000000000" as const,
    swapData: {
      swapType: 0,
      extRouter: "0x0000000000000000000000000000000000000000" as const,
      extCalldata: "0x" as `0x${string}`,
      needScale: false,
    },
  };

  const { request, result } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: redeemPyToTokenAbi,
    functionName: "redeemPyToToken",
    args: [account.address, YT_WSTETH, pyAmount, tokenOutput],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("redeemPyToToken reverted");

  return { hash, netTokenOut: result };
}
```

## Complete Usage

```typescript
async function main() {
  const ethAmount = parseEther("1");

  // Mint PT+YT from 1 ETH (set minPyOut=0 for demonstration only)
  const { hash: mintHash, netPyOut } = await mintPtYtFromEth(ethAmount, 0n);
  console.log(`Minted ${Number(netPyOut) / 1e18} PT+YT`);
  console.log(`Mint tx: ${mintHash}`);

  // Redeem back to ETH
  const { hash: redeemHash, netTokenOut } = await redeemPtYtToEth(netPyOut, 0n);
  console.log(`Redeemed ${Number(netTokenOut) / 1e18} ETH`);
  console.log(`Redeem tx: ${redeemHash}`);
}

main().catch(console.error);
```
