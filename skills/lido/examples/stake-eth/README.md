# Staking ETH with Lido

Submit ETH to the Lido protocol and receive stETH, a rebasing liquid staking token.

## Setup

```typescript
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const LIDO = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as const;

const LIDO_ABI = parseAbi([
  "function submit(address _referral) external payable returns (uint256)",
  "function balanceOf(address _account) external view returns (uint256)",
  "function sharesOf(address _account) external view returns (uint256)",
  "function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256)",
  "function getSharesByPooledEth(uint256 _ethAmount) external view returns (uint256)",
  "function getTotalPooledEther() external view returns (uint256)",
  "function getTotalShares() external view returns (uint256)",
  "function getCurrentStakeLimit() external view returns (uint256)",
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

## Submit ETH via Lido.submit()

The canonical staking method. Returns shares minted, not stETH amount.

```typescript
async function stakeEth(amountEth: string) {
  const value = parseEther(amountEth);

  // Check staking limit before submitting
  const stakeLimit = await publicClient.readContract({
    address: LIDO,
    abi: LIDO_ABI,
    functionName: "getCurrentStakeLimit",
  });

  if (value > stakeLimit) {
    throw new Error(`Amount exceeds daily stake limit: ${formatEther(stakeLimit)} ETH`);
  }

  const { request } = await publicClient.simulateContract({
    address: LIDO,
    abi: LIDO_ABI,
    functionName: "submit",
    args: ["0x0000000000000000000000000000000000000000"],
    value,
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Stake tx reverted");

  return hash;
}
```

## Stake by Sending ETH Directly

The stETH contract accepts plain ETH transfers. Equivalent to `submit(address(0))`.

```typescript
async function stakeEthDirect(amountEth: string) {
  const hash = await walletClient.sendTransaction({
    to: LIDO,
    value: parseEther(amountEth),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Stake tx reverted");

  return hash;
}
```

## Reading stETH Balance

stETH is a rebasing token. `balanceOf` returns a derived value that changes daily when the oracle reports. Do not store this value for later comparison.

```typescript
async function getStethBalance(address: `0x${string}`) {
  const balance = await publicClient.readContract({
    address: LIDO,
    abi: LIDO_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  console.log(`stETH balance: ${formatEther(balance)}`);
  return balance;
}
```

## Shares vs stETH Balance

Shares are the canonical internal unit. stETH balances are derived:

`balanceOf(account) = shares[account] * totalPooledEther / totalShares`

Shares do not change on rebase. The stETH balance changes because `totalPooledEther` grows as rewards accrue.

```typescript
async function getSharesAndBalance(address: `0x${string}`) {
  const [shares, balance, totalPooledEther, totalShares] = await Promise.all([
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "sharesOf",
      args: [address],
    }),
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "balanceOf",
      args: [address],
    }),
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "getTotalPooledEther",
    }),
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "getTotalShares",
    }),
  ]);

  // Verify the relationship: balance = shares * totalPooledEther / totalShares
  const derivedBalance = (shares * totalPooledEther) / totalShares;

  console.log(`Shares:           ${shares}`);
  console.log(`stETH balance:    ${formatEther(balance)}`);
  console.log(`Derived balance:  ${formatEther(derivedBalance)}`);
  // Difference is 0-1 wei due to integer division rounding
  console.log(`Rounding diff:    ${balance - derivedBalance} wei`);

  return { shares, balance, totalPooledEther, totalShares };
}
```

## Share Rate and Rewards

The share rate tells you how much ETH one share is worth. It increases over time as staking rewards are reported.

```typescript
async function getShareRate() {
  // getPooledEthByShares(1e18) returns the ETH value of 1 share (scaled to 18 decimals)
  const ethPerShare = await publicClient.readContract({
    address: LIDO,
    abi: LIDO_ABI,
    functionName: "getPooledEthByShares",
    args: [10n ** 18n],
  });

  // At launch, 1 share = 1 ETH. Over time this grows (e.g., 1.05 ETH).
  console.log(`1 share = ${formatEther(ethPerShare)} ETH`);

  return ethPerShare;
}
```

## Key Points

- `submit()` requires a referral address parameter. Pass `address(0)` if you have no referral.
- The return value of `submit()` is shares minted, not stETH amount.
- stETH balance updates happen on oracle report (typically once per day).
- Daily staking limit exists. Check `getCurrentStakeLimit()` before large deposits.
- Sending ETH directly to the stETH contract is equivalent to calling `submit(address(0))`.
