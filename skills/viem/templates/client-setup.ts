/**
 * Viem Client Setup Template
 *
 * Complete starter for viem integration on any EVM chain.
 *
 * Features:
 * - Public client for reads
 * - Wallet client for writes (with local account)
 * - Custom transport configuration (HTTP, WebSocket, fallback)
 * - Typed readContract wrapper
 * - Typed writeContract with simulate-then-execute
 * - Event watcher helper
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set RPC_URL and PRIVATE_KEY environment variables
 * 3. Import and use the helpers
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  fallback,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
  type Abi,
  type ContractFunctionName,
  type ContractFunctionArgs,
  BaseError,
  ContractFunctionRevertedError,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// ============================================================================
// Configuration
// ============================================================================

const RPC_URL = process.env.RPC_URL;
const WS_URL = process.env.WS_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;

if (!RPC_URL) {
  throw new Error("RPC_URL environment variable is required");
}

// Change this to target a different chain
const TARGET_CHAIN: Chain = mainnet;

// ============================================================================
// Transport
// ============================================================================

function buildTransport(): Transport {
  if (WS_URL) {
    return fallback([
      webSocket(WS_URL),
      http(RPC_URL),
    ]);
  }
  return http(RPC_URL);
}

// ============================================================================
// Clients
// ============================================================================

export const publicClient: PublicClient = createPublicClient({
  chain: TARGET_CHAIN,
  transport: buildTransport(),
});

let _walletClient: WalletClient | undefined;
let _account: PrivateKeyAccount | undefined;

export function getWalletClient(): WalletClient {
  if (_walletClient) return _walletClient;

  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY environment variable is required for writes");
  }

  _account = privateKeyToAccount(PRIVATE_KEY);
  _walletClient = createWalletClient({
    account: _account,
    chain: TARGET_CHAIN,
    transport: http(RPC_URL),
  });

  return _walletClient;
}

export function getAccount(): PrivateKeyAccount {
  if (_account) return _account;
  getWalletClient();
  return _account!;
}

// ============================================================================
// Read Helper
// ============================================================================

export async function read<
  const TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "view" | "pure">,
>(params: {
  address: `0x${string}`;
  abi: TAbi;
  functionName: TFunctionName;
  args?: ContractFunctionArgs<TAbi, "view" | "pure", TFunctionName>;
}) {
  return publicClient.readContract(params);
}

// ============================================================================
// Write Helper (simulate-then-execute)
// ============================================================================

export async function write<
  const TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
>(params: {
  address: `0x${string}`;
  abi: TAbi;
  functionName: TFunctionName;
  args?: ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFunctionName>;
  value?: bigint;
  confirmations?: number;
}): Promise<{ hash: `0x${string}`; blockNumber: bigint }> {
  const walletClient = getWalletClient();
  const account = getAccount();

  const { request } = await publicClient.simulateContract({
    ...params,
    account,
  });

  const hash = await walletClient.writeContract(request);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: params.confirmations ?? 1,
  });

  if (receipt.status === "reverted") {
    throw new Error(`Transaction reverted in block ${receipt.blockNumber}`);
  }

  return { hash, blockNumber: receipt.blockNumber };
}

// ============================================================================
// Event Watcher Helper
// ============================================================================

export function watchEvents<const TAbi extends Abi>(params: {
  address: `0x${string}`;
  abi: TAbi;
  eventName: string;
  onLogs: (logs: unknown[]) => void;
  onError?: (error: Error) => void;
}): () => void {
  return publicClient.watchContractEvent({
    address: params.address,
    abi: params.abi,
    eventName: params.eventName,
    onLogs: params.onLogs,
    onError: params.onError,
  });
}

// ============================================================================
// Error Extraction
// ============================================================================

export function extractRevertReason(err: unknown): string | undefined {
  if (!(err instanceof BaseError)) return undefined;

  const revert = err.walk(
    (e) => e instanceof ContractFunctionRevertedError
  );

  if (revert instanceof ContractFunctionRevertedError) {
    if (revert.data?.errorName) {
      return `${revert.data.errorName}(${revert.data.args?.join(", ") ?? ""})`;
    }
    if (revert.reason) {
      return revert.reason;
    }
  }

  return err.shortMessage;
}
