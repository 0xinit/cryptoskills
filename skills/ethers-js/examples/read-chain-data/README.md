# Read Chain Data with ethers.js v6

Read blocks, balances, transaction history, ENS records, and token metadata using a read-only Provider. No private key or signer required.

## Setup

```typescript
import {
  JsonRpcProvider,
  formatEther,
  formatUnits,
  Contract,
  Block,
  TransactionResponse,
} from "ethers";

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) throw new Error("RPC_URL environment variable required");

const provider = new JsonRpcProvider(RPC_URL);
```

## Read Block Data

```typescript
async function getBlockInfo(blockTag: number | "latest" = "latest"): Promise<{
  number: number;
  timestamp: number;
  baseFeePerGas: bigint | null;
  gasUsed: bigint;
  gasLimit: bigint;
  transactionCount: number;
}> {
  const block = await provider.getBlock(blockTag);
  if (!block) throw new Error(`Block not found: ${blockTag}`);

  return {
    number: block.number,
    timestamp: block.timestamp,
    baseFeePerGas: block.baseFeePerGas,
    gasUsed: block.gasUsed,
    gasLimit: block.gasLimit,
    transactionCount: block.transactions.length,
  };
}
```

## Read ETH Balance

```typescript
async function getEthBalance(address: string): Promise<{
  wei: bigint;
  ether: string;
}> {
  const balance = await provider.getBalance(address);
  return {
    wei: balance,
    ether: formatEther(balance),
  };
}
```

## Read ERC-20 Token Info

```typescript
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

async function getTokenInfo(tokenAddress: string): Promise<{
  name: string;
  symbol: string;
  decimals: bigint;
  totalSupply: bigint;
}> {
  const token = new Contract(tokenAddress, ERC20_ABI, provider);

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    token.name() as Promise<string>,
    token.symbol() as Promise<string>,
    token.decimals() as Promise<bigint>,
    token.totalSupply() as Promise<bigint>,
  ]);

  return { name, symbol, decimals, totalSupply };
}

async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string
): Promise<{ raw: bigint; formatted: string }> {
  const token = new Contract(tokenAddress, ERC20_ABI, provider);

  const [balance, decimals] = await Promise.all([
    token.balanceOf(walletAddress) as Promise<bigint>,
    token.decimals() as Promise<bigint>,
  ]);

  return {
    raw: balance,
    formatted: formatUnits(balance, Number(decimals)),
  };
}
```

## Read Transaction Details

```typescript
async function getTransactionInfo(txHash: string): Promise<{
  from: string;
  to: string | null;
  value: string;
  gasPrice: bigint | null;
  maxFeePerGas: bigint | null;
  status: "success" | "reverted" | "pending";
  blockNumber: number | null;
}> {
  const [tx, receipt] = await Promise.all([
    provider.getTransaction(txHash),
    provider.getTransactionReceipt(txHash),
  ]);

  if (!tx) throw new Error(`Transaction not found: ${txHash}`);

  let status: "success" | "reverted" | "pending" = "pending";
  if (receipt) {
    status = receipt.status === 1 ? "success" : "reverted";
  }

  return {
    from: tx.from,
    to: tx.to,
    value: formatEther(tx.value),
    gasPrice: tx.gasPrice,
    maxFeePerGas: tx.maxFeePerGas,
    status,
    blockNumber: tx.blockNumber,
  };
}
```

## Resolve ENS Names

```typescript
async function resolveEns(nameOrAddress: string): Promise<{
  address: string | null;
  name: string | null;
}> {
  // ENS requires a mainnet provider (or a chain with ENS deployment)
  if (nameOrAddress.endsWith(".eth")) {
    const address = await provider.resolveName(nameOrAddress);
    return { address, name: nameOrAddress };
  }

  const name = await provider.lookupAddress(nameOrAddress);
  return { address: nameOrAddress, name };
}
```

## Read Current Gas Prices

```typescript
async function getGasPrices(): Promise<{
  gasPrice: bigint | null;
  maxFeePerGas: bigint | null;
  maxPriorityFeePerGas: bigint | null;
}> {
  const feeData = await provider.getFeeData();
  return {
    gasPrice: feeData.gasPrice,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  };
}
```

## Read Contract Storage Directly

```typescript
async function readStorageSlot(
  contractAddress: string,
  slot: number | bigint
): Promise<string> {
  // Returns the raw 32-byte storage value at the given slot
  const slotHex = typeof slot === "number" ? `0x${slot.toString(16)}` : `0x${slot.toString(16)}`;
  const value = await provider.getStorage(contractAddress, slotHex);
  return value;
}
```

## Complete Usage

```typescript
async function main() {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  // Block info
  const block = await getBlockInfo("latest");
  console.log(`Block ${block.number}: ${block.transactionCount} txs, base fee ${block.baseFeePerGas}`);

  // ETH balance
  const ethBal = await getEthBalance(VITALIK);
  console.log(`ETH balance: ${ethBal.ether}`);

  // Token info
  const usdcInfo = await getTokenInfo(USDC);
  console.log(`${usdcInfo.name} (${usdcInfo.symbol}): supply ${formatUnits(usdcInfo.totalSupply, Number(usdcInfo.decimals))}`);

  // Token balance
  const usdcBal = await getTokenBalance(USDC, VITALIK);
  console.log(`USDC balance: ${usdcBal.formatted}`);

  // ENS
  const ens = await resolveEns("vitalik.eth");
  console.log(`vitalik.eth = ${ens.address}`);

  // Gas prices
  const gas = await getGasPrices();
  console.log(`Gas price: ${gas.gasPrice}, Max fee: ${gas.maxFeePerGas}`);
}

main().catch(console.error);
```
