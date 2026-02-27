# DAI Savings Rate (DSR) and USDS Savings Rate (sUSDS)

Deposit DAI into the DSR via DsrManager, or deposit USDS into the sUSDS ERC-4626 vault. Covers both the legacy DSR and the new Sky savings system.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
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

const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const;
const USDS = "0xdC035D45d973E3EC169d2276DDab16f1e407384F" as const;
const DSR_MANAGER = "0x373238337Bfe1146fb49989fc222523f83081dDb" as const;
const MCD_POT = "0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7" as const;
const SUSDS = "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD" as const;

const RAY = 10n ** 27n;
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
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const dsrManagerAbi = [
  {
    name: "join",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dst", type: "address" },
      { name: "wad", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "exit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dst", type: "address" },
      { name: "wad", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "exitAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "dst", type: "address" }],
    outputs: [],
  },
  {
    name: "pieOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "usr", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const potAbi = [
  {
    name: "chi",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "dsr",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "rho",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const susdsAbi = [
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
    name: "convertToAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

## Read DSR APY

```typescript
async function getDsrApy(): Promise<number> {
  const dsr = await publicClient.readContract({
    address: MCD_POT,
    abi: potAbi,
    functionName: "dsr",
  });

  // dsr is per-second rate in ray (10^27). 1.0 = no yield.
  // APY = dsr^(seconds_per_year) - 1
  const dsrFloat = Number(dsr) / Number(RAY);
  return (Math.pow(dsrFloat, 31536000) - 1) * 100;
}
```

## Deposit DAI to DSR

```typescript
async function depositDaiToDsr(
  amount: bigint
): Promise<`0x${string}`> {
  // Approve DsrManager to pull DAI
  const approveHash = await walletClient.writeContract({
    address: DAI,
    abi: erc20Abi,
    functionName: "approve",
    args: [DSR_MANAGER, amount],
  });
  const approveReceipt = await publicClient.waitForTransactionReceipt({
    hash: approveHash,
  });
  if (approveReceipt.status !== "success") {
    throw new Error("DAI approval for DsrManager failed");
  }

  // Deposit into DSR
  const { request } = await publicClient.simulateContract({
    address: DSR_MANAGER,
    abi: dsrManagerAbi,
    functionName: "join",
    args: [account.address, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("DSR deposit reverted");
  }

  return hash;
}
```

## Read DSR Balance

```typescript
async function getDsrBalance(user: Address): Promise<bigint> {
  const [pie, chi] = await Promise.all([
    publicClient.readContract({
      address: DSR_MANAGER,
      abi: dsrManagerAbi,
      functionName: "pieOf",
      args: [user],
    }),
    publicClient.readContract({
      address: MCD_POT,
      abi: potAbi,
      functionName: "chi",
    }),
  ]);

  // pie is normalized savings (wad), chi is accumulated rate (ray)
  // DAI balance = pie * chi / RAY
  return (pie * chi) / RAY;
}
```

## Withdraw from DSR

```typescript
async function withdrawFromDsr(
  amount: bigint
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: DSR_MANAGER,
    abi: dsrManagerAbi,
    functionName: "exit",
    args: [account.address, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("DSR withdrawal reverted");
  }

  return hash;
}

async function withdrawAllFromDsr(): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: DSR_MANAGER,
    abi: dsrManagerAbi,
    functionName: "exitAll",
    args: [account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("DSR full withdrawal reverted");
  }

  return hash;
}
```

## Deposit USDS to sUSDS (Sky Savings)

```typescript
async function depositUsdsToSusds(
  amount: bigint
): Promise<{ hash: `0x${string}`; shares: bigint }> {
  // Approve sUSDS vault
  const approveHash = await walletClient.writeContract({
    address: USDS,
    abi: erc20Abi,
    functionName: "approve",
    args: [SUSDS, amount],
  });
  const approveReceipt = await publicClient.waitForTransactionReceipt({
    hash: approveHash,
  });
  if (approveReceipt.status !== "success") {
    throw new Error("USDS approval for sUSDS failed");
  }

  // Deposit via ERC-4626 interface
  const { request, result } = await publicClient.simulateContract({
    address: SUSDS,
    abi: susdsAbi,
    functionName: "deposit",
    args: [amount, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("sUSDS deposit reverted");
  }

  return { hash, shares: result };
}
```

## Read sUSDS Position

```typescript
async function getSusdsPosition(user: Address) {
  const shares = await publicClient.readContract({
    address: SUSDS,
    abi: susdsAbi,
    functionName: "balanceOf",
    args: [user],
  });

  if (shares === 0n) {
    return { shares: 0n, usdsValue: 0n };
  }

  const usdsValue = await publicClient.readContract({
    address: SUSDS,
    abi: susdsAbi,
    functionName: "convertToAssets",
    args: [shares],
  });

  return { shares, usdsValue };
}
```

## Redeem from sUSDS

```typescript
async function redeemAllSusds(): Promise<{
  hash: `0x${string}`;
  usdsReceived: bigint;
}> {
  const shares = await publicClient.readContract({
    address: SUSDS,
    abi: susdsAbi,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (shares === 0n) {
    throw new Error("No sUSDS shares to redeem");
  }

  const { request, result } = await publicClient.simulateContract({
    address: SUSDS,
    abi: susdsAbi,
    functionName: "redeem",
    args: [shares, account.address, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("sUSDS redeem reverted");
  }

  return { hash, usdsReceived: result };
}
```

## Complete Usage

```typescript
async function main() {
  // Check DSR APY
  const dsrApy = await getDsrApy();
  console.log(`DSR APY: ${dsrApy.toFixed(2)}%`);

  // Option A: Deposit DAI to legacy DSR
  const daiAmount = parseEther("10000");
  const dsrHash = await depositDaiToDsr(daiAmount);
  console.log(`Deposited to DSR: ${dsrHash}`);

  const dsrBalance = await getDsrBalance(account.address);
  console.log(`DSR balance: ${formatEther(dsrBalance)} DAI`);

  // Option B: Deposit USDS to sUSDS (new Sky system)
  const usdsAmount = parseEther("10000");
  const { hash: susdsHash, shares } = await depositUsdsToSusds(usdsAmount);
  console.log(`Deposited to sUSDS: ${susdsHash}, shares: ${shares}`);

  const position = await getSusdsPosition(account.address);
  console.log(`sUSDS value: ${formatEther(position.usdsValue)} USDS`);

  // Withdraw all from DSR
  const withdrawHash = await withdrawAllFromDsr();
  console.log(`Withdrew from DSR: ${withdrawHash}`);

  // Redeem all from sUSDS
  const { hash: redeemHash, usdsReceived } = await redeemAllSusds();
  console.log(`Redeemed from sUSDS: ${redeemHash}, received: ${formatEther(usdsReceived)} USDS`);
}

main().catch(console.error);
```
