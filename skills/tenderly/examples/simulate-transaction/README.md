# Simulate Transaction Example

Simulate ERC-20 transfers, Uniswap swaps, and arbitrary contract calls using the Tenderly Simulation API v2. Includes state overrides, batch simulation, and extracting gas profiling data.

## Setup

```typescript
import { encodeFunctionData, parseUnits, parseEther } from "viem";

const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY;
const TENDERLY_ACCOUNT_SLUG = process.env.TENDERLY_ACCOUNT_SLUG;
const TENDERLY_PROJECT_SLUG = process.env.TENDERLY_PROJECT_SLUG;

if (!TENDERLY_ACCESS_KEY) throw new Error("TENDERLY_ACCESS_KEY is required");
if (!TENDERLY_ACCOUNT_SLUG) throw new Error("TENDERLY_ACCOUNT_SLUG is required");
if (!TENDERLY_PROJECT_SLUG) throw new Error("TENDERLY_PROJECT_SLUG is required");

const BASE_URL = `https://api.tenderly.co/api/v2/project/${TENDERLY_ACCOUNT_SLUG}/${TENDERLY_PROJECT_SLUG}`;

const headers = {
  "X-Access-Key": TENDERLY_ACCESS_KEY,
  "Content-Type": "application/json",
};
```

## Simulate an ERC-20 Approval + Transfer (Bundle)

Simulate two sequential transactions where the second depends on state from the first.

```typescript
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const OWNER = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const SPENDER = "0x1234567890abcdef1234567890abcdef12345678";
const RECIPIENT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const amount = parseUnits("5000", 6);

const approveCalldata = encodeFunctionData({
  abi: ERC20_ABI,
  functionName: "approve",
  args: [SPENDER, amount],
});

const transferFromCalldata = encodeFunctionData({
  abi: ERC20_ABI,
  functionName: "transferFrom",
  args: [OWNER, RECIPIENT, amount],
});

const bundleResponse = await fetch(`${BASE_URL}/simulate-bundle`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    simulations: [
      {
        network_id: "1",
        from: OWNER,
        to: USDC,
        input: approveCalldata,
        value: "0",
        gas: 100_000,
        gas_price: "0",
        save: true,
        save_if_fails: true,
        simulation_type: "full",
      },
      {
        network_id: "1",
        from: SPENDER,
        to: USDC,
        input: transferFromCalldata,
        value: "0",
        gas: 100_000,
        gas_price: "0",
        save: true,
        save_if_fails: true,
        simulation_type: "full",
      },
    ],
  }),
});

if (!bundleResponse.ok) {
  const error = await bundleResponse.text();
  throw new Error(`Bundle simulation failed (${bundleResponse.status}): ${error}`);
}

const bundleResult = await bundleResponse.json();
const approvalSim = bundleResult.simulation_results[0];
const transferSim = bundleResult.simulation_results[1];

console.log(`Approval success: ${approvalSim.simulation.status}`);
console.log(`Transfer success: ${transferSim.simulation.status}`);
console.log(`Transfer gas: ${transferSim.simulation.gas_used}`);
```

## Simulate with State Overrides (Impersonate Any Address)

Override balances and storage slots to test as any address without needing its private key.

```typescript
const WHALE = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8";

const transferCalldata = encodeFunctionData({
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
  args: [RECIPIENT, parseUnits("1000000", 6)],
});

const overrideResponse = await fetch(`${BASE_URL}/simulate`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    network_id: "1",
    from: WHALE,
    to: USDC,
    input: transferCalldata,
    value: "0",
    gas: 200_000,
    gas_price: "0",
    save: false,
    save_if_fails: true,
    simulation_type: "full",
    state_objects: {
      // Give the whale 1000 ETH for gas
      [WHALE]: {
        balance: "0x3635C9ADC5DEA00000",
      },
    },
  }),
});

if (!overrideResponse.ok) {
  const error = await overrideResponse.text();
  throw new Error(`Override simulation failed (${overrideResponse.status}): ${error}`);
}

const overrideResult = await overrideResponse.json();
console.log(`Success: ${overrideResult.simulation.status}`);
```

## Extract Gas Profile from Simulation

After a `full` simulation, walk the call trace to build a gas breakdown.

```typescript
interface GasEntry {
  selector: string;
  from: string;
  to: string;
  gasUsed: number;
  callType: string;
}

function extractGasProfile(simResult: { transaction: { transaction_info: { call_trace: { calls: Array<{ input: string; from: string; to: string; gas_used: number; type: string }> } } } }): GasEntry[] {
  const calls = simResult.transaction.transaction_info.call_trace.calls;
  return calls.map((call) => ({
    selector: call.input.slice(0, 10),
    from: call.from,
    to: call.to,
    gasUsed: call.gas_used,
    callType: call.type,
  }));
}

const gasProfile = extractGasProfile(overrideResult);
for (const entry of gasProfile) {
  console.log(`${entry.selector} -> ${entry.to}: ${entry.gasUsed} gas (${entry.callType})`);
}
```

## Simulate at a Specific Block

Pin a simulation to a historical block for reproducible results.

```typescript
const historicalResponse = await fetch(`${BASE_URL}/simulate`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    network_id: "1",
    from: OWNER,
    to: USDC,
    input: approveCalldata,
    value: "0",
    gas: 100_000,
    gas_price: "0",
    save: false,
    save_if_fails: false,
    simulation_type: "quick",
    block_number: 19000000,
  }),
});

if (!historicalResponse.ok) {
  const error = await historicalResponse.text();
  throw new Error(`Historical simulation failed (${historicalResponse.status}): ${error}`);
}

const historicalResult = await historicalResponse.json();
console.log(`Simulated at block ${historicalResult.simulation.block_number}`);
console.log(`Gas used: ${historicalResult.simulation.gas_used}`);
```

## Common Pitfalls

- `network_id` must be a string (`"1"`), not a number (`1`)
- `from` is required on every simulation request
- `gas_price: "0"` is valid and useful for testing — it removes gas cost considerations
- `state_objects` keys are addresses (checksummed or lowercase), values are objects with `balance` and/or `storage` fields
- Bundle simulations execute sequentially — transaction N+1 sees state changes from transaction N
- `save: true` counts against your monthly simulation quota even if the simulation fails
