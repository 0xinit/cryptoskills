/**
 * Maker / Sky Protocol Client Template
 *
 * Complete starter template for interacting with MakerDAO vaults,
 * DAI Savings Rate, Sky token migration, and sUSDS using viem.
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set RPC_URL and PRIVATE_KEY environment variables
 * 3. Import and use the functions
 *
 * Dependencies: viem
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
  toHex,
  padHex,
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

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(RPC_URL),
});

// ============================================================================
// Contract Addresses (Ethereum Mainnet -- Last verified: 2025-05-01)
// ============================================================================

const MCD_VAT = "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B" as const;
const CDP_MANAGER = "0x5ef30b9986345249bc32d8928B7ee64DE9435E39" as const;
const MCD_JUG = "0x19c0976f590D67707E62397C87829d896Dc0f1F1" as const;
const MCD_JOIN_DAI = "0x9759A6Ac90977b93B58547b4A71c78317f391A28" as const;
const MCD_JOIN_ETH_A = "0x2F0b23f53734252Bda2277357e97e1517d6B042A" as const;
const MCD_POT = "0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7" as const;
const DSR_MANAGER = "0x373238337Bfe1146fb49989fc222523f83081dDb" as const;
const PROXY_ACTIONS = "0x82ecD135Dce65Fbc6DbdD0e4237E0AF93FFD5038" as const;
const PROXY_REGISTRY = "0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4" as const;
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const;
const USDS = "0xdC035D45d973E3EC169d2276DDab16f1e407384F" as const;
const DAI_USDS = "0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A" as const;
const SUSDS = "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD" as const;

// ============================================================================
// Constants
// ============================================================================

const WAD = 10n ** 18n;
const RAY = 10n ** 27n;
const RAD = 10n ** 45n;

const ETH_A_ILK = "0x4554482d41000000000000000000000000000000000000000000000000000000" as const;

// ============================================================================
// ABIs (minimal)
// ============================================================================

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
] as const;

const daiUsdsAbi = [
  {
    name: "daiToUsds",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "usr", type: "address" },
      { name: "wad", type: "uint256" },
    ],
    outputs: [],
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
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ============================================================================
// Helpers
// ============================================================================

export function encodeIlk(name: string): `0x${string}` {
  return padHex(toHex(name), { size: 32, dir: "right" });
}

async function ensureApproval(
  token: Address,
  spender: Address,
  amount: bigint
): Promise<void> {
  const hash = await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Approval failed for ${token} -> ${spender}`);
  }
}

// ============================================================================
// DSProxy
// ============================================================================

export async function getOrCreateProxy(): Promise<Address> {
  const ZERO = "0x0000000000000000000000000000000000000000" as Address;

  const existing = await publicClient.readContract({
    address: PROXY_REGISTRY,
    abi: proxyRegistryAbi,
    functionName: "proxies",
    args: [account.address],
  });

  if (existing !== ZERO) return existing;

  const { request } = await publicClient.simulateContract({
    address: PROXY_REGISTRY,
    abi: proxyRegistryAbi,
    functionName: "build",
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("DSProxy build reverted");

  return publicClient.readContract({
    address: PROXY_REGISTRY,
    abi: proxyRegistryAbi,
    functionName: "proxies",
    args: [account.address],
  });
}

// ============================================================================
// Vault Operations
// ============================================================================

export async function openEthVault(
  dsProxy: Address,
  ethAmount: bigint,
  daiAmount: bigint
): Promise<`0x${string}`> {
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
  if (receipt.status !== "success") throw new Error("Open vault reverted");

  return hash;
}

export async function getVaultInfo(cdpId: bigint) {
  const [ilk, urn] = await Promise.all([
    publicClient.readContract({ address: CDP_MANAGER, abi: cdpManagerAbi, functionName: "ilks", args: [cdpId] }),
    publicClient.readContract({ address: CDP_MANAGER, abi: cdpManagerAbi, functionName: "urns", args: [cdpId] }),
  ]);

  const [ilkData, urnData] = await Promise.all([
    publicClient.readContract({ address: MCD_VAT, abi: vatAbi, functionName: "ilks", args: [ilk] }),
    publicClient.readContract({ address: MCD_VAT, abi: vatAbi, functionName: "urns", args: [ilk, urn] }),
  ]);

  const ink = urnData[0];
  const art = urnData[1];
  const rate = ilkData[1];
  const debt = art > 0n ? (art * rate + RAY - 1n) / RAY : 0n;

  return { ilk, urn, ink, art, rate, debt };
}

// ============================================================================
// DAI Savings Rate
// ============================================================================

export async function depositToDsr(amount: bigint): Promise<`0x${string}`> {
  await ensureApproval(DAI, DSR_MANAGER, amount);

  const { request } = await publicClient.simulateContract({
    address: DSR_MANAGER,
    abi: dsrManagerAbi,
    functionName: "join",
    args: [account.address, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("DSR deposit reverted");

  return hash;
}

export async function getDsrBalance(user: Address): Promise<bigint> {
  const [pie, chi] = await Promise.all([
    publicClient.readContract({ address: DSR_MANAGER, abi: dsrManagerAbi, functionName: "pieOf", args: [user] }),
    publicClient.readContract({ address: MCD_POT, abi: potAbi, functionName: "chi" }),
  ]);
  return (pie * chi) / RAY;
}

// ============================================================================
// Sky Migration
// ============================================================================

export async function upgradeDaiToUsds(amount: bigint): Promise<`0x${string}`> {
  await ensureApproval(DAI, DAI_USDS, amount);

  const { request } = await publicClient.simulateContract({
    address: DAI_USDS,
    abi: daiUsdsAbi,
    functionName: "daiToUsds",
    args: [account.address, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("DAI->USDS conversion reverted");

  return hash;
}

export async function depositToSusds(amount: bigint): Promise<{
  hash: `0x${string}`;
  shares: bigint;
}> {
  await ensureApproval(USDS, SUSDS, amount);

  const { request, result } = await publicClient.simulateContract({
    address: SUSDS,
    abi: susdsAbi,
    functionName: "deposit",
    args: [amount, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("sUSDS deposit reverted");

  return { hash, shares: result };
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  const dsProxy = await getOrCreateProxy();
  console.log(`DSProxy: ${dsProxy}`);

  // Open ETH-A vault: 5 ETH collateral, draw 2000 DAI
  const vaultHash = await openEthVault(dsProxy, parseEther("5"), parseEther("2000"));
  console.log(`Vault opened: ${vaultHash}`);

  // Deposit 1000 DAI to DSR
  const dsrHash = await depositToDsr(parseEther("1000"));
  console.log(`DSR deposit: ${dsrHash}`);

  // Check DSR balance
  const dsrBalance = await getDsrBalance(account.address);
  console.log(`DSR balance: ${formatEther(dsrBalance)} DAI`);

  // Upgrade remaining 1000 DAI to USDS
  const upgradeHash = await upgradeDaiToUsds(parseEther("1000"));
  console.log(`Upgraded to USDS: ${upgradeHash}`);

  // Deposit USDS to sUSDS for yield
  const { hash: susdsHash, shares } = await depositToSusds(parseEther("1000"));
  console.log(`sUSDS deposit: ${susdsHash}, shares: ${shares}`);
}

main().catch(console.error);
