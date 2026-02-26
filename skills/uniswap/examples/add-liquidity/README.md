# Add Liquidity Examples

Working TypeScript examples for managing Uniswap V3 concentrated liquidity positions via NonfungiblePositionManager using viem.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
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

const NFT_POSITION_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
```

## ABIs

```typescript
const nftManagerAbi = parseAbi([
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function increaseLiquidity((uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) payable returns (uint256 amount0, uint256 amount1)",
  "function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) payable returns (uint256 amount0, uint256 amount1)",
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);
```

## Creating a New Position

Positions require a tick range aligned to the pool's tick spacing. For the 0.05% (500) fee tier, tick spacing is 10.

```typescript
async function createPosition(
  token0: Address,
  token1: Address,
  fee: number,
  tickLower: number,
  tickUpper: number,
  amount0Desired: bigint,
  amount1Desired: bigint,
  slippageBps: bigint
): Promise<{ tokenId: bigint; liquidity: bigint; amount0: bigint; amount1: bigint }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  // token0 must be numerically less than token1
  // USDC (0xA0b8...) > WETH (0xC024...) is FALSE -- WETH is token0 in this pair
  // Always verify token ordering for the specific pair

  // Approve NonfungiblePositionManager for both tokens
  for (const [token, amount] of [[token0, amount0Desired], [token1, amount1Desired]] as const) {
    const { request } = await publicClient.simulateContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [NFT_POSITION_MANAGER, amount],
      account: account.address,
    });
    const hash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });
  }

  // Slippage protection on deposited amounts
  const amount0Min = amount0Desired - (amount0Desired * slippageBps) / 10000n;
  const amount1Min = amount1Desired - (amount1Desired * slippageBps) / 10000n;

  const { request, result } = await publicClient.simulateContract({
    address: NFT_POSITION_MANAGER,
    abi: nftManagerAbi,
    functionName: "mint",
    args: [
      {
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        recipient: account.address,
        deadline,
      },
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Mint position reverted");

  const [tokenId, liquidity, amount0, amount1] = result;
  return { tokenId, liquidity, amount0, amount1 };
}

// WETH/USDC 0.05% pool -- tick spacing is 10
// These ticks represent a ~$1800-$2200 range (illustrative, adjust to current price)
const result = await createPosition(
  WETH,
  USDC,
  500,
  -202200, // tickLower -- must be divisible by 10
  -197800, // tickUpper -- must be divisible by 10
  500_000_000_000_000_000n, // 0.5 WETH
  1_000_000_000n,           // 1000 USDC (6 decimals)
  100n                      // 1% slippage
);

console.log(`Position NFT ID: ${result.tokenId}`);
console.log(`Liquidity added: ${result.liquidity}`);
```

## Adding Liquidity to Existing Position

```typescript
async function increaseLiquidity(
  tokenId: bigint,
  amount0Desired: bigint,
  amount1Desired: bigint,
  slippageBps: bigint
): Promise<{ liquidity: bigint; amount0: bigint; amount1: bigint }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  // Read position to get token addresses for approval
  const position = await publicClient.readContract({
    address: NFT_POSITION_MANAGER,
    abi: nftManagerAbi,
    functionName: "positions",
    args: [tokenId],
  });

  const token0 = position[2] as Address;
  const token1 = position[3] as Address;

  for (const [token, amount] of [[token0, amount0Desired], [token1, amount1Desired]] as const) {
    const { request } = await publicClient.simulateContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [NFT_POSITION_MANAGER, amount],
      account: account.address,
    });
    await walletClient.writeContract(request);
  }

  const amount0Min = amount0Desired - (amount0Desired * slippageBps) / 10000n;
  const amount1Min = amount1Desired - (amount1Desired * slippageBps) / 10000n;

  const { request, result } = await publicClient.simulateContract({
    address: NFT_POSITION_MANAGER,
    abi: nftManagerAbi,
    functionName: "increaseLiquidity",
    args: [
      {
        tokenId,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        deadline,
      },
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Increase liquidity reverted");

  const [liquidity, amount0, amount1] = result;
  return { liquidity, amount0, amount1 };
}
```

## Collecting Fees

Accrued fees are collected separately from the position's liquidity. Pass `type(uint128).max` to collect all available fees.

```typescript
async function collectFees(
  tokenId: bigint
): Promise<{ amount0: bigint; amount1: bigint }> {
  const MAX_UINT128 = 2n ** 128n - 1n;

  const { request, result } = await publicClient.simulateContract({
    address: NFT_POSITION_MANAGER,
    abi: nftManagerAbi,
    functionName: "collect",
    args: [
      {
        tokenId,
        recipient: account.address,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      },
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Collect fees reverted");

  const [amount0, amount1] = result;
  return { amount0, amount1 };
}
```

## Removing Liquidity

Removing liquidity is a two-step process: `decreaseLiquidity` converts liquidity to token amounts owed, then `collect` withdraws those tokens.

```typescript
async function removeLiquidity(
  tokenId: bigint,
  liquidityToRemove: bigint,
  slippageBps: bigint
): Promise<{ amount0: bigint; amount1: bigint }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  // Step 1: Decrease liquidity (tokens become "owed" but not withdrawn)
  const { request: decreaseRequest, result: decreaseResult } =
    await publicClient.simulateContract({
      address: NFT_POSITION_MANAGER,
      abi: nftManagerAbi,
      functionName: "decreaseLiquidity",
      args: [
        {
          tokenId,
          liquidity: liquidityToRemove,
          amount0Min: 0n, // Set properly below
          amount1Min: 0n,
          deadline,
        },
      ],
      account: account.address,
    });

  // Use simulated amounts for slippage bounds
  const [simAmount0, simAmount1] = decreaseResult;
  const amount0Min = simAmount0 - (simAmount0 * slippageBps) / 10000n;
  const amount1Min = simAmount1 - (simAmount1 * slippageBps) / 10000n;

  // Re-simulate with proper minimums
  const { request: finalRequest } = await publicClient.simulateContract({
    address: NFT_POSITION_MANAGER,
    abi: nftManagerAbi,
    functionName: "decreaseLiquidity",
    args: [
      {
        tokenId,
        liquidity: liquidityToRemove,
        amount0Min,
        amount1Min,
        deadline,
      },
    ],
    account: account.address,
  });

  let hash = await walletClient.writeContract(finalRequest);
  let receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Decrease liquidity reverted");

  // Step 2: Collect the owed tokens (plus any accrued fees)
  const { amount0, amount1 } = await collectFees(tokenId);
  return { amount0, amount1 };
}
```

## Reading Position Details

```typescript
async function getPositionInfo(tokenId: bigint) {
  const position = await publicClient.readContract({
    address: NFT_POSITION_MANAGER,
    abi: nftManagerAbi,
    functionName: "positions",
    args: [tokenId],
  });

  return {
    nonce: position[0],
    operator: position[1],
    token0: position[2],
    token1: position[3],
    fee: position[4],
    tickLower: position[5],
    tickUpper: position[6],
    liquidity: position[7],
    feeGrowthInside0LastX128: position[8],
    feeGrowthInside1LastX128: position[9],
    tokensOwed0: position[10],
    tokensOwed1: position[11],
  };
}
```
