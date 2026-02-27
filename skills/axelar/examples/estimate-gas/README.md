# Axelar Gas Estimation

Working examples for estimating and paying cross-chain gas fees using the Axelar SDK and GasService contract. Gas must be paid upfront on the source chain -- without it, messages are never relayed.

## Why Gas Estimation Matters

Axelar GMP requires gas to be prepaid on the source chain. The gas payment covers:
- Axelar network processing (validator consensus)
- Destination chain execution (calling `_execute()` or `_executeWithToken()`)
- Relayer operation

If no gas is paid, the message enters the Axelar network but is never executed on the destination. There is no automatic retry -- you must send a new transaction.

## Method 1: Axelar SDK (Recommended)

```typescript
import { AxelarQueryAPI, Environment } from "@axelar-network/axelarjs-sdk";
import { type Address } from "viem";

const axelarQuery = new AxelarQueryAPI({
  environment: Environment.MAINNET,
});

/// @notice Estimate gas fee for a GMP call
/// @param sourceChain Axelar source chain name
/// @param destinationChain Axelar destination chain name
/// @param gasLimit Gas limit for _execute() on destination
/// @returns Gas fee in source chain native token (wei)
async function estimateGasFee(
  sourceChain: string,
  destinationChain: string,
  gasLimit: bigint
): Promise<bigint> {
  const fee = await axelarQuery.estimateGasFee(
    sourceChain,
    destinationChain,
    Number(gasLimit),
    "auto",
    undefined,
    undefined,
  );

  return BigInt(fee as string);
}
```

## Method 2: Axelar API (REST)

When you cannot use the SDK (e.g., in a browser without Node.js polyfills):

```typescript
interface GasEstimateResponse {
  result: {
    source_token: {
      gas_price: string;
      gas_price_gwei: string;
    };
    destination_native_token: {
      gas_price: string;
    };
    express_fee: string;
    base_fee: string;
    source_express_fee: {
      total_fee: string;
    };
    source_base_fee: string;
  };
}

async function estimateGasViaAPI(
  sourceChain: string,
  destinationChain: string,
  gasLimit: bigint
): Promise<bigint> {
  const url = new URL("https://api.axelarscan.io/cross-chain/transfer-fee");
  url.searchParams.set("source_chain", sourceChain);
  url.searchParams.set("destination_chain", destinationChain);
  url.searchParams.set("gas_limit", gasLimit.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Gas estimation failed: ${response.status} ${response.statusText}`);
  }

  const data: GasEstimateResponse = await response.json();
  return BigInt(data.result.source_base_fee);
}
```

## Paying Gas on Source Chain

### For `callContract` (message only)

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const GAS_SERVICE: Address = "0x2d5d7d31F671F86C782533cc367F14109a082712";

const gasServiceAbi = parseAbi([
  "function payNativeGasForContractCall(address sender, string calldata destinationChain, string calldata destinationAddress, bytes calldata payload, address refundAddress) payable",
]);

async function payGasForMessage(
  sender: Address,
  destinationChain: string,
  destinationAddress: string,
  payload: `0x${string}`,
  gasValue: bigint
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: GAS_SERVICE,
    abi: gasServiceAbi,
    functionName: "payNativeGasForContractCall",
    args: [sender, destinationChain, destinationAddress, payload, account.address],
    value: gasValue,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Gas payment reverted");

  return hash;
}
```

### For `callContractWithToken` (message + token)

```typescript
const gasServiceWithTokenAbi = parseAbi([
  "function payNativeGasForContractCallWithToken(address sender, string calldata destinationChain, string calldata destinationAddress, bytes calldata payload, string calldata symbol, uint256 amount, address refundAddress) payable",
]);

async function payGasForTokenMessage(
  sender: Address,
  destinationChain: string,
  destinationAddress: string,
  payload: `0x${string}`,
  symbol: string,
  amount: bigint,
  gasValue: bigint
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: GAS_SERVICE,
    abi: gasServiceWithTokenAbi,
    functionName: "payNativeGasForContractCallWithToken",
    args: [
      sender,
      destinationChain,
      destinationAddress,
      payload,
      symbol,
      amount,
      account.address,
    ],
    value: gasValue,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Gas payment reverted");

  return hash;
}
```

## Adding Gas to an Existing Transaction

If a transaction is underfunded and stuck, you can add more gas:

```typescript
const addGasAbi = parseAbi([
  "function addNativeGas(bytes32 txHash, uint256 logIndex, address refundAddress) payable",
]);

async function addGasToExistingTx(
  txHash: `0x${string}`,
  logIndex: bigint,
  additionalGas: bigint
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: GAS_SERVICE,
    abi: addGasAbi,
    functionName: "addNativeGas",
    args: [txHash, logIndex, account.address],
    value: additionalGas,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("addNativeGas reverted");

  return hash;
}
```

## Gas Estimation Guidelines

### Recommended Gas Limits by Operation

| Operation | Recommended Gas Limit |
|-----------|----------------------|
| Simple message (`_execute` with basic logic) | 200,000 - 300,000 |
| Token transfer + message (`_executeWithToken`) | 300,000 - 400,000 |
| ITS `interchainTransfer` | 250,000 |
| ITS remote token deployment | 500,000 - 700,000 |
| Complex logic (swap, stake, etc.) | 500,000+ |

### Add Buffer for Safety

```typescript
async function estimateWithBuffer(
  sourceChain: string,
  destinationChain: string,
  gasLimit: bigint,
  bufferPercent: bigint = 10n
): Promise<bigint> {
  const baseFee = await estimateGasFee(sourceChain, destinationChain, gasLimit);
  // 10% buffer to account for gas price fluctuations
  return baseFee + (baseFee * bufferPercent) / 100n;
}
```

## Complete Usage

```typescript
async function main() {
  // Estimate gas for Ethereum -> Arbitrum message
  const gasLimit = 300000n;
  const gasFee = await estimateGasFee("ethereum", "arbitrum", gasLimit);

  console.log(`Estimated gas fee: ${gasFee} wei`);
  console.log(`Estimated gas fee: ${Number(gasFee) / 1e18} ETH`);

  // Estimate for multiple routes
  const routes = [
    { src: "ethereum", dst: "arbitrum" },
    { src: "ethereum", dst: "base" },
    { src: "ethereum", dst: "polygon" },
    { src: "arbitrum", dst: "ethereum" },
  ];

  for (const route of routes) {
    const fee = await estimateGasFee(route.src, route.dst, gasLimit);
    console.log(`${route.src} -> ${route.dst}: ${Number(fee) / 1e18} ETH`);
  }
}

main().catch(console.error);
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Message not executed | No gas paid or insufficient gas | Always call `payNativeGasForContractCall` before `callContract` |
| `GasPaidForContractCall` event missing | Gas payment in separate tx or not called | Include gas payment in the same transaction flow |
| Gas estimation returns 0 | Invalid chain names | Use exact Axelar chain names: "ethereum", "arbitrum", "base" |
| SDK throws network error | API rate limit or downtime | Retry with exponential backoff, or use REST API fallback |
| Refund not received | `refundAddress` is a contract without `receive()` | Use an EOA as refund address, or add `receive() external payable {}` |
