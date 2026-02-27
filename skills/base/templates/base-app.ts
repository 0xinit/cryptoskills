/**
 * Base App Starter Template
 *
 * Complete setup for building on Base with viem:
 * - Public and wallet clients for Base Mainnet and Sepolia
 * - Sponsored transaction helper (Coinbase Paymaster)
 * - Bridge ETH helper (L1 -> L2)
 * - Gas estimation including L1 data fee
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set environment variables: PRIVATE_KEY, CDP_API_KEY
 * 3. Import and use the functions
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
  type Chain,
} from 'viem';
import { base, baseSepolia, mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ============================================================================
// Configuration
// ============================================================================

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const CDP_API_KEY = process.env.CDP_API_KEY;

if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable is required');
}

const NETWORK: 'mainnet' | 'testnet' = 'testnet';

const BASE_CHAIN: Chain = NETWORK === 'mainnet' ? base : baseSepolia;

const account = privateKeyToAccount(PRIVATE_KEY);

// ============================================================================
// Clients
// ============================================================================

export const publicClient: PublicClient = createPublicClient({
  chain: BASE_CHAIN,
  transport: http(),
});

export const walletClient: WalletClient = createWalletClient({
  chain: BASE_CHAIN,
  transport: http(),
  account,
});

// L1 client (for bridging)
export const l1PublicClient: PublicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// ============================================================================
// Contract Constants
// ============================================================================

// OP Stack predeploys (same on all OP chains)
const GAS_PRICE_ORACLE = '0x420000000000000000000000000000000000000F' as const;
const L2_STANDARD_BRIDGE = '0x4200000000000000000000000000000000000010' as const;
const L2_TO_L1_MESSAGE_PASSER = '0x4200000000000000000000000000000000000016' as const;

// L1 contracts (Base Mainnet)
const OPTIMISM_PORTAL = '0x49048044D57e1C92A77f79988d21Fa8fAF36f97B' as const;

// ERC-4337
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const;

// Tokens
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const WETH_BASE = '0x4200000000000000000000000000000000000006' as const;

// ============================================================================
// Gas Estimation
// ============================================================================

const gasPriceOracleAbi = [
  {
    name: 'getL1Fee',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_data', type: 'bytes' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'baseFeeScalar',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint32' }],
  },
] as const;

/**
 * Estimate the L1 data fee for serialized transaction data.
 * This is the dominant cost component on Base.
 */
export async function estimateL1DataFee(txData: `0x${string}`): Promise<bigint> {
  const l1Fee = await publicClient.readContract({
    address: GAS_PRICE_ORACLE,
    abi: gasPriceOracleAbi,
    functionName: 'getL1Fee',
    args: [txData],
  });
  return l1Fee;
}

/**
 * Estimate total transaction cost (L2 execution + L1 data fee).
 */
export async function estimateTotalCost(params: {
  to: Address;
  data?: `0x${string}`;
  value?: bigint;
}): Promise<{ l2Gas: bigint; l1DataFee: bigint; totalWei: bigint; totalEth: string }> {
  const l2Gas = await publicClient.estimateGas({
    account: account.address,
    to: params.to,
    data: params.data,
    value: params.value,
  });

  const gasPrice = await publicClient.getGasPrice();
  const l2Fee = l2Gas * gasPrice;

  // L1 data fee requires serialized tx bytes
  const l1DataFee = params.data
    ? await estimateL1DataFee(params.data)
    : 0n;

  const totalWei = l2Fee + l1DataFee;

  return {
    l2Gas,
    l1DataFee,
    totalWei,
    totalEth: formatEther(totalWei),
  };
}

// ============================================================================
// Sponsored Transaction (Paymaster)
// ============================================================================

/**
 * Request paymaster sponsorship for a UserOperation.
 * Requires a valid CDP API key with paymaster enabled.
 */
export async function requestPaymasterData(userOp: {
  sender: Address;
  nonce: `0x${string}`;
  callData: `0x${string}`;
  callGasLimit: `0x${string}`;
  verificationGasLimit: `0x${string}`;
  preVerificationGas: `0x${string}`;
  maxFeePerGas: `0x${string}`;
  maxPriorityFeePerGas: `0x${string}`;
}): Promise<{ paymasterAndData: `0x${string}` }> {
  if (!CDP_API_KEY) {
    throw new Error('CDP_API_KEY required for paymaster');
  }

  const paymasterUrl = `https://api.developer.coinbase.com/rpc/v1/${
    NETWORK === 'mainnet' ? 'base' : 'base-sepolia'
  }/${CDP_API_KEY}`;

  const response = await fetch(paymasterUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterStubData',
      params: [
        userOp,
        ENTRY_POINT_V07,
        `0x${BASE_CHAIN.id.toString(16)}`,
      ],
    }),
  });

  const { result, error } = await response.json();
  if (error) {
    throw new Error(`Paymaster error: ${JSON.stringify(error)}`);
  }
  return result;
}

// ============================================================================
// Bridge Helpers
// ============================================================================

/**
 * Bridge ETH from Ethereum L1 to Base L2.
 * Sends ETH to the OptimismPortal on L1.
 * ETH arrives on Base in ~1-5 minutes.
 */
export async function bridgeEthToBase(
  amountEth: string,
  l1WalletClient: WalletClient
): Promise<Hash> {
  if (!l1WalletClient.account) {
    throw new Error('L1 wallet client must have an account');
  }

  const hash = await l1WalletClient.sendTransaction({
    to: OPTIMISM_PORTAL,
    value: parseEther(amountEth),
    chain: mainnet,
  });

  return hash;
}

/**
 * Initiate ETH withdrawal from Base L2 to Ethereum L1.
 * This is step 1 of a multi-step process:
 * 1. Initiate (this function)
 * 2. Wait ~1 hour for state root
 * 3. Prove on L1
 * 4. Wait 7 days (challenge period)
 * 5. Finalize on L1
 */
export async function initiateWithdrawalToL1(
  amountEth: string,
  recipient: Address
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: L2_TO_L1_MESSAGE_PASSER,
    abi: [
      {
        name: 'initiateWithdrawal',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
          { name: '_target', type: 'address' },
          { name: '_gasLimit', type: 'uint256' },
          { name: '_data', type: 'bytes' },
        ],
        outputs: [],
      },
    ],
    functionName: 'initiateWithdrawal',
    args: [recipient, 100_000n, '0x'],
    value: parseEther(amountEth),
    chain: BASE_CHAIN,
  });

  return hash;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get ETH balance for an address on Base.
 */
export async function getBalance(address: Address): Promise<{
  wei: bigint;
  eth: string;
}> {
  const balance = await publicClient.getBalance({ address });
  return {
    wei: balance,
    eth: formatEther(balance),
  };
}

/**
 * Check if an address is a smart contract (e.g., Smart Wallet).
 */
export async function isContract(address: Address): Promise<boolean> {
  const code = await publicClient.getCode({ address });
  return code !== undefined && code !== '0x';
}

/**
 * Get current Base L2 base fee and L1 data fee scalars.
 */
export async function getGasInfo(): Promise<{
  l2BaseFee: bigint;
  baseFeeScalar: number;
}> {
  const l2BaseFee = await publicClient.getGasPrice();

  const scalar = await publicClient.readContract({
    address: GAS_PRICE_ORACLE,
    abi: gasPriceOracleAbi,
    functionName: 'baseFeeScalar',
  });

  return {
    l2BaseFee,
    baseFeeScalar: Number(scalar),
  };
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  console.log(`Network: Base ${NETWORK}`);
  console.log(`Account: ${account.address}`);

  const balance = await getBalance(account.address);
  console.log(`Balance: ${balance.eth} ETH`);

  const gasInfo = await getGasInfo();
  console.log(`L2 Base Fee: ${gasInfo.l2BaseFee} wei`);
  console.log(`Base Fee Scalar: ${gasInfo.baseFeeScalar}`);

  const blockNumber = await publicClient.getBlockNumber();
  console.log(`Block: ${blockNumber}`);
}

main().catch(console.error);
