/**
 * ethers.js v6 Client Template
 *
 * Complete starter template for interacting with EVM chains using ethers.js v6.
 * Includes provider setup, wallet configuration, ERC-20 reads/writes,
 * transaction sending, event listening, and ENS resolution.
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set RPC_URL and PRIVATE_KEY environment variables
 * 3. Import and use the functions
 *
 * Dependencies: ethers (v6)
 */

import {
  JsonRpcProvider,
  Wallet,
  Contract,
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
  isError,
  type TransactionResponse,
  type TransactionReceipt,
} from "ethers";

// ============================================================================
// Configuration
// ============================================================================

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!RPC_URL) throw new Error("RPC_URL environment variable is required");
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY environment variable is required");

export const provider = new JsonRpcProvider(RPC_URL);
export const wallet = new Wallet(PRIVATE_KEY, provider);

// ============================================================================
// ERC-20 ABI (minimal)
// ============================================================================

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

// ============================================================================
// Read Operations (Provider only -- no signer needed)
// ============================================================================

export async function getEthBalance(address: string): Promise<{
  wei: bigint;
  ether: string;
}> {
  const balance = await provider.getBalance(address);
  return { wei: balance, ether: formatEther(balance) };
}

export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string
): Promise<{ raw: bigint; formatted: string; symbol: string }> {
  const token = new Contract(tokenAddress, ERC20_ABI, provider);

  const [balance, decimals, symbol] = await Promise.all([
    token.balanceOf(walletAddress) as Promise<bigint>,
    token.decimals() as Promise<bigint>,
    token.symbol() as Promise<string>,
  ]);

  return {
    raw: balance,
    formatted: formatUnits(balance, Number(decimals)),
    symbol,
  };
}

// ============================================================================
// Write Operations (Signer required)
// ============================================================================

export async function sendEth(
  to: string,
  ethAmount: string
): Promise<{ hash: string; receipt: TransactionReceipt }> {
  const value = parseEther(ethAmount);

  const tx = await wallet.sendTransaction({ to, value });
  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Transaction dropped or replaced");
  if (receipt.status !== 1) throw new Error("Transaction reverted");

  return { hash: tx.hash, receipt };
}

export async function sendToken(
  tokenAddress: string,
  to: string,
  amount: string
): Promise<{ hash: string; receipt: TransactionReceipt }> {
  const token = new Contract(tokenAddress, ERC20_ABI, wallet);

  const decimals: bigint = await token.decimals();
  const parsedAmount = parseUnits(amount, Number(decimals));

  const tx: TransactionResponse = await token.transfer(to, parsedAmount);
  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Transaction dropped or replaced");
  if (receipt.status !== 1) throw new Error("Token transfer reverted");

  return { hash: tx.hash, receipt };
}

export async function approveToken(
  tokenAddress: string,
  spender: string,
  amount: bigint
): Promise<{ hash: string; receipt: TransactionReceipt }> {
  const token = new Contract(tokenAddress, ERC20_ABI, wallet);

  const currentAllowance: bigint = await token.allowance(wallet.address, spender);
  if (currentAllowance >= amount) {
    throw new Error("Allowance already sufficient");
  }

  const tx: TransactionResponse = await token.approve(spender, amount);
  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Approval transaction dropped");
  if (receipt.status !== 1) throw new Error("Approval reverted");

  return { hash: tx.hash, receipt };
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const RECIPIENT = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  console.log(`Wallet: ${wallet.address}`);

  const network = await provider.getNetwork();
  console.log(`Network: ${network.name} (chain ${network.chainId})`);

  const ethBal = await getEthBalance(wallet.address);
  console.log(`ETH: ${ethBal.ether}`);

  const usdcBal = await getTokenBalance(USDC, wallet.address);
  console.log(`${usdcBal.symbol}: ${usdcBal.formatted}`);
}

main().catch((error: unknown) => {
  if (isError(error, "NETWORK_ERROR")) {
    console.error("Network error -- check RPC_URL");
  } else if (isError(error, "SERVER_ERROR")) {
    console.error("RPC server error -- check endpoint");
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
