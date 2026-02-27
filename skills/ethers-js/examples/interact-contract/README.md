# Interact with Smart Contracts using ethers.js v6

Read state, write transactions, encode/decode calldata, and deploy contracts using the Contract and ContractFactory classes.

## Setup

```typescript
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  ContractFactory,
  Interface,
  AbiCoder,
  parseUnits,
  formatUnits,
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

## Read-Only Contract Calls

```typescript
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

async function readTokenState(tokenAddress: string): Promise<{
  name: string;
  symbol: string;
  decimals: bigint;
  totalSupply: bigint;
}> {
  const token = new Contract(tokenAddress, ERC20_ABI, provider);

  // Parallel reads for efficiency
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    token.name() as Promise<string>,
    token.symbol() as Promise<string>,
    token.decimals() as Promise<bigint>,
    token.totalSupply() as Promise<bigint>,
  ]);

  return { name, symbol, decimals, totalSupply };
}
```

## Write Transactions

```typescript
const WRITE_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

async function transferToken(
  tokenAddress: string,
  to: string,
  amount: bigint
): Promise<TransactionReceipt> {
  const token = new Contract(tokenAddress, [...ERC20_ABI, ...WRITE_ABI], wallet);

  const tx: TransactionResponse = await token.transfer(to, amount);
  console.log(`Transfer submitted: ${tx.hash}`);

  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Transaction dropped or replaced");
  if (receipt.status !== 1) throw new Error("Transfer reverted");

  return receipt;
}
```

## Using getFunction for Overloaded Methods

Some contracts have overloaded functions (same name, different parameters). Use `getFunction` with the full signature to disambiguate.

```typescript
const OVERLOADED_ABI = [
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
];

async function safeTransferNFT(
  nftAddress: string,
  from: string,
  to: string,
  tokenId: bigint
): Promise<TransactionReceipt> {
  const nft = new Contract(nftAddress, OVERLOADED_ABI, wallet);

  // Use full signature to select the 3-argument version
  const transferFn = nft.getFunction("safeTransferFrom(address,address,uint256)");
  const tx: TransactionResponse = await transferFn(from, to, tokenId);

  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Transaction dropped");
  if (receipt.status !== 1) throw new Error("safeTransferFrom reverted");

  return receipt;
}
```

## staticCall -- Simulate Without Sending

Use `staticCall` to simulate a transaction and read its return value without broadcasting. Equivalent to v5's `callStatic`.

```typescript
async function simulateTransfer(
  tokenAddress: string,
  to: string,
  amount: bigint
): Promise<boolean> {
  const token = new Contract(tokenAddress, WRITE_ABI, wallet);

  try {
    // staticCall simulates the transaction without sending it
    const result: boolean = await token.transfer.staticCall(to, amount);
    return result;
  } catch (error: unknown) {
    if (isError(error, "CALL_EXCEPTION")) {
      console.error(`Simulation failed: ${error.reason}`);
      return false;
    }
    throw error;
  }
}
```

## Encode and Decode Calldata

### Using Interface

```typescript
function encodeTransferCall(to: string, amount: bigint): string {
  const iface = new Interface([
    "function transfer(address to, uint256 amount) returns (bool)",
  ]);

  return iface.encodeFunctionData("transfer", [to, amount]);
}

function decodeTransferCall(calldata: string): { to: string; amount: bigint } {
  const iface = new Interface([
    "function transfer(address to, uint256 amount) returns (bool)",
  ]);

  const decoded = iface.decodeFunctionData("transfer", calldata);
  return { to: decoded[0] as string, amount: decoded[1] as bigint };
}
```

### Using AbiCoder Directly

```typescript
function encodeRaw(types: string[], values: unknown[]): string {
  const coder = AbiCoder.defaultAbiCoder();
  return coder.encode(types, values);
}

function decodeRaw(types: string[], data: string): unknown[] {
  const coder = AbiCoder.defaultAbiCoder();
  const result = coder.decode(types, data);
  return [...result];
}

// Encode a tuple of (address, uint256, bool)
const encoded = encodeRaw(
  ["address", "uint256", "bool"],
  ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", 1000n, true]
);

const [addr, amount, flag] = decodeRaw(["address", "uint256", "bool"], encoded);
```

## Deploy a Contract

```typescript
async function deployContract(
  abi: string[],
  bytecode: string,
  constructorArgs: unknown[]
): Promise<{ address: string; deployTxHash: string }> {
  const factory = new ContractFactory(abi, bytecode, wallet);

  const contract = await factory.deploy(...constructorArgs);
  const deployTx = contract.deploymentTransaction();
  if (!deployTx) throw new Error("No deployment transaction found");

  console.log(`Deploy TX: ${deployTx.hash}`);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`Deployed at: ${address}`);
  return { address, deployTxHash: deployTx.hash };
}
```

## Interact with a Deployed Contract (Full JSON ABI)

For production contracts, use the full JSON ABI from compilation output for complete type information.

```typescript
const UNISWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

async function swapExactInput(
  routerAddress: string,
  tokenIn: string,
  tokenOut: string,
  fee: number,
  amountIn: bigint,
  amountOutMin: bigint
): Promise<{ amountOut: bigint; receipt: TransactionReceipt }> {
  const router = new Contract(routerAddress, UNISWAP_ROUTER_ABI, wallet);

  // Simulate first to get expected output
  const expectedOut: bigint = await router.exactInputSingle.staticCall({
    tokenIn,
    tokenOut,
    fee,
    recipient: wallet.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
    amountIn,
    amountOutMinimum: amountOutMin,
    sqrtPriceLimitX96: 0n,
  });

  console.log(`Expected output: ${expectedOut}`);

  const tx: TransactionResponse = await router.exactInputSingle({
    tokenIn,
    tokenOut,
    fee,
    recipient: wallet.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
    amountIn,
    amountOutMinimum: amountOutMin,
    sqrtPriceLimitX96: 0n,
  });

  const receipt = await tx.wait();
  if (receipt === null) throw new Error("Swap transaction dropped");
  if (receipt.status !== 1) throw new Error("Swap reverted");

  return { amountOut: expectedOut, receipt };
}
```

## Parse Logs from Receipt

```typescript
function parseTransferLogs(
  receipt: TransactionReceipt,
  tokenAddress: string
): Array<{ from: string; to: string; value: bigint }> {
  const iface = new Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);

  const transfers: Array<{ from: string; to: string; value: bigint }> = [];

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;

    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed && parsed.name === "Transfer") {
        transfers.push({
          from: parsed.args[0] as string,
          to: parsed.args[1] as string,
          value: parsed.args[2] as bigint,
        });
      }
    } catch {
      // Log does not match the Transfer event signature -- skip
      continue;
    }
  }

  return transfers;
}
```

## Complete Usage

```typescript
async function main() {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const RECIPIENT = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  // Read state
  const info = await readTokenState(USDC);
  console.log(`${info.name}: supply ${formatUnits(info.totalSupply, Number(info.decimals))}`);

  // Simulate transfer
  const wouldSucceed = await simulateTransfer(USDC, RECIPIENT, parseUnits("10", 6));
  console.log(`Transfer would succeed: ${wouldSucceed}`);

  // Encode calldata for inspection
  const calldata = encodeTransferCall(RECIPIENT, parseUnits("10", 6));
  console.log(`Calldata: ${calldata}`);

  // Decode it back
  const decoded = decodeTransferCall(calldata);
  console.log(`Decoded to: ${decoded.to}, amount: ${decoded.amount}`);
}

main().catch(console.error);
```
