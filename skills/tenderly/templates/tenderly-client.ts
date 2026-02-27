/**
 * Tenderly API v2 Client Template
 *
 * Complete starter template for interacting with Tenderly's simulation,
 * Virtual TestNet, and alert APIs using TypeScript and fetch.
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set TENDERLY_ACCESS_KEY, TENDERLY_ACCOUNT_SLUG, TENDERLY_PROJECT_SLUG env vars
 * 3. Import and use the functions
 *
 * Dependencies: viem (for calldata encoding only)
 */

import { encodeFunctionData, parseUnits, type Address } from "viem";

// ============================================================================
// Configuration
// ============================================================================

const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY;
const TENDERLY_ACCOUNT_SLUG = process.env.TENDERLY_ACCOUNT_SLUG;
const TENDERLY_PROJECT_SLUG = process.env.TENDERLY_PROJECT_SLUG;

if (!TENDERLY_ACCESS_KEY) throw new Error("TENDERLY_ACCESS_KEY is required");
if (!TENDERLY_ACCOUNT_SLUG) throw new Error("TENDERLY_ACCOUNT_SLUG is required");
if (!TENDERLY_PROJECT_SLUG) throw new Error("TENDERLY_PROJECT_SLUG is required");

const BASE_URL = `https://api.tenderly.co/api/v2/project/${TENDERLY_ACCOUNT_SLUG}/${TENDERLY_PROJECT_SLUG}`;

const DEFAULT_HEADERS: Record<string, string> = {
  "X-Access-Key": TENDERLY_ACCESS_KEY,
  "Content-Type": "application/json",
};

// ============================================================================
// Types
// ============================================================================

interface SimulationRequest {
  network_id: string;
  from: string;
  to: string;
  input: string;
  value: string;
  gas: number;
  gas_price: string;
  save: boolean;
  save_if_fails: boolean;
  simulation_type: "quick" | "full" | "abi";
  state_objects?: Record<string, {
    balance?: string;
    storage?: Record<string, string>;
  }>;
  block_number?: number;
}

interface SimulationResult {
  simulation: {
    id: string;
    status: boolean;
    gas_used: number;
    block_number: number;
  };
  transaction: {
    transaction_info: {
      call_trace: {
        calls: Array<{
          from: string;
          to: string;
          input: string;
          output: string;
          gas_used: number;
          type: string;
        }>;
      };
      state_diff: Array<{
        address: string;
        original: Record<string, string>;
        dirty: Record<string, string>;
      }>;
      logs: Array<{
        address: string;
        topics: string[];
        data: string;
      }>;
    };
  };
}

interface VNetConfig {
  slug: string;
  displayName: string;
  networkId: number;
  chainId: number;
  blockNumber?: number;
}

interface VNetResult {
  id: string;
  rpcs: Array<{ name: string; url: string }>;
  fork_config: { network_id: number; block_number: number };
}

interface TenderlyApiError {
  error: {
    message: string;
    slug: string;
    id: string;
  };
}

// ============================================================================
// Core HTTP Client
// ============================================================================

async function tenderlyFetch<T>(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: DEFAULT_HEADERS,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    let errorMessage: string;
    try {
      const errorBody = (await response.json()) as TenderlyApiError;
      errorMessage = errorBody.error?.message ?? `HTTP ${response.status}`;
    } catch {
      errorMessage = `HTTP ${response.status}: ${await response.text()}`;
    }
    throw new Error(`Tenderly API error (${response.status}): ${errorMessage}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// Transaction Simulation
// ============================================================================

export async function simulate(
  params: SimulationRequest
): Promise<SimulationResult> {
  return tenderlyFetch<SimulationResult>(
    `${BASE_URL}/simulate`,
    "POST",
    params
  );
}

export async function simulateBundle(
  simulations: SimulationRequest[]
): Promise<SimulationResult[]> {
  const result = await tenderlyFetch<{ simulation_results: SimulationResult[] }>(
    `${BASE_URL}/simulate-bundle`,
    "POST",
    { simulations }
  );
  return result.simulation_results;
}

// ============================================================================
// Virtual TestNets
// ============================================================================

export async function createVNet(config: VNetConfig): Promise<VNetResult> {
  return tenderlyFetch<VNetResult>(
    `${BASE_URL}/vnets`,
    "POST",
    {
      slug: config.slug,
      display_name: config.displayName,
      fork_config: {
        network_id: config.networkId,
        ...(config.blockNumber !== undefined && { block_number: config.blockNumber }),
      },
      virtual_network_config: {
        chain_config: {
          chain_id: config.chainId,
        },
      },
      sync_state_config: { enabled: false },
      explorer_page_config: {
        enabled: true,
        verification_visibility: "src",
      },
    }
  );
}

export async function deleteVNet(vnetId: string): Promise<void> {
  await tenderlyFetch<void>(
    `${BASE_URL}/vnets/${vnetId}`,
    "DELETE"
  );
}

export async function fundVNetAccount(
  rpcUrl: string,
  addresses: string[],
  amountHex: string
): Promise<void> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tenderly_setBalance",
      params: [addresses, amountHex],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Fund VNet account failed (${response.status})`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`);
  }
}

// ============================================================================
// Alerts
// ============================================================================

interface AlertConfig {
  name: string;
  network: string;
  type: string;
  webhookUrl: string;
  webhookSecret?: string;
  contracts?: string[];
  events?: Array<{ name: string; signature: string }>;
  functions?: Array<{ name: string; signature: string }>;
}

export async function createAlert(config: AlertConfig): Promise<{ id: string }> {
  return tenderlyFetch<{ id: string }>(
    `${BASE_URL}/alerts`,
    "POST",
    {
      name: config.name,
      network: config.network,
      type: config.type,
      enabled: true,
      alert_targets: [
        {
          type: "webhook",
          webhook: {
            url: config.webhookUrl,
            ...(config.webhookSecret && { secret: config.webhookSecret }),
          },
        },
      ],
      alert_parameters: {
        ...(config.contracts && { contracts: config.contracts }),
        ...(config.events && { events: config.events }),
        ...(config.functions && { functions: config.functions }),
      },
    }
  );
}

export async function deleteAlert(alertId: string): Promise<void> {
  await tenderlyFetch<void>(
    `${BASE_URL}/alerts/${alertId}`,
    "DELETE"
  );
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const SENDER = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const RECIPIENT = "0x1234567890abcdef1234567890abcdef12345678";

  // --- Simulate an ERC-20 transfer ---
  const calldata = encodeFunctionData({
    abi: [{
      name: "transfer",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
    }] as const,
    functionName: "transfer",
    args: [RECIPIENT as Address, parseUnits("1000", 6)],
  });

  const simResult = await simulate({
    network_id: "1",
    from: SENDER,
    to: USDC,
    input: calldata,
    value: "0",
    gas: 100_000,
    gas_price: "0",
    save: true,
    save_if_fails: true,
    simulation_type: "full",
  });

  console.log(`Simulation success: ${simResult.simulation.status}`);
  console.log(`Gas used: ${simResult.simulation.gas_used}`);

  // --- Create a Virtual TestNet ---
  const vnet = await createVNet({
    slug: "demo-fork",
    displayName: "Demo Fork",
    networkId: 1,
    chainId: 73571,
  });

  console.log(`VNet RPC: ${vnet.rpcs[0].url}`);

  // Fund test account
  await fundVNetAccount(
    vnet.rpcs[0].url,
    [SENDER],
    "0x3635C9ADC5DEA00000" // 1000 ETH
  );

  // Cleanup
  await deleteVNet(vnet.id);
  console.log("VNet deleted");
}

main().catch((err) => {
  console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
