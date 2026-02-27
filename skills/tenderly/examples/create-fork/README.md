# Create Virtual TestNet (Fork) Example

Create a Virtual TestNet that forks Ethereum mainnet state, fund accounts, set ERC-20 balances, manipulate time, and run transactions in an isolated environment.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
  defineChain,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY;
const TENDERLY_ACCOUNT_SLUG = process.env.TENDERLY_ACCOUNT_SLUG;
const TENDERLY_PROJECT_SLUG = process.env.TENDERLY_PROJECT_SLUG;

if (!TENDERLY_ACCESS_KEY) throw new Error("TENDERLY_ACCESS_KEY is required");
if (!TENDERLY_ACCOUNT_SLUG) throw new Error("TENDERLY_ACCOUNT_SLUG is required");
if (!TENDERLY_PROJECT_SLUG) throw new Error("TENDERLY_PROJECT_SLUG is required");

const API_URL = `https://api.tenderly.co/api/v2/project/${TENDERLY_ACCOUNT_SLUG}/${TENDERLY_PROJECT_SLUG}`;

const apiHeaders = {
  "X-Access-Key": TENDERLY_ACCESS_KEY,
  "Content-Type": "application/json",
};
```

## Create the Virtual TestNet

```typescript
interface VNetResponse {
  id: string;
  rpcs: Array<{ name: string; url: string }>;
  fork_config: { network_id: number; block_number: number };
}

async function createVNet(
  slug: string,
  networkId: number,
  chainId: number
): Promise<VNetResponse> {
  const response = await fetch(`${API_URL}/vnets`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({
      slug,
      display_name: `${slug}-vnet`,
      fork_config: {
        network_id: networkId,
      },
      virtual_network_config: {
        chain_config: {
          chain_id: chainId,
        },
      },
      sync_state_config: {
        enabled: false,
      },
      explorer_page_config: {
        enabled: true,
        verification_visibility: "src",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`VNet creation failed (${response.status}): ${error}`);
  }

  return response.json() as Promise<VNetResponse>;
}

// Fork Ethereum mainnet with custom chain ID to avoid collision
const vnet = await createVNet("integration-test", 1, 73571);
const rpcUrl = vnet.rpcs[0].url;
console.log(`VNet ID: ${vnet.id}`);
console.log(`RPC URL: ${rpcUrl}`);
console.log(`Forked at block: ${vnet.fork_config.block_number}`);
```

## Connect viem to the Virtual TestNet

```typescript
// Custom chain ID must match what was passed to createVNet
const tenderlyFork = defineChain({
  id: 73571,
  name: "Tenderly VNet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
});

const publicClient = createPublicClient({
  chain: tenderlyFork,
  transport: http(rpcUrl),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: tenderlyFork,
  transport: http(rpcUrl),
});
```

## Fund Accounts with ETH

```typescript
async function fundWithEth(
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
    throw new Error(`Fund ETH failed (${response.status})`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`Fund ETH RPC error: ${result.error.message}`);
  }
}

// Fund multiple addresses with 10,000 ETH each
await fundWithEth(
  [account.address, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
  "0x21E19E0C9BAB2400000" // 10,000 ETH in hex wei
);

const balance = await publicClient.getBalance({ address: account.address });
console.log(`Balance: ${formatEther(balance)} ETH`);
```

## Set ERC-20 Token Balances

```typescript
async function setErc20Balance(
  tokenAddress: string,
  walletAddress: string,
  amountHex: string
): Promise<void> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tenderly_setErc20Balance",
      params: [tokenAddress, walletAddress, amountHex],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Set ERC-20 balance failed (${response.status})`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`Set ERC-20 RPC error: ${result.error.message}`);
  }
}

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// Give the test account 1,000,000 USDC
await setErc20Balance(
  USDC,
  account.address,
  "0x" + parseUnits("1000000", 6).toString(16)
);
```

## Manipulate Time and Blocks

```typescript
async function increaseTime(seconds: number): Promise<void> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [`0x${seconds.toString(16)}`],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Increase time failed (${response.status})`);
  }
}

async function mineBlocks(count: number): Promise<void> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "evm_increaseBlocks",
      params: [`0x${count.toString(16)}`],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mine blocks failed (${response.status})`);
  }
}

// Advance 1 day and mine 100 blocks
await increaseTime(86400);
await mineBlocks(100);
```

## Snapshot and Revert State

```typescript
async function createSnapshot(): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "evm_snapshot",
      params: [],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Snapshot failed (${response.status})`);
  }

  const result = await response.json();
  return result.result as string;
}

async function revertToSnapshot(snapshotId: string): Promise<void> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "evm_revert",
      params: [snapshotId],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Revert failed (${response.status})`);
  }
}

// Take snapshot before test
const snapshotId = await createSnapshot();

// ... run test transactions ...

// Revert to clean state
await revertToSnapshot(snapshotId);
```

## Cleanup: Delete the Virtual TestNet

```typescript
async function deleteVNet(vnetId: string): Promise<void> {
  const response = await fetch(`${API_URL}/vnets/${vnetId}`, {
    method: "DELETE",
    headers: apiHeaders,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`VNet deletion failed (${response.status}): ${error}`);
  }
}

// Always clean up when done to free your VNet slot
await deleteVNet(vnet.id);
```

## Common Pitfalls

- The VNet RPC URL is ephemeral — do not hardcode it in configuration files
- Custom `chain_id` in `virtual_network_config` should not collide with real chain IDs (use values above 70000)
- `tenderly_setBalance` accepts an array of addresses as the first param, not a single address
- `tenderly_setErc20Balance` works by manipulating storage directly — it may not emit Transfer events
- Free tier allows only 1 concurrent Virtual TestNet — delete old ones before creating new
- `evm_increaseTime` advances the clock but does not mine a new block — call `evm_increaseBlocks` afterward if block-level timestamps matter
- `evm_revert` consumes the snapshot — you must create a new one if you need to revert again
