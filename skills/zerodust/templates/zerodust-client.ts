/**
 * ZeroDust Client Template
 *
 * A complete, runnable starter for integrating ZeroDust dust sweeping.
 * Handles balance checking, single sweeps, and batch sweeps.
 *
 * Prerequisites:
 *   npm install @zerodust/sdk viem
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx zerodust-client.ts
 */

import {
  ZeroDustAgent,
  ZeroDustError,
  BalanceTooLowError,
  QuoteExpiredError,
  BridgeError,
  type AgentSweepResult,
} from '@zerodust/sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { formatUnits, type Hex } from 'viem';

// ============ Configuration ============

const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) {
  console.error('Set PRIVATE_KEY environment variable');
  process.exit(1);
}

// Destination chain for consolidation (Base by default)
const DESTINATION_CHAIN_ID = 8453;

// Whether to actually execute sweeps (set false for dry run)
const EXECUTE_SWEEPS = process.env.DRY_RUN !== 'true';

// ============ Agent Setup ============

const agent = new ZeroDustAgent({
  account: privateKeyToAccount(PRIVATE_KEY),
  environment: 'mainnet',
  // Optional: custom RPC URLs for better reliability
  // rpcUrls: {
  //   42161: 'https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY',
  //   8453: 'https://base-mainnet.g.alchemy.com/v2/YOUR_KEY',
  // },
});

console.log(`Agent address: ${agent.address}`);
console.log(`Destination chain: ${DESTINATION_CHAIN_ID}`);
console.log(`Mode: ${EXECUTE_SWEEPS ? 'LIVE' : 'DRY RUN'}`);
console.log('---');

// ============ Check Balances ============

async function checkBalances() {
  console.log('Checking balances across all chains...');

  const sweepable = await agent.getSweepableBalances();

  if (sweepable.length === 0) {
    console.log('No sweepable balances found.');
    return [];
  }

  console.log(`Found ${sweepable.length} sweepable chains:`);
  for (const b of sweepable) {
    console.log(`  ${b.name} (${b.chainId}): ${b.balanceFormatted} ${b.nativeToken}`);
  }

  return sweepable;
}

// ============ Single Chain Sweep ============

async function sweepChain(fromChainId: number, toChainId: number): Promise<AgentSweepResult> {
  console.log(`\nSweeping chain ${fromChainId} -> ${toChainId}...`);

  try {
    const result = await agent.sweep(
      { fromChainId, toChainId },
      {
        waitForCompletion: true,
        timeoutMs: 120_000,
        onStatusChange: (status) => {
          console.log(`  Status: ${status.status}`);
        },
      }
    );

    if (result.success) {
      console.log(`  Completed! TX: ${result.txHash}`);
    } else {
      console.log(`  Failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    if (error instanceof BalanceTooLowError) {
      console.log(`  Skipped: balance too low`);
    } else if (error instanceof QuoteExpiredError) {
      console.log(`  Quote expired, would need to retry`);
    } else if (error instanceof BridgeError) {
      console.log(`  Bridge unavailable, trying same-chain...`);
      // Fall back to same-chain sweep
      return agent.sweep(
        { fromChainId, toChainId: fromChainId },
        { waitForCompletion: true, timeoutMs: 120_000 }
      );
    } else if (error instanceof ZeroDustError) {
      console.log(`  ZeroDust error [${error.code}]: ${error.message}`);
    } else {
      console.log(`  Unexpected error: ${error}`);
    }

    return { success: false, error: String(error) };
  }
}

// ============ Batch Sweep All ============

async function sweepAll() {
  console.log(`\nSweeping all chains to chain ${DESTINATION_CHAIN_ID}...`);

  const results = await agent.sweepAll({
    toChainId: DESTINATION_CHAIN_ID,
    continueOnError: true,
  });

  console.log(`\nResults: ${results.successful}/${results.total} succeeded, ${results.failed} failed`);

  for (const r of results.results) {
    const status = r.success
      ? `OK (TX: ${r.txHash})`
      : `FAILED: ${r.error}`;
    console.log(`  Chain ${r.fromChainId} -> ${r.toChainId}: ${status}`);
  }

  return results;
}

// ============ Main ============

async function main() {
  // Step 1: Check what's available
  const sweepable = await checkBalances();

  if (sweepable.length === 0) {
    return;
  }

  if (!EXECUTE_SWEEPS) {
    console.log('\nDry run complete. Set DRY_RUN=false to execute sweeps.');
    return;
  }

  // Step 2: Sweep everything to destination chain
  const results = await sweepAll();

  // Step 3: Summary
  console.log('\n=== Summary ===');
  console.log(`Total chains swept: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);

  if (results.failed > 0) {
    console.log('\nFailed chains:');
    for (const r of results.results.filter(r => !r.success)) {
      console.log(`  ${r.fromChainId}: ${r.error}`);
    }
  }
}

main().catch(console.error);
