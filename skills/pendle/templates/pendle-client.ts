/**
 * Pendle Market Client Template
 *
 * Complete starter template for reading Pendle market state and executing
 * PT purchases (fixed yield) using viem.
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set RPC_URL and PRIVATE_KEY environment variables
 * 3. Update PENDLE_MARKET to your target market address
 * 4. Import and use the functions
 *
 * Dependencies: viem
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// ============================================================================
// Configuration
// ============================================================================

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;

if (!RPC_URL) throw new Error("RPC_URL environment variable is required");
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY environment variable is required");

const account = privateKeyToAccount(PRIVATE_KEY);

export const publicClient: PublicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

export const walletClient: WalletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(RPC_URL),
});

// ============================================================================
// Contract Addresses (Ethereum Mainnet)
// ============================================================================

const PENDLE_ROUTER = "0x888888888889758F76e7103c6CbF23ABbF58F946" as const;
const PENDLE_ROUTER_STATIC = "0x263833d47eA3fA4a30d59B2E6C1A0e682eF1C078" as const;
const PENDLE_PT_ORACLE = "0x66a1096C6366b2529274dF4f5D8f56DA60a2CacD" as const;

// Update this to your target market
const PENDLE_MARKET = "0xD0354D4e7bCf345fB117cabe41aCaDb724009CE5" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;

// ============================================================================
// ABIs
// ============================================================================

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

const marketAbi = parseAbi([
  "function readState(address router) view returns (int256 totalPt, int256 totalSy, int256 totalLp, address treasury, int256 scalarRoot, int256 expiry, int256 lnFeeRateRoot, uint256 reserveFeePercent, int256 lastLnImpliedRate)",
  "function expiry() view returns (uint256)",
  "function readTokens() view returns (address sy, address pt, address yt)",
]);

const routerStaticAbi = parseAbi([
  "function swapExactTokenForPtStatic(address market, address tokenIn, uint256 netTokenIn) view returns (uint256 netPtOut, uint256 netSyFee, uint256 priceImpact)",
]);

const swapAbi = parseAbi([
  "function swapExactTokenForPt(address receiver, address market, uint256 minPtOut, (uint256 guessMin, uint256 guessMax, uint256 guessOffchain, uint256 maxIteration, uint256 eps) guessPtOut, (address tokenIn, uint256 netTokenIn, address tokenMintSy, address pendleSwap, (uint8 swapType, address extRouter, bytes extCalldata, bool needScale) swapData) input) payable returns (uint256 netPtOut, uint256 netSyFee)",
]);

const oracleAbi = parseAbi([
  "function getPtToAssetRate(address market, uint32 duration) view returns (uint256)",
  "function getOracleState(address market, uint32 duration) view returns (bool increaseCardinalityRequired, uint16 cardinalityRequired, bool oldestObservationSatisfied)",
]);

// ============================================================================
// Market State
// ============================================================================

interface MarketState {
  totalPt: bigint;
  totalSy: bigint;
  impliedApy: number;
  expiryDate: Date;
  isExpired: boolean;
  daysToExpiry: number;
  sy: Address;
  pt: Address;
  yt: Address;
}

export async function getMarketState(market: Address): Promise<MarketState> {
  const [state, expiry, tokens] = await Promise.all([
    publicClient.readContract({
      address: market,
      abi: marketAbi,
      functionName: "readState",
      args: [PENDLE_ROUTER],
    }),
    publicClient.readContract({
      address: market,
      abi: marketAbi,
      functionName: "expiry",
    }),
    publicClient.readContract({
      address: market,
      abi: marketAbi,
      functionName: "readTokens",
    }),
  ]);

  const lnRate = Number(state[8]) / 1e18;
  const impliedApy = Math.exp(lnRate) - 1;
  const expiryDate = new Date(Number(expiry) * 1000);
  const isExpired = Date.now() > Number(expiry) * 1000;
  const daysToExpiry = isExpired
    ? 0
    : (Number(expiry) * 1000 - Date.now()) / (1000 * 60 * 60 * 24);

  return {
    totalPt: state[0],
    totalSy: state[1],
    impliedApy,
    expiryDate,
    isExpired,
    daysToExpiry,
    sy: tokens[0],
    pt: tokens[1],
    yt: tokens[2],
  };
}

// ============================================================================
// Oracle
// ============================================================================

interface OracleRate {
  ptToAssetRate: number;
  oracleReady: boolean;
}

export async function getOracleRate(
  market: Address,
  twapDurationSeconds: number
): Promise<OracleRate> {
  const oracleState = await publicClient.readContract({
    address: PENDLE_PT_ORACLE,
    abi: oracleAbi,
    functionName: "getOracleState",
    args: [market, twapDurationSeconds],
  });

  const [increaseRequired, , observationSatisfied] = oracleState;
  const oracleReady = !increaseRequired && observationSatisfied;

  if (!oracleReady) {
    return { ptToAssetRate: 0, oracleReady: false };
  }

  const ptToAssetRate = await publicClient.readContract({
    address: PENDLE_PT_ORACLE,
    abi: oracleAbi,
    functionName: "getPtToAssetRate",
    args: [market, twapDurationSeconds],
  });

  return {
    ptToAssetRate: Number(ptToAssetRate) / 1e18,
    oracleReady: true,
  };
}

// ============================================================================
// Token Approval
// ============================================================================

export async function ensureApproval(
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

// ============================================================================
// Preview
// ============================================================================

export async function previewBuyPt(
  market: Address,
  tokenIn: Address,
  netTokenIn: bigint
): Promise<{ netPtOut: bigint; priceImpact: bigint }> {
  const result = await publicClient.readContract({
    address: PENDLE_ROUTER_STATIC,
    abi: routerStaticAbi,
    functionName: "swapExactTokenForPtStatic",
    args: [market, tokenIn, netTokenIn],
  });

  return { netPtOut: result[0], priceImpact: result[2] };
}

// ============================================================================
// Buy PT (Fixed Yield)
// ============================================================================

export async function buyPtWithToken(params: {
  market: Address;
  tokenIn: Address;
  amount: bigint;
  slippageBps: bigint;
  isNativeEth?: boolean;
}): Promise<{ hash: `0x${string}`; netPtOut: bigint }> {
  const { market, tokenIn, amount, slippageBps, isNativeEth } = params;

  // Check market is not expired
  const state = await getMarketState(market);
  if (state.isExpired) {
    throw new Error(`Market expired on ${state.expiryDate.toISOString()}`);
  }

  // Preview expected output
  const { netPtOut: expectedPtOut, priceImpact } = await previewBuyPt(
    market,
    tokenIn,
    amount
  );

  // Warn on high price impact (> 1%)
  if (Number(priceImpact) / 1e18 > 0.01) {
    console.warn(
      `High price impact: ${(Number(priceImpact) / 1e18 * 100).toFixed(2)}%. Consider splitting the trade.`
    );
  }

  const minPtOut = expectedPtOut - (expectedPtOut * slippageBps) / 10000n;

  if (!isNativeEth) {
    await ensureApproval(tokenIn, PENDLE_ROUTER, amount);
  }

  const effectiveTokenIn = isNativeEth
    ? "0x0000000000000000000000000000000000000000" as const
    : tokenIn;

  const guessPtOut = {
    guessMin: 0n,
    guessMax: expectedPtOut * 2n,
    guessOffchain: expectedPtOut,
    maxIteration: 256n,
    eps: 1_000_000_000_000_000n,
  };

  const tokenInput = {
    tokenIn: effectiveTokenIn,
    netTokenIn: amount,
    tokenMintSy: effectiveTokenIn,
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
    args: [account.address, market, minPtOut, guessPtOut, tokenInput],
    account: account.address,
    ...(isNativeEth ? { value: amount } : {}),
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("swapExactTokenForPt reverted");

  return { hash, netPtOut: result[0] };
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  // Read market state
  const state = await getMarketState(PENDLE_MARKET);
  console.log(`Implied APY: ${(state.impliedApy * 100).toFixed(2)}%`);
  console.log(`Expiry: ${state.expiryDate.toISOString()}`);
  console.log(`Days to expiry: ${state.daysToExpiry.toFixed(1)}`);
  console.log(`SY: ${state.sy}`);
  console.log(`PT: ${state.pt}`);
  console.log(`YT: ${state.yt}`);

  // Read oracle rate
  const oracle = await getOracleRate(PENDLE_MARKET, 900);
  if (oracle.oracleReady) {
    console.log(`PT/Asset TWAP rate: ${oracle.ptToAssetRate.toFixed(6)}`);
  } else {
    console.warn("Oracle not ready. Initialize cardinality first.");
  }

  // Preview buying PT with 1 WETH
  const oneWeth = 1_000_000_000_000_000_000n;
  const preview = await previewBuyPt(PENDLE_MARKET, WETH, oneWeth);
  console.log(`1 WETH -> ${Number(preview.netPtOut) / 1e18} PT`);

  // Buy PT with 1 WETH (1% slippage)
  const { hash, netPtOut } = await buyPtWithToken({
    market: PENDLE_MARKET,
    tokenIn: WETH,
    amount: oneWeth,
    slippageBps: 100n,
  });

  console.log(`Bought ${Number(netPtOut) / 1e18} PT`);
  console.log(`Transaction: ${hash}`);
}

main().catch(console.error);
