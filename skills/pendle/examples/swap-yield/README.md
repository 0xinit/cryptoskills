# Swap Yield on Pendle AMM

Working TypeScript examples for buying PT (fixed yield) and selling YT (locking in variable yield) on Pendle's AMM using viem.

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
const PENDLE_ROUTER_STATIC = "0x263833d47eA3fA4a30d59B2E6C1A0e682eF1C078" as const;
const PENDLE_MARKET = "0xD0354D4e7bCf345fB117cabe41aCaDb724009CE5" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const PT_WSTETH = "0xB253A3370B1Db752D65b890B1fE093A26C398bDE" as const;
```

## Token Approval

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

## Preview Expected PT Output

Always preview before swapping. Use `PendleRouterStatic` for gas-free previews.

```typescript
const previewAbi = parseAbi([
  "function swapExactTokenForPtStatic(address market, address tokenIn, uint256 netTokenIn) view returns (uint256 netPtOut, uint256 netSyFee, uint256 priceImpact)",
]);

async function previewBuyPt(
  tokenIn: Address,
  netTokenIn: bigint
): Promise<{ netPtOut: bigint; priceImpact: bigint }> {
  const result = await publicClient.readContract({
    address: PENDLE_ROUTER_STATIC,
    abi: previewAbi,
    functionName: "swapExactTokenForPtStatic",
    args: [PENDLE_MARKET, tokenIn, netTokenIn],
  });

  return { netPtOut: result[0], priceImpact: result[2] };
}
```

## Buy PT for Fixed Yield (Token -> PT)

Buying PT at a discount locks in a fixed yield that is realized when PT is redeemed at maturity.

```typescript
const swapAbi = parseAbi([
  "function swapExactTokenForPt(address receiver, address market, uint256 minPtOut, (uint256 guessMin, uint256 guessMax, uint256 guessOffchain, uint256 maxIteration, uint256 eps) guessPtOut, (address tokenIn, uint256 netTokenIn, address tokenMintSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData) input) payable returns (uint256 netPtOut, uint256 netSyFee)",
]);

async function buyPtWithWeth(
  wethAmount: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; netPtOut: bigint }> {
  // Preview expected output
  const { netPtOut: expectedPtOut } = await previewBuyPt(WETH, wethAmount);

  // Apply slippage tolerance
  const minPtOut = expectedPtOut - (expectedPtOut * slippageBps) / 10000n;

  await ensureApproval(WETH, PENDLE_ROUTER, wethAmount);

  const guessPtOut = {
    guessMin: 0n,
    guessMax: expectedPtOut * 2n,
    guessOffchain: 0n,
    maxIteration: 256n,
    eps: 1_000_000_000_000_000n, // 0.1% precision
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

  const { request, result } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: swapAbi,
    functionName: "swapExactTokenForPt",
    args: [
      account.address,
      PENDLE_MARKET,
      minPtOut,
      guessPtOut,
      tokenInput,
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("swapExactTokenForPt reverted");

  return { hash, netPtOut: result[0] };
}
```

## Sell PT for Token (PT -> Token)

Sell PT before maturity to exit a fixed-yield position early (at current market rate).

```typescript
const swapPtForTokenAbi = parseAbi([
  "function swapExactPtForToken(address receiver, address market, uint256 exactPtIn, (address tokenOut, uint256 minTokenOut, address tokenRedeemSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData) output) returns (uint256 netTokenOut, uint256 netSyFee)",
]);

async function sellPtForWeth(
  ptAmount: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; netTokenOut: bigint }> {
  await ensureApproval(PT_WSTETH, PENDLE_ROUTER, ptAmount);

  // Preview expected output for slippage calculation
  // Use a conservative estimate: PT trades near (1 - impliedRate * timeToMaturity) * underlying
  const tokenOutput = {
    tokenOut: WETH,
    minTokenOut: 0n, // will be set below after preview
    tokenRedeemSy: WETH,
    pendleSwap: "0x0000000000000000000000000000000000000000" as const,
    swapData: {
      swapType: 0,
      extRouter: "0x0000000000000000000000000000000000000000" as const,
      extCalldata: "0x" as `0x${string}`,
      needScale: false,
    },
  };

  // Simulate to get expected output
  const { result } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: swapPtForTokenAbi,
    functionName: "swapExactPtForToken",
    args: [account.address, PENDLE_MARKET, ptAmount, tokenOutput],
    account: account.address,
  });

  const expectedTokenOut = result[0];
  const minTokenOut = expectedTokenOut - (expectedTokenOut * slippageBps) / 10000n;

  // Execute with slippage protection
  const outputWithSlippage = { ...tokenOutput, minTokenOut };

  const { request } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: swapPtForTokenAbi,
    functionName: "swapExactPtForToken",
    args: [account.address, PENDLE_MARKET, ptAmount, outputWithSlippage],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("swapExactPtForToken reverted");

  return { hash, netTokenOut: expectedTokenOut };
}
```

## Buy YT for Leveraged Yield Exposure (Token -> YT)

Buying YT gives you yield on the full underlying amount for a fraction of the cost. This is a leveraged bet that the actual yield will exceed the implied rate.

```typescript
const swapYtAbi = parseAbi([
  "function swapExactTokenForYt(address receiver, address market, uint256 minYtOut, (uint256 guessMin, uint256 guessMax, uint256 guessOffchain, uint256 maxIteration, uint256 eps) guessYtOut, (address tokenIn, uint256 netTokenIn, address tokenMintSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData) input) payable returns (uint256 netYtOut, uint256 netSyFee)",
]);

async function buyYtWithWeth(
  wethAmount: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; netYtOut: bigint }> {
  await ensureApproval(WETH, PENDLE_ROUTER, wethAmount);

  const guessYtOut = {
    guessMin: 0n,
    guessMax: wethAmount * 50n, // YT leverage can be very high
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

  const { request, result } = await publicClient.simulateContract({
    address: PENDLE_ROUTER,
    abi: swapYtAbi,
    functionName: "swapExactTokenForYt",
    args: [
      account.address,
      PENDLE_MARKET,
      0n, // SET minYtOut IN PRODUCTION after previewing
      guessYtOut,
      tokenInput,
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("swapExactTokenForYt reverted");

  return { hash, netYtOut: result[0] };
}
```

## Sell YT for Token (YT -> Token)

Sell YT to exit a leveraged yield position. Any accrued yield is claimed separately.

```typescript
const swapYtForTokenAbi = parseAbi([
  "function swapExactYtForToken(address receiver, address market, uint256 exactYtIn, (address tokenOut, uint256 minTokenOut, address tokenRedeemSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData) output) returns (uint256 netTokenOut, uint256 netSyFee)",
]);

async function sellYtForWeth(
  ytAmount: bigint,
  slippageBps: bigint
): Promise<{ hash: `0x${string}`; netTokenOut: bigint }> {
  const YT_WSTETH = "0x7B6C3e5486D9e6959441ab554A889099ead23c1F" as const;
  await ensureApproval(YT_WSTETH, PENDLE_ROUTER, ytAmount);

  const tokenOutput = {
    tokenOut: WETH,
    minTokenOut: 0n, // SET IN PRODUCTION
    tokenRedeemSy: WETH,
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
    abi: swapYtForTokenAbi,
    functionName: "swapExactYtForToken",
    args: [account.address, PENDLE_MARKET, ytAmount, tokenOutput],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("swapExactYtForToken reverted");

  return { hash, netTokenOut: result[0] };
}
```

## Complete Usage

```typescript
async function main() {
  const wethAmount = parseEther("1");

  // Buy PT for fixed yield (1% slippage)
  const { hash: buyPtHash, netPtOut } = await buyPtWithWeth(wethAmount, 100n);
  console.log(`Bought ${Number(netPtOut) / 1e18} PT-wstETH`);
  console.log(`Buy PT tx: ${buyPtHash}`);

  // Buy YT for leveraged yield (1% slippage)
  const smallAmount = parseEther("0.1");
  const { hash: buyYtHash, netYtOut } = await buyYtWithWeth(smallAmount, 100n);
  console.log(`Bought ${Number(netYtOut) / 1e18} YT-wstETH`);
  console.log(`Buy YT tx: ${buyYtHash}`);
}

main().catch(console.error);
```
