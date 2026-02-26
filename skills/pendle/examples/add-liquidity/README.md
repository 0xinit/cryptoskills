# Add Liquidity to a Pendle Market

Working TypeScript examples for adding and removing liquidity on Pendle AMM using viem. Pendle LPs provide PT + SY liquidity and earn swap fees, underlying yield, and PENDLE incentives.

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
const PENDLE_MARKET = "0xD0354D4e7bCf345fB117cabe41aCaDb724009CE5" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
```

## Token Approval

```typescript
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
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

## Add Liquidity with Single Token

The Router handles token -> SY conversion and PT/SY split for LP deposit in one transaction.

```typescript
const lpAbi = parseAbi([
  "function addLiquiditySingleToken(address receiver, address market, uint256 minLpOut, (uint256 guessMin, uint256 guessMax, uint256 guessOffchain, uint256 maxIteration, uint256 eps) guessPtReceivedFromSy, (address tokenIn, uint256 netTokenIn, address tokenMintSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData) input) payable returns (uint256 netLpOut, uint256 netSyFee)",
]);

async function addLiquidityWithWeth(
  wethAmount: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; netLpOut: bigint }> {
  await ensureApproval(WETH, PENDLE_ROUTER, wethAmount);

  const guessPtReceivedFromSy = {
    guessMin: 0n,
    guessMax: wethAmount * 2n,
    guessOffchain: 0n,
    maxIteration: 256n,
    eps: 1_000_000_000_000_000n,
  };

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

  // Simulate to get expected LP output
  const { result: simResult } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: lpAbi,
    functionName: "addLiquiditySingleToken",
    args: [
      account.address,
      PENDLE_MARKET,
      0n, // preview with no minimum
      guessPtReceivedFromSy,
      tokenInput,
    ],
    account: account.address,
  });

  const expectedLpOut = simResult[0];
  const minLpOut = expectedLpOut - (expectedLpOut * slippageBps) / 10000n;

  // Execute with slippage protection
  const { request } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: lpAbi,
    functionName: "addLiquiditySingleToken",
    args: [
      account.address,
      PENDLE_MARKET,
      minLpOut,
      guessPtReceivedFromSy,
      tokenInput,
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("addLiquiditySingleToken reverted");

  return { hash, netLpOut: expectedLpOut };
}
```

## Add Liquidity with Native ETH

```typescript
async function addLiquidityWithEth(
  ethAmount: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; netLpOut: bigint }> {
  const guessPtReceivedFromSy = {
    guessMin: 0n,
    guessMax: ethAmount * 2n,
    guessOffchain: 0n,
    maxIteration: 256n,
    eps: 1_000_000_000_000_000n,
  };

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

  // Simulate for expected output
  const { result: simResult } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: lpAbi,
    functionName: "addLiquiditySingleToken",
    args: [
      account.address,
      PENDLE_MARKET,
      0n,
      guessPtReceivedFromSy,
      tokenInput,
    ],
    account: account.address,
    value: ethAmount,
  });

  const expectedLpOut = simResult[0];
  const minLpOut = expectedLpOut - (expectedLpOut * slippageBps) / 10000n;

  const { request } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: lpAbi,
    functionName: "addLiquiditySingleToken",
    args: [
      account.address,
      PENDLE_MARKET,
      minLpOut,
      guessPtReceivedFromSy,
      tokenInput,
    ],
    account: account.address,
    value: ethAmount,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("addLiquiditySingleToken reverted");

  return { hash, netLpOut: expectedLpOut };
}
```

## Remove Liquidity to Single Token

```typescript
const removeLpAbi = parseAbi([
  "function removeLiquiditySingleToken(address receiver, address market, uint256 netLpIn, (address tokenOut, uint256 minTokenOut, address tokenRedeemSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData) output) returns (uint256 netTokenOut, uint256 netSyFee)",
]);

async function removeLiquidityToWeth(
  lpAmount: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; netTokenOut: bigint }> {
  await ensureApproval(PENDLE_MARKET, PENDLE_ROUTER, lpAmount);

  const tokenOutput = {
    tokenOut: WETH,
    minTokenOut: 0n,
    tokenRedeemSy: WETH,
    pendleSwap: "0x0000000000000000000000000000000000000000" as const,
    swapData: {
      swapType: 0,
      extRouter: "0x0000000000000000000000000000000000000000" as const,
      extCalldata: "0x" as `0x${string}`,
      needScale: false,
    },
  };

  // Simulate for expected output
  const { result: simResult } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: removeLpAbi,
    functionName: "removeLiquiditySingleToken",
    args: [account.address, PENDLE_MARKET, lpAmount, tokenOutput],
    account: account.address,
  });

  const expectedTokenOut = simResult[0];
  const minTokenOut = expectedTokenOut - (expectedTokenOut * slippageBps) / 10000n;

  const outputWithSlippage = { ...tokenOutput, minTokenOut };

  const { request } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: removeLpAbi,
    functionName: "removeLiquiditySingleToken",
    args: [account.address, PENDLE_MARKET, lpAmount, outputWithSlippage],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("removeLiquiditySingleToken reverted");

  return { hash, netTokenOut: expectedTokenOut };
}
```

## Check LP Balance and Claim Rewards

```typescript
const claimAbi = parseAbi([
  "function redeemDueInterestAndRewards(address user, address[] SYs, address[] PTs, address[] YTs, address[] markets) returns (uint256[][] netSyOut, uint256[][] netRewardOut)",
]);

async function checkLpBalanceAndClaim(): Promise<void> {
  const lpBalance = await publicClient.readContract({
    address: PENDLE_MARKET,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  console.log(`LP balance: ${Number(lpBalance) / 1e18}`);

  if (lpBalance === 0n) {
    console.log("No LP position to claim rewards for");
    return;
  }

  const SY_WSTETH = "0xcbC72d92b2dc8187414F6734718563898740C0BC" as const;
  const PT_WSTETH = "0xB253A3370B1Db752D65b890B1fE093A26C398bDE" as const;
  const YT_WSTETH = "0x7B6C3e5486D9e6959441ab554A889099ead23c1F" as const;

  const { request } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: claimAbi,
    functionName: "redeemDueInterestAndRewards",
    args: [
      account.address,
      [SY_WSTETH],
      [PT_WSTETH],
      [YT_WSTETH],
      [PENDLE_MARKET],
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Claim reverted");

  console.log(`Rewards claimed: ${hash}`);
}
```

## Complete Usage

```typescript
async function main() {
  const wethAmount = parseEther("1");

  // Add liquidity with 1% slippage tolerance
  const { hash: addHash, netLpOut } = await addLiquidityWithWeth(wethAmount, 100n);
  console.log(`Added liquidity: ${Number(netLpOut) / 1e18} LP tokens`);
  console.log(`Add tx: ${addHash}`);

  // Check balance and claim rewards
  await checkLpBalanceAndClaim();

  // Remove all liquidity
  const lpBalance = await publicClient.readContract({
    address: PENDLE_MARKET,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (lpBalance > 0n) {
    const { hash: removeHash, netTokenOut } = await removeLiquidityToWeth(lpBalance, 100n);
    console.log(`Removed liquidity: ${Number(netTokenOut) / 1e18} WETH`);
    console.log(`Remove tx: ${removeHash}`);
  }
}

main().catch(console.error);
```
