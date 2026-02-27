# Open a Maker Vault and Generate DAI

Open an ETH-A vault, deposit ETH collateral, and generate (draw) DAI in a single transaction using DSProxy + DssProxyActions. Includes reading vault state and closing the vault.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
  encodeFunctionData,
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

const CDP_MANAGER = "0x5ef30b9986345249bc32d8928B7ee64DE9435E39" as const;
const MCD_JUG = "0x19c0976f590D67707E62397C87829d896Dc0f1F1" as const;
const MCD_VAT = "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B" as const;
const MCD_JOIN_ETH_A = "0x2F0b23f53734252Bda2277357e97e1517d6B042A" as const;
const MCD_JOIN_DAI = "0x9759A6Ac90977b93B58547b4A71c78317f391A28" as const;
const PROXY_ACTIONS = "0x82ecD135Dce65Fbc6DbdD0e4237E0AF93FFD5038" as const;
const PROXY_REGISTRY = "0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4" as const;

const ETH_A_ILK = "0x4554482d41000000000000000000000000000000000000000000000000000000" as const;
```

## ABIs

```typescript
const proxyRegistryAbi = [
  {
    name: "proxies",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "build",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "proxy", type: "address" }],
  },
] as const;

const dsProxyAbi = [
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_target", type: "address" },
      { name: "_data", type: "bytes" },
    ],
    outputs: [{ name: "response", type: "bytes32" }],
  },
] as const;

const proxyActionsAbi = [
  {
    name: "openLockETHAndDraw",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "manager", type: "address" },
      { name: "jug", type: "address" },
      { name: "ethJoin", type: "address" },
      { name: "daiJoin", type: "address" },
      { name: "ilk", type: "bytes32" },
      { name: "wadD", type: "uint256" },
    ],
    outputs: [{ name: "cdp", type: "uint256" }],
  },
  {
    name: "wipeAllAndFreeETH",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "manager", type: "address" },
      { name: "ethJoin", type: "address" },
      { name: "daiJoin", type: "address" },
      { name: "cdp", type: "uint256" },
      { name: "wadC", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const cdpManagerAbi = [
  {
    name: "ilks",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "cdpId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "urns",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "cdpId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const vatAbi = [
  {
    name: "urns",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "ilk", type: "bytes32" },
      { name: "urn", type: "address" },
    ],
    outputs: [
      { name: "ink", type: "uint256" },
      { name: "art", type: "uint256" },
    ],
  },
  {
    name: "ilks",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "ilk", type: "bytes32" }],
    outputs: [
      { name: "Art", type: "uint256" },
      { name: "rate", type: "uint256" },
      { name: "spot", type: "uint256" },
      { name: "line", type: "uint256" },
      { name: "dust", type: "uint256" },
    ],
  },
] as const;
```

## Get or Create DSProxy

```typescript
async function getOrCreateProxy(): Promise<Address> {
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

  const existing = await publicClient.readContract({
    address: PROXY_REGISTRY,
    abi: proxyRegistryAbi,
    functionName: "proxies",
    args: [account.address],
  });

  if (existing !== ZERO_ADDRESS) return existing;

  const { request } = await publicClient.simulateContract({
    address: PROXY_REGISTRY,
    abi: proxyRegistryAbi,
    functionName: "build",
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("DSProxy creation reverted");

  return publicClient.readContract({
    address: PROXY_REGISTRY,
    abi: proxyRegistryAbi,
    functionName: "proxies",
    args: [account.address],
  });
}
```

## Open Vault, Lock ETH, Draw DAI

```typescript
async function openVaultLockEthDrawDai(
  dsProxy: Address,
  ethAmount: bigint,
  daiAmount: bigint
): Promise<{ hash: `0x${string}` }> {
  const calldata = encodeFunctionData({
    abi: proxyActionsAbi,
    functionName: "openLockETHAndDraw",
    args: [CDP_MANAGER, MCD_JUG, MCD_JOIN_ETH_A, MCD_JOIN_DAI, ETH_A_ILK, daiAmount],
  });

  const { request } = await publicClient.simulateContract({
    address: dsProxy,
    abi: dsProxyAbi,
    functionName: "execute",
    args: [PROXY_ACTIONS, calldata],
    value: ethAmount,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("openLockETHAndDraw reverted");
  }

  return { hash };
}
```

## Read Vault State

```typescript
async function readVaultState(cdpId: bigint) {
  const RAY = 10n ** 27n;

  const [ilk, urn] = await Promise.all([
    publicClient.readContract({
      address: CDP_MANAGER,
      abi: cdpManagerAbi,
      functionName: "ilks",
      args: [cdpId],
    }),
    publicClient.readContract({
      address: CDP_MANAGER,
      abi: cdpManagerAbi,
      functionName: "urns",
      args: [cdpId],
    }),
  ]);

  const [ilkData, urnData] = await Promise.all([
    publicClient.readContract({
      address: MCD_VAT,
      abi: vatAbi,
      functionName: "ilks",
      args: [ilk],
    }),
    publicClient.readContract({
      address: MCD_VAT,
      abi: vatAbi,
      functionName: "urns",
      args: [ilk, urn],
    }),
  ]);

  const ink = urnData[0];
  const art = urnData[1];
  const rate = ilkData[1];
  const spot = ilkData[2];

  // Actual debt in wad (round up)
  const debt = art > 0n ? (art * rate + RAY - 1n) / RAY : 0n;
  // Collateral value in wad
  const collateralValue = (ink * spot) / RAY;

  return {
    ink: formatEther(ink),
    debt: formatEther(debt),
    collateralValue: formatEther(collateralValue),
    collateralizationRatio: debt > 0n
      ? Number(collateralValue * 10000n / (art * rate / RAY)) / 100
      : Infinity,
  };
}
```

## Close Vault (Repay All + Withdraw)

```typescript
async function closeVault(
  dsProxy: Address,
  cdpId: bigint,
  ethToWithdraw: bigint,
  daiApprovalAmount: bigint
): Promise<{ hash: `0x${string}` }> {
  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const;

  // Approve DSProxy to spend DAI for debt repayment
  const approveHash = await walletClient.writeContract({
    address: DAI,
    abi: [
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
    ] as const,
    functionName: "approve",
    args: [dsProxy, daiApprovalAmount],
  });
  const approveReceipt = await publicClient.waitForTransactionReceipt({
    hash: approveHash,
  });
  if (approveReceipt.status !== "success") {
    throw new Error("DAI approval reverted");
  }

  const calldata = encodeFunctionData({
    abi: proxyActionsAbi,
    functionName: "wipeAllAndFreeETH",
    args: [CDP_MANAGER, MCD_JOIN_ETH_A, MCD_JOIN_DAI, cdpId, ethToWithdraw],
  });

  const { request } = await publicClient.simulateContract({
    address: dsProxy,
    abi: dsProxyAbi,
    functionName: "execute",
    args: [PROXY_ACTIONS, calldata],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("wipeAllAndFreeETH reverted");
  }

  return { hash };
}
```

## Complete Usage

```typescript
async function main() {
  const dsProxy = await getOrCreateProxy();
  console.log(`DSProxy: ${dsProxy}`);

  const ethAmount = parseEther("10");
  const daiAmount = parseEther("5000"); // DAI is 18 decimals

  // Open vault
  const { hash } = await openVaultLockEthDrawDai(dsProxy, ethAmount, daiAmount);
  console.log(`Vault opened: ${hash}`);

  // Read state (you need the cdpId from events or CdpManager.last(dsProxy))
  // For this example, assume cdpId is known
  const cdpId = 12345n; // replace with actual
  const state = await readVaultState(cdpId);
  console.log(`Collateral: ${state.ink} ETH`);
  console.log(`Debt: ${state.debt} DAI`);
  console.log(`Collateralization: ${state.collateralizationRatio}%`);

  // Close vault -- approve extra DAI to cover accrued stability fees
  const daiApproval = parseEther("5100"); // 2% buffer for fees
  const { hash: closeHash } = await closeVault(dsProxy, cdpId, ethAmount, daiApproval);
  console.log(`Vault closed: ${closeHash}`);
}

main().catch(console.error);
```
