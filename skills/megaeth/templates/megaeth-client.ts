import {
  defineChain,
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type TransactionReceipt,
  type Hash,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked, toBytes, parseEther } from 'viem';

// --- Chain Configuration ---

export const megaeth = defineChain({
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://mega.etherscan.io' },
  },
});

export const megaethTestnet = defineChain({
  id: 6343,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://carrot.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://megaeth-testnet-v2.blockscout.com' },
  },
});

// --- Client Factory ---

export function createMegaETHClients(privateKey: `0x${string}`, testnet = false) {
  const chain = testnet ? megaethTestnet : megaeth;
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  return { publicClient, walletClient, account };
}

// --- eth_sendRawTransactionSync ---
// Returns receipt in <10ms instead of polling.
// EIP-7966 standard; MegaETH also supports the legacy `realtime_sendRawTransaction`.

export async function sendTransactionSync(
  walletClient: WalletClient,
  params: {
    to: Address;
    value?: bigint;
    data?: `0x${string}`;
    gas?: bigint;
  },
): Promise<TransactionReceipt> {
  const signedTx = await walletClient.signTransaction({
    to: params.to,
    value: params.value ?? 0n,
    data: params.data,
    gas: params.gas ?? 60000n, // MegaETH intrinsic gas (not 21000)
    maxFeePerGas: 1000000n, // 0.001 gwei, fixed base fee
    maxPriorityFeePerGas: 0n,
  });

  const receipt = await walletClient.request({
    method: 'eth_sendRawTransactionSync' as any,
    params: [signedTx],
  });

  return receipt as unknown as TransactionReceipt;
}

// --- MegaNames Resolver ---
// MegaNames contract: 0x5B424C6CCba77b32b9625a6fd5A30D409d20d997

const MEGA_NODE = keccak256(
  encodePacked(
    ['bytes32', 'bytes32'],
    [
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      keccak256(toBytes('mega')),
    ],
  ),
);

export function getMegaNameTokenId(label: string): bigint {
  const labelHash = keccak256(toBytes(label));
  return BigInt(keccak256(encodePacked(['bytes32', 'bytes32'], [MEGA_NODE, labelHash])));
}

const MEGA_NAMES_ADDRESS = '0x5B424C6CCba77b32b9625a6fd5A30D409d20d997' as const;

const megaNamesAbi = [
  {
    name: 'addr',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'getName',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export async function resolveMegaName(
  publicClient: PublicClient,
  label: string,
): Promise<Address> {
  const tokenId = getMegaNameTokenId(label);

  const resolved = await publicClient.readContract({
    address: MEGA_NAMES_ADDRESS,
    abi: megaNamesAbi,
    functionName: 'addr',
    args: [tokenId],
  });

  return resolved;
}

export async function reverseLookup(
  publicClient: PublicClient,
  address: Address,
): Promise<string> {
  const name = await publicClient.readContract({
    address: MEGA_NAMES_ADDRESS,
    abi: megaNamesAbi,
    functionName: 'getName',
    args: [address],
  });

  return name;
}

// --- Usage ---
//
// const { publicClient, walletClient } = createMegaETHClients(
//   process.env.PRIVATE_KEY as `0x${string}`
// );
//
// // Warm up connection (avoids cold-start latency on first real request)
// await publicClient.getChainId();
//
// // Send ETH with instant receipt
// const receipt = await sendTransactionSync(walletClient, {
//   to: '0x...',
//   value: parseEther('0.1'),
// });
//
// // Resolve a .mega name
// const address = await resolveMegaName(publicClient, 'bread');
//
// // Reverse lookup
// const name = await reverseLookup(publicClient, '0x...');
