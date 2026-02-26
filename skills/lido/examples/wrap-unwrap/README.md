# wstETH Wrapping and Unwrapping

wstETH is a non-rebasing wrapper around stETH shares. Use wstETH in DeFi protocols, vaults, and any contract that stores token balances.

## Setup

```typescript
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const LIDO = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as const;
const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as const;

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
]);

const WSTETH_ABI = parseAbi([
  "function wrap(uint256 _stETHAmount) external returns (uint256)",
  "function unwrap(uint256 _wstETHAmount) external returns (uint256)",
  "function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256)",
  "function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256)",
  "function stEthPerToken() external view returns (uint256)",
  "function tokensPerStEth() external view returns (uint256)",
]);

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});
```

## Approve stETH for wstETH Contract

stETH must be approved before wrapping. Due to rebasing, the actual transferred amount may differ by 1-2 wei from the approved amount. Approve slightly more than needed.

```typescript
async function approveStethForWrap(amount: bigint) {
  const currentAllowance = await publicClient.readContract({
    address: LIDO,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, WSTETH],
  });

  if (currentAllowance >= amount) return null;

  const hash = await walletClient.writeContract({
    address: LIDO,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [WSTETH, amount],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Approve tx reverted");

  return hash;
}
```

## Wrap stETH to wstETH

```typescript
async function wrapSteth(stEthAmount: bigint) {
  await approveStethForWrap(stEthAmount);

  const { request } = await publicClient.simulateContract({
    address: WSTETH,
    abi: WSTETH_ABI,
    functionName: "wrap",
    args: [stEthAmount],
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Wrap tx reverted");

  return hash;
}
```

## Unwrap wstETH to stETH

No approval needed. wstETH burns your tokens and returns the underlying stETH.

```typescript
async function unwrapWsteth(wstEthAmount: bigint) {
  const { request } = await publicClient.simulateContract({
    address: WSTETH,
    abi: WSTETH_ABI,
    functionName: "unwrap",
    args: [wstEthAmount],
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Unwrap tx reverted");

  return hash;
}
```

## When to Use wstETH vs stETH

| Use Case | Token | Why |
|----------|-------|-----|
| DeFi collateral (Aave, Maker) | wstETH | Non-rebasing; stored balances stay accurate |
| Yield vaults | wstETH | Vault accounting requires stable balances |
| Cross-chain bridging | wstETH | Rebasing does not work across bridges |
| Simple staking / holding | stETH | Balance automatically reflects rewards |
| Liquidity pools | Depends | Curve stETH/ETH uses stETH; most others use wstETH |

## stETH per wstETH Rate

The exchange rate drifts upward over time as staking rewards accumulate. 1 wstETH is always worth more than 1 stETH.

```typescript
async function getExchangeRate() {
  const stEthPerWstEth = await publicClient.readContract({
    address: WSTETH,
    abi: WSTETH_ABI,
    functionName: "stEthPerToken",
  });

  const wstEthPerStEth = await publicClient.readContract({
    address: WSTETH,
    abi: WSTETH_ABI,
    functionName: "tokensPerStEth",
  });

  console.log(`1 wstETH = ${formatEther(stEthPerWstEth)} stETH`);
  console.log(`1 stETH  = ${formatEther(wstEthPerStEth)} wstETH`);

  return { stEthPerWstEth, wstEthPerStEth };
}

async function convertAmounts(amount: bigint) {
  const [asStEth, asWstEth] = await Promise.all([
    publicClient.readContract({
      address: WSTETH,
      abi: WSTETH_ABI,
      functionName: "getStETHByWstETH",
      args: [amount],
    }),
    publicClient.readContract({
      address: WSTETH,
      abi: WSTETH_ABI,
      functionName: "getWstETHByStETH",
      args: [amount],
    }),
  ]);

  console.log(`${formatEther(amount)} wstETH = ${formatEther(asStEth)} stETH`);
  console.log(`${formatEther(amount)} stETH  = ${formatEther(asWstEth)} wstETH`);

  return { asStEth, asWstEth };
}
```

## Key Points

- wstETH = stETH shares. Wrapping and unwrapping is lossless (no fee).
- wstETH balance does NOT change on oracle reports. Rewards are reflected in the increasing exchange rate.
- Approve stETH before calling `wrap()`. The `unwrap()` function needs no approval.
- Due to stETH rounding, `wrap()` may receive 1-2 wei less stETH than approved. Approve slightly above the exact amount if this matters.
- The wstETH contract address is the same on mainnet. L2 wstETH is bridged and has different addresses per chain.
