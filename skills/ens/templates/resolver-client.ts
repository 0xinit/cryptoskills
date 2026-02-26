/**
 * ENS Resolver Client Template
 *
 * A complete starter template for ENS integration using viem.
 *
 * Features:
 * - Forward resolution (name -> address)
 * - Reverse resolution (address -> name)
 * - Text record reading and writing
 * - Name availability check
 * - Registration helper
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set RPC_URL and PRIVATE_KEY environment variables
 * 3. Import and use the functions
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeFunctionData,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { namehash, normalize } from "viem/ens";

// ============================================================================
// Configuration
// ============================================================================

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) throw new Error("RPC_URL environment variable is required");

const ENS_ADDRESSES = {
  registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  publicResolver: "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63",
  ethRegistrarController: "0x253553366Da8546fC250F225fe3d25d0C782303b",
  reverseRegistrar: "0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb",
} as const satisfies Record<string, Address>;

const RESOLVER_ABI = parseAbi([
  "function setText(bytes32 node, string key, string value) external",
  "function setAddr(bytes32 node, address addr) external",
  "function multicall(bytes[] data) external returns (bytes[])",
  "function text(bytes32 node, string key) view returns (string)",
  "function addr(bytes32 node) view returns (address)",
]);

const CONTROLLER_ABI = parseAbi([
  "function available(string name) view returns (bool)",
  "function rentPrice(string name, uint256 duration) view returns (tuple(uint256 base, uint256 premium))",
]);

// ============================================================================
// Initialize Clients
// ============================================================================

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

function getWalletClient() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) throw new Error("PRIVATE_KEY environment variable is required for write operations");

  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: mainnet,
    transport: http(RPC_URL),
  });
}

// ============================================================================
// Resolution
// ============================================================================

/** Resolve an ENS name to an Ethereum address. Returns null if not found. */
export async function resolveName(name: string): Promise<Address | null> {
  const address = await publicClient.getEnsAddress({ name });
  return address ?? null;
}

/** Resolve an Ethereum address to its primary ENS name. Returns null if not set. */
export async function resolveAddress(address: Address): Promise<string | null> {
  const name = await publicClient.getEnsName({ address });
  return name ?? null;
}

/** Get the avatar URL for an ENS name. Returns null if not set. */
export async function getAvatar(name: string): Promise<string | null> {
  const avatar = await publicClient.getEnsAvatar({ name });
  return avatar ?? null;
}

// ============================================================================
// Text Records
// ============================================================================

/** Read a text record for an ENS name. */
export async function getTextRecord(
  name: string,
  key: string
): Promise<string | null> {
  const value = await publicClient.getEnsText({ name, key });
  return value ?? null;
}

/** Set a single text record. Requires PRIVATE_KEY. */
export async function setTextRecord(
  name: string,
  key: string,
  value: string
): Promise<Address> {
  const walletClient = getWalletClient();
  const node = namehash(normalize(name));

  const resolverAddress = await publicClient.getEnsResolver({ name });

  const hash = await walletClient.writeContract({
    address: resolverAddress,
    abi: RESOLVER_ABI,
    functionName: "setText",
    args: [node, key, value],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("setText transaction reverted");
  }

  return hash;
}

/** Set multiple text records in a single transaction using multicall. */
export async function setTextRecords(
  name: string,
  records: Record<string, string>
): Promise<Address> {
  const walletClient = getWalletClient();
  const node = namehash(normalize(name));
  const resolverAddress = await publicClient.getEnsResolver({ name });

  const calls = Object.entries(records).map(([key, value]) =>
    encodeFunctionData({
      abi: RESOLVER_ABI,
      functionName: "setText",
      args: [node, key, value],
    })
  );

  const hash = await walletClient.writeContract({
    address: resolverAddress,
    abi: RESOLVER_ABI,
    functionName: "multicall",
    args: [calls],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("multicall transaction reverted");
  }

  return hash;
}

// ============================================================================
// Availability & Pricing
// ============================================================================

/** Check if a .eth name is available for registration. */
export async function isNameAvailable(label: string): Promise<boolean> {
  return publicClient.readContract({
    address: ENS_ADDRESSES.ethRegistrarController,
    abi: CONTROLLER_ABI,
    functionName: "available",
    args: [label],
  });
}

/** Get registration price for a .eth name. Returns cost in wei. */
export async function getRegistrationPrice(
  label: string,
  durationSeconds: bigint
): Promise<{ base: bigint; premium: bigint; total: bigint }> {
  const rentPrice = await publicClient.readContract({
    address: ENS_ADDRESSES.ethRegistrarController,
    abi: CONTROLLER_ABI,
    functionName: "rentPrice",
    args: [label, durationSeconds],
  });

  return {
    base: rentPrice.base,
    premium: rentPrice.premium,
    total: rentPrice.base + rentPrice.premium,
  };
}

// ============================================================================
// Validation
// ============================================================================

/** Check if a string is a valid ENS name (passes UTS-46 normalization). */
export function isValidEnsName(name: string): boolean {
  try {
    normalize(name);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Example Usage
// ============================================================================

async function example() {
  const name = "vitalik.eth";

  const address = await resolveName(name);
  console.log(`${name} -> ${address}`);

  if (address) {
    const primaryName = await resolveAddress(address);
    console.log(`${address} -> ${primaryName}`);
  }

  const avatar = await getAvatar(name);
  console.log(`Avatar: ${avatar}`);

  const twitter = await getTextRecord(name, "com.twitter");
  console.log(`Twitter: ${twitter}`);

  const available = await isNameAvailable("sometestname");
  console.log(`sometestname.eth available: ${available}`);

  if (available) {
    const ONE_YEAR = 31536000n;
    const price = await getRegistrationPrice("sometestname", ONE_YEAR);
    console.log(`Registration cost: ${price.total} wei`);
  }
}

if (require.main === module) {
  example().catch(console.error);
}
