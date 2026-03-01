/**
 * GLAM Vault Setup Template
 *
 * Starter template for creating and configuring a GLAM vault on Solana
 * with DeFi integrations (Jupiter, Kamino, Drift).
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Install: npm install @glam/anchor @solana/web3.js @coral-xyz/anchor
 * 3. Set SOLANA_RPC_URL and SOLANA_PRIVATE_KEY environment variables
 *
 * Dependencies: @glam/anchor, @solana/web3.js, @coral-xyz/anchor
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { GlamClient } from "@glam/anchor";
import bs58 from "bs58";

// ============================================================================
// Configuration
// ============================================================================

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;

if (!SOLANA_PRIVATE_KEY) {
  throw new Error("SOLANA_PRIVATE_KEY environment variable is required");
}

const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_PRIVATE_KEY));
const connection = new Connection(SOLANA_RPC_URL, "confirmed");
const wallet = new Wallet(keypair);
const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

const glamClient = new GlamClient(provider);

// ============================================================================
// Token Mints
// ============================================================================

const MINTS = {
  SOL: new PublicKey("So11111111111111111111111111111111111111112"),
  USDC: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  USDT: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
};

// ============================================================================
// Vault Operations
// ============================================================================

interface VaultConfig {
  name: string;
  assets: PublicKey[];
  shareClassName: string;
  shareClassSymbol: string;
  isRawOpenfunds?: boolean;
}

async function createVault(config: VaultConfig): Promise<{
  fundPda: PublicKey;
  txId: string;
}> {
  const fundData = {
    name: config.name,
    assets: config.assets,
    assetsWeights: config.assets.map(() => 100), // equal weight
    shareClasses: [
      {
        name: config.shareClassName,
        symbol: config.shareClassSymbol,
        asset: config.assets[0],
        allowlist: [],
        blocklist: [],
        isRawOpenfunds: config.isRawOpenfunds ?? false,
      },
    ],
    company: {
      fundGroupName: config.name,
    },
  };

  const [txId, fundPda] = await glamClient.createFund(fundData);
  return { fundPda, txId };
}

async function enableIntegration(
  fundPda: PublicKey,
  integration: string,
): Promise<string> {
  const txId = await glamClient.enableIntegration(fundPda, integration);
  return txId;
}

async function subscribeToVault(
  fundPda: PublicKey,
  asset: PublicKey,
  amount: bigint,
): Promise<string> {
  const txId = await glamClient.subscribe(fundPda, asset, amount);
  return txId;
}

async function redeemFromVault(
  fundPda: PublicKey,
  amount: bigint,
  inKind: boolean = false,
): Promise<string> {
  const txId = await glamClient.redeem(fundPda, amount, inKind);
  return txId;
}

async function setDelegatePermissions(
  fundPda: PublicKey,
  delegate: PublicKey,
  permissions: string[],
): Promise<string> {
  const txId = await glamClient.upsertDelegateAcls(
    fundPda,
    delegate,
    permissions,
  );
  return txId;
}

// ============================================================================
// Usage
// ============================================================================

async function main() {
  // Step 1: Create a vault accepting SOL and USDC
  console.log("Creating GLAM vault...");
  const { fundPda, txId: createTxId } = await createVault({
    name: "My DeFi Vault",
    assets: [MINTS.SOL, MINTS.USDC],
    shareClassName: "My Vault Shares",
    shareClassSymbol: "MVS",
  });
  console.log(`Vault created: ${fundPda.toBase58()}`);
  console.log(`Tx: https://solscan.io/tx/${createTxId}`);

  // Step 2: Enable DeFi integrations
  console.log("\nEnabling integrations...");
  for (const integration of ["JupiterSwap", "KaminoLend", "DriftProtocol"]) {
    const txId = await enableIntegration(fundPda, integration);
    console.log(`  ${integration} enabled: ${txId.slice(0, 16)}...`);
  }

  // Step 3: Subscribe (deposit) 1 SOL into the vault
  console.log("\nSubscribing 1 SOL...");
  const subscribeTxId = await subscribeToVault(
    fundPda,
    MINTS.SOL,
    1_000_000_000n, // 1 SOL in lamports
  );
  console.log(`Subscribed: https://solscan.io/tx/${subscribeTxId}`);

  // Step 4: (Optional) Delegate trading permissions
  const traderPubkey = process.env.TRADER_PUBKEY;
  if (traderPubkey) {
    console.log("\nGranting delegate permissions...");
    const delegateTxId = await setDelegatePermissions(
      fundPda,
      new PublicKey(traderPubkey),
      ["SwapAny", "Deposit", "Withdraw"],
    );
    console.log(`Delegate set: https://solscan.io/tx/${delegateTxId}`);
  }

  console.log("\nVault setup complete.");
  console.log(`View: https://app.glam.systems/vault/${fundPda.toBase58()}`);
}

main().catch((err) => {
  console.error(`GLAM vault setup error: ${err.message}`);
  process.exit(1);
});
