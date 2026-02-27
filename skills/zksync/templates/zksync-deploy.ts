/**
 * zkSync Era Deployment Template
 *
 * Starter template for deploying contracts, interacting with paymasters,
 * and bridging assets on zkSync Era.
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set PRIVATE_KEY environment variable
 * 3. Import and use the functions
 *
 * Dependencies:
 *   npm install zksync-ethers ethers
 */

import { Provider, Wallet, Contract, utils } from "zksync-ethers";
import { ethers } from "ethers";

// --- Configuration ---

const ZKSYNC_MAINNET_RPC = "https://mainnet.era.zksync.io";
const ZKSYNC_SEPOLIA_RPC = "https://sepolia.era.zksync.dev";

function getProvider(network: "mainnet" | "sepolia" = "sepolia"): Provider {
  const rpc = network === "mainnet" ? ZKSYNC_MAINNET_RPC : ZKSYNC_SEPOLIA_RPC;
  return new Provider(rpc);
}

function getWallet(
  network: "mainnet" | "sepolia" = "sepolia"
): Wallet {
  const provider = getProvider(network);
  const ethProvider = ethers.getDefaultProvider(
    network === "mainnet" ? "mainnet" : "sepolia"
  );
  return new Wallet(process.env.PRIVATE_KEY!, provider, ethProvider);
}

// --- Deploy Contract ---

async function deployContract(
  wallet: Wallet,
  abi: ethers.InterfaceAbi,
  bytecode: string,
  constructorArgs: unknown[] = []
): Promise<Contract> {
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`Contract deployed to: ${address}`);

  return new Contract(address, abi, wallet);
}

// --- Interact with Paymaster ---

async function sendWithPaymaster(
  wallet: Wallet,
  contractAddress: string,
  abi: ethers.InterfaceAbi,
  functionName: string,
  args: unknown[],
  paymasterAddress: string
): Promise<ethers.TransactionReceipt> {
  const contract = new Contract(contractAddress, abi, wallet);

  const paymasterParams = utils.getPaymasterParams(paymasterAddress, {
    type: "General",
    innerInput: new Uint8Array(),
  });

  const tx = await contract[functionName](...args, {
    customData: {
      paymasterParams,
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  });

  const receipt = await tx.wait();
  console.log(`Sponsored tx: ${receipt.hash}`);
  return receipt;
}

// --- Bridge ETH ---

async function depositETH(
  wallet: Wallet,
  amountEther: string
): Promise<void> {
  const depositTx = await wallet.deposit({
    token: ethers.ZeroAddress,
    amount: ethers.parseEther(amountEther),
  });

  console.log(`L1 deposit tx: ${depositTx.hash}`);
  console.log("Waiting for L2 confirmation...");

  const l2Receipt = await depositTx.waitFinalize();
  console.log(`Deposit confirmed: ${l2Receipt.transactionHash}`);
}

async function withdrawETH(
  wallet: Wallet,
  amountEther: string
): Promise<string> {
  const withdrawTx = await wallet.withdraw({
    token: ethers.ZeroAddress,
    amount: ethers.parseEther(amountEther),
    to: wallet.address,
  });

  const receipt = await withdrawTx.waitFinalize();
  console.log(`Withdrawal initiated: ${receipt.transactionHash}`);
  console.log("Finalize on L1 after ZK proof verification (1-3 hours)");
  return receipt.transactionHash;
}

// --- Utilities ---

async function getBalances(wallet: Wallet): Promise<void> {
  const l2Balance = await wallet.getBalance();
  console.log(`L2 balance: ${ethers.formatEther(l2Balance)} ETH`);

  const l1Balance = await wallet.getBalanceL1();
  console.log(`L1 balance: ${ethers.formatEther(l1Balance)} ETH`);
}

async function estimateGas(
  provider: Provider,
  from: string,
  to: string,
  data: string
): Promise<bigint> {
  const estimate = await provider.estimateGas({
    from,
    to,
    data,
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  });

  const gasPrice = await provider.getGasPrice();
  const totalCost = estimate * gasPrice;
  console.log(`Gas estimate: ${estimate}`);
  console.log(`Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  console.log(`Total cost: ${ethers.formatEther(totalCost)} ETH`);

  return estimate;
}

// --- Main ---

async function main() {
  const wallet = getWallet("sepolia");
  await getBalances(wallet);
}

main().catch(console.error);
