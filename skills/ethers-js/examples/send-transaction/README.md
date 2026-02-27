# Send Transactions with ethers.js v6

Send ETH, ERC-20 tokens, and raw transactions using a Wallet signer. Covers gas estimation, EIP-1559 fee control, nonce management, and receipt verification.

## Setup

```typescript
import {
  JsonRpcProvider,
  Wallet,
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
  Contract,
  isError,
  TransactionResponse,
  TransactionReceipt,
} from "ethers";

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!RPC_URL) throw new Error("RPC_URL required");
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY required");

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);
```

## Send ETH

```typescript
async function sendEth(
  to: string,
  ethAmount: string
): Promise<{ hash: string; receipt: TransactionReceipt }> {
  const value = parseEther(ethAmount);

  const balance = await provider.getBalance(wallet.address);
  if (balance < value) {
    throw new Error(
      `Insufficient ETH. Have: ${formatEther(balance)}, Need: ${formatEther(value)}`
    );
  }

  const tx = await wallet.sendTransaction({ to, value });
  console.log(`TX submitted: ${tx.hash}`);

  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Transaction dropped or replaced");
  if (receipt.status !== 1) throw new Error("Transaction reverted");

  return { hash: tx.hash, receipt };
}
```

## Send ERC-20 Tokens

```typescript
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

async function sendToken(
  tokenAddress: string,
  to: string,
  amount: string
): Promise<{ hash: string; receipt: TransactionReceipt }> {
  const token = new Contract(tokenAddress, ERC20_ABI, wallet);

  const [decimals, symbol, balance] = await Promise.all([
    token.decimals() as Promise<bigint>,
    token.symbol() as Promise<string>,
    token.balanceOf(wallet.address) as Promise<bigint>,
  ]);

  const parsedAmount = parseUnits(amount, Number(decimals));

  if (balance < parsedAmount) {
    throw new Error(
      `Insufficient ${symbol}. Have: ${formatUnits(balance, Number(decimals))}, Need: ${amount}`
    );
  }

  const tx: TransactionResponse = await token.transfer(to, parsedAmount);
  console.log(`${symbol} transfer submitted: ${tx.hash}`);

  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Transaction dropped or replaced");
  if (receipt.status !== 1) throw new Error(`${symbol} transfer reverted`);

  return { hash: tx.hash, receipt };
}
```

## EIP-1559 Gas Control

```typescript
async function sendEthWithGasControl(
  to: string,
  ethAmount: string,
  maxPriorityGwei: string,
  maxFeeGwei: string
): Promise<{ hash: string; receipt: TransactionReceipt }> {
  const value = parseEther(ethAmount);

  const tx = await wallet.sendTransaction({
    to,
    value,
    maxPriorityFeePerGas: parseUnits(maxPriorityGwei, "gwei"),
    maxFeePerGas: parseUnits(maxFeeGwei, "gwei"),
  });

  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Transaction dropped or replaced");
  if (receipt.status !== 1) throw new Error("Transaction reverted");

  console.log(`Gas used: ${receipt.gasUsed}`);
  console.log(`Effective gas price: ${formatUnits(receipt.gasPrice, "gwei")} gwei`);

  return { hash: tx.hash, receipt };
}
```

## Manual Nonce Management

Use explicit nonces when sending multiple transactions in rapid succession to avoid nonce conflicts.

```typescript
async function sendBatchTransactions(
  recipients: Array<{ to: string; ethAmount: string }>
): Promise<string[]> {
  let nonce = await provider.getTransactionCount(wallet.address, "pending");
  const hashes: string[] = [];

  for (const { to, ethAmount } of recipients) {
    const tx = await wallet.sendTransaction({
      to,
      value: parseEther(ethAmount),
      nonce,
    });
    hashes.push(tx.hash);
    nonce++;
  }

  // Wait for all receipts
  const receipts = await Promise.all(
    hashes.map((hash) => provider.waitForTransaction(hash))
  );

  for (const receipt of receipts) {
    if (receipt === null) throw new Error("Transaction dropped");
    if (receipt.status !== 1) throw new Error(`TX ${receipt.hash} reverted`);
  }

  return hashes;
}
```

## ERC-20 Approve then TransferFrom

```typescript
async function approveAndTransferFrom(
  tokenAddress: string,
  spender: string,
  amount: string
): Promise<{ approveHash: string; approveReceipt: TransactionReceipt }> {
  const token = new Contract(tokenAddress, ERC20_ABI, wallet);

  const decimals: bigint = await token.decimals();
  const parsedAmount = parseUnits(amount, Number(decimals));

  const currentAllowance: bigint = await token.allowance(wallet.address, spender);

  if (currentAllowance >= parsedAmount) {
    console.log("Sufficient allowance already set");
    const receipt = await provider.getTransactionReceipt("0x");
    return { approveHash: "already-approved", approveReceipt: receipt! };
  }

  const tx: TransactionResponse = await token.approve(spender, parsedAmount);
  console.log(`Approve TX: ${tx.hash}`);

  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Approve transaction dropped");
  if (receipt.status !== 1) throw new Error("Approve reverted");

  return { approveHash: tx.hash, approveReceipt: receipt };
}
```

## Error Handling for Transactions

```typescript
async function safeSend(
  to: string,
  ethAmount: string
): Promise<{ hash: string; receipt: TransactionReceipt }> {
  const value = parseEther(ethAmount);

  try {
    const tx = await wallet.sendTransaction({ to, value });
    const receipt = await tx.wait();

    if (receipt === null) {
      throw new Error("Transaction was dropped or replaced by the network");
    }
    if (receipt.status !== 1) {
      throw new Error(`Transaction reverted in block ${receipt.blockNumber}`);
    }

    return { hash: tx.hash, receipt };
  } catch (error: unknown) {
    if (isError(error, "INSUFFICIENT_FUNDS")) {
      throw new Error(`Not enough ETH for value + gas: ${error.message}`);
    }
    if (isError(error, "NONCE_EXPIRED")) {
      throw new Error(`Nonce already used. Fetch fresh nonce and retry: ${error.message}`);
    }
    if (isError(error, "REPLACEMENT_UNDERPRICED")) {
      throw new Error(`Gas too low to replace pending tx: ${error.message}`);
    }
    if (isError(error, "CALL_EXCEPTION")) {
      throw new Error(`Contract call failed: ${error.reason ?? error.message}`);
    }
    if (isError(error, "NETWORK_ERROR")) {
      throw new Error(`Network error -- check RPC connectivity: ${error.message}`);
    }
    throw error;
  }
}
```

## Estimate Gas Before Sending

```typescript
async function estimateAndSend(
  to: string,
  ethAmount: string,
  gasMultiplier: bigint = 120n
): Promise<{ hash: string; receipt: TransactionReceipt; gasUsed: bigint }> {
  const value = parseEther(ethAmount);

  const estimatedGas = await provider.estimateGas({
    from: wallet.address,
    to,
    value,
  });

  // Add safety margin (gasMultiplier / 100)
  const gasLimit = (estimatedGas * gasMultiplier) / 100n;

  const tx = await wallet.sendTransaction({ to, value, gasLimit });
  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Transaction dropped");
  if (receipt.status !== 1) throw new Error("Transaction reverted");

  console.log(`Estimated: ${estimatedGas}, Used: ${receipt.gasUsed}, Limit: ${gasLimit}`);

  return { hash: tx.hash, receipt, gasUsed: receipt.gasUsed };
}
```

## Complete Usage

```typescript
async function main() {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const RECIPIENT = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  console.log(`Sender: ${wallet.address}`);

  // Send ETH
  const ethResult = await sendEth(RECIPIENT, "0.01");
  console.log(`ETH sent: ${ethResult.hash}`);

  // Send USDC
  const tokenResult = await sendToken(USDC, RECIPIENT, "10.0");
  console.log(`USDC sent: ${tokenResult.hash}`);

  // Send with gas control
  const gasResult = await sendEthWithGasControl(RECIPIENT, "0.005", "2", "50");
  console.log(`Gas-controlled TX: ${gasResult.hash}`);
}

main().catch(console.error);
```
