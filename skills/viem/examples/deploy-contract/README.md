# Contract Deployment

Examples for deploying contracts with viem, including constructor args, CREATE2, and factory patterns.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  getContractAddress,
  encodeDeployData,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});
```

## Basic Deployment

```typescript
// ABI and bytecode from Solidity compilation (solc, forge, hardhat)
const abi = [
  {
    type: "constructor",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
    ],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// bytecode from compilation output
const bytecode = "0x608060..." as `0x${string}`;

const hash = await walletClient.deployContract({
  abi,
  bytecode,
  args: ["My Token", "MTK"],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });

if (receipt.status === "reverted") {
  throw new Error("Deployment reverted");
}

console.log(`Deployed at: ${receipt.contractAddress}`);
```

## Constructor Arguments

Constructor args are ABI-encoded and appended to bytecode automatically.

```typescript
const abi = [
  {
    type: "constructor",
    inputs: [
      { name: "initialOwner", type: "address" },
      { name: "feeRate", type: "uint256" },
      { name: "tokens", type: "address[]" },
    ],
  },
] as const;

const hash = await walletClient.deployContract({
  abi,
  bytecode,
  args: [
    account.address,
    500n, // 5% fee (basis points)
    [
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    ],
  ],
});
```

## Wait and Verify Deployment

```typescript
async function deployAndVerify(
  abi: readonly unknown[],
  bytecode: `0x${string}`,
  args?: readonly unknown[]
): Promise<{ address: `0x${string}`; hash: `0x${string}` }> {
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });

  if (receipt.status === "reverted") {
    throw new Error("Deployment transaction reverted");
  }

  if (!receipt.contractAddress) {
    throw new Error("No contract address in receipt");
  }

  // Verify code exists at the address
  const code = await publicClient.getCode({
    address: receipt.contractAddress,
  });

  if (!code || code === "0x") {
    throw new Error("No code at deployed address");
  }

  console.log(`Deployed at ${receipt.contractAddress}`);
  console.log(`Code size: ${(code.length - 2) / 2} bytes`);

  return {
    address: receipt.contractAddress,
    hash,
  };
}
```

## Gas Estimation for Deployment

```typescript
const gasEstimate = await publicClient.estimateGas({
  account: account.address,
  data: encodeDeployData({
    abi,
    bytecode,
    args: ["My Token", "MTK"],
  }),
});

console.log(`Estimated gas: ${gasEstimate}`);

const gasPrice = await publicClient.getGasPrice();
const estimatedCost = gasEstimate * gasPrice;
console.log(`Estimated cost: ${formatEther(estimatedCost)} ETH`);
```

## Deployment with Value (Payable Constructor)

```typescript
const abi = [
  {
    type: "constructor",
    inputs: [{ name: "minDeposit", type: "uint256" }],
    stateMutability: "payable",
  },
] as const;

const hash = await walletClient.deployContract({
  abi,
  bytecode,
  args: [parseEther("0.01")],
  value: parseEther("1"), // Send 1 ETH to the contract
});
```

## CREATE2 Deterministic Deployment

CREATE2 deploys a contract to a predictable address based on deployer, salt, and bytecode hash.

```typescript
// CREATE2 factory (e.g., deterministic-deployment-proxy at 0x4e59b44847b379578588920cA78FbF26c0B4956C)
const CREATE2_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C" as const;

const salt = keccak256(toBytes("my-salt-v1"));

// Predict the deployment address
const initCode = encodeDeployData({
  abi,
  bytecode,
  args: ["My Token", "MTK"],
});

const predictedAddress = getContractAddress({
  bytecodeHash: keccak256(initCode),
  from: CREATE2_FACTORY,
  opcode: "CREATE2",
  salt,
});

console.log("Predicted address:", predictedAddress);

// Deploy via the factory
const hash = await walletClient.sendTransaction({
  to: CREATE2_FACTORY,
  data: `${salt}${initCode.slice(2)}` as `0x${string}`,
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });

// Verify it landed at the predicted address
const code = await publicClient.getCode({ address: predictedAddress });
if (code && code !== "0x") {
  console.log("Deployed at predicted address:", predictedAddress);
}
```

## Factory Pattern Deployment

When a contract deploys other contracts via a factory method.

```typescript
const factoryAbi = [
  {
    name: "createPool",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
  {
    name: "PoolCreated",
    type: "event",
    inputs: [
      { name: "token0", type: "address", indexed: true },
      { name: "token1", type: "address", indexed: true },
      { name: "fee", type: "uint24", indexed: true },
      { name: "pool", type: "address", indexed: false },
    ],
  },
] as const;

const FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984" as const;

const { request } = await publicClient.simulateContract({
  address: FACTORY,
  abi: factoryAbi,
  functionName: "createPool",
  args: [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    3000, // 0.3% fee tier
  ],
  account: walletClient.account,
});

const hash = await walletClient.writeContract(request);
const receipt = await publicClient.waitForTransactionReceipt({ hash });

// Extract the new pool address from the event
import { decodeEventLog } from "viem";

for (const log of receipt.logs) {
  try {
    const decoded = decodeEventLog({
      abi: factoryAbi,
      data: log.data,
      topics: log.topics,
    });
    if (decoded.eventName === "PoolCreated") {
      console.log("New pool:", decoded.args.pool);
    }
  } catch {
    // Not a PoolCreated event
  }
}
```
