/**
 * Sei EVM Client Template
 *
 * Provides helpers for common Sei operations:
 * - Client setup for Sei mainnet/testnet
 * - Precompile interactions (staking, address conversion, bank)
 * - Pointer contract lookup
 * - Associated balance reads
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx sei-client.ts
 */

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  formatEther,
  parseAbi,
  type PublicClient,
  type WalletClient,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// -- Chain Definitions --

export const sei = defineChain({
  id: 1329,
  name: "Sei",
  nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://evm-rpc.sei-apis.com"],
      webSocket: ["wss://evm-ws.sei-apis.com"],
    },
  },
  blockExplorers: {
    default: { name: "Seitrace", url: "https://seitrace.com" },
  },
});

export const seiTestnet = defineChain({
  id: 1328,
  name: "Sei Testnet",
  nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://evm-rpc-testnet.sei-apis.com"],
      webSocket: ["wss://evm-ws-testnet.sei-apis.com"],
    },
  },
  blockExplorers: {
    default: { name: "Seitrace", url: "https://seitrace.com/?chain=atlantic-2" },
  },
  testnet: true,
});

// -- Client Setup --

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

export const publicClient: PublicClient = createPublicClient({
  chain: sei,
  transport: http(),
});

export const walletClient: WalletClient = createWalletClient({
  account,
  chain: sei,
  transport: http(),
});

// -- Precompile Addresses --

const BANK: Address = "0x0000000000000000000000000000000000001001";
const WASM: Address = "0x0000000000000000000000000000000000001002";
const ADDR: Address = "0x0000000000000000000000000000000000001004";
const STAKING: Address = "0x0000000000000000000000000000000000001005";
const POINTER: Address = "0x000000000000000000000000000000000000100b";

// -- Precompile ABIs --

const addrAbi = parseAbi([
  "function getSeiAddr(address evmAddr) view returns (string)",
  "function getEvmAddr(string seiAddr) view returns (address)",
]);

const bankAbi = parseAbi([
  "function balance(address account, string denom) view returns (uint256)",
]);

const stakingAbi = parseAbi([
  "function delegate(string validator) payable returns (bool)",
]);

const pointerAbi = parseAbi([
  "function getPointer(uint16 pointerType, string tokenId) view returns (address, uint16, bool)",
]);

// -- Address Conversion --

export async function evmToSeiAddress(evmAddr: Address): Promise<string> {
  return publicClient.readContract({
    address: ADDR,
    abi: addrAbi,
    functionName: "getSeiAddr",
    args: [evmAddr],
  });
}

export async function seiToEvmAddress(seiAddr: string): Promise<Address> {
  return publicClient.readContract({
    address: ADDR,
    abi: addrAbi,
    functionName: "getEvmAddr",
    args: [seiAddr],
  });
}

// -- Associated Balances --

export async function getCosmosBalance(
  account: Address,
  denom: string
): Promise<bigint> {
  return publicClient.readContract({
    address: BANK,
    abi: bankAbi,
    functionName: "balance",
    args: [account, denom],
  });
}

// -- Staking --

export async function delegateToValidator(
  validatorAddr: string,
  amountSei: string
): Promise<`0x${string}`> {
  const hash = await walletClient.writeContract({
    address: STAKING,
    abi: stakingAbi,
    functionName: "delegate",
    args: [validatorAddr],
    value: parseEther(amountSei),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error(`Delegation reverted: ${hash}`);
  }

  return hash;
}

// -- Pointer Lookup --

export async function getPointerAddress(
  pointerType: number,
  tokenId: string
): Promise<{ address: Address; exists: boolean }> {
  const [addr, , exists] = await publicClient.readContract({
    address: POINTER,
    abi: pointerAbi,
    functionName: "getPointer",
    args: [pointerType, tokenId],
  });

  return { address: addr, exists };
}
