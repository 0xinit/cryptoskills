# Read On-Chain State

Read Monad chain state using viem: account balances, contract storage, Multicall3 batched reads, and staking precompile queries.

## Setup

```typescript
import {
  createPublicClient,
  http,
  formatEther,
  parseEther,
  encodeFunctionData,
  decodeFunctionResult,
  defineChain,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"], webSocket: ["wss://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://monadvision.com" },
  },
});

const publicClient = createPublicClient({
  chain: monad,
  transport: http(),
});

const MULTICALL3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";
const STAKING: Address = "0x0000000000000000000000000000000000001000";
const WMON: Address = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A";
const USDC: Address = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
```

## Read Account Balance

```typescript
async function getBalance(address: Address): Promise<bigint> {
  const balance = await publicClient.getBalance({ address });
  console.log(`${address}: ${formatEther(balance)} MON`);
  return balance;
}

// Remember: Monad requires ~10 MON reserve per account.
// Usable balance = total balance - reserve - pending gas commitments.
async function getUsableBalance(address: Address): Promise<bigint> {
  const balance = await publicClient.getBalance({ address });
  const reserveMon = parseEther("10");
  const usable = balance > reserveMon ? balance - reserveMon : 0n;
  console.log(`Usable balance: ${formatEther(usable)} MON (${formatEther(reserveMon)} reserved)`);
  return usable;
}
```

## Read ERC-20 Token Balances

```typescript
const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

async function getTokenBalance(
  token: Address,
  owner: Address
): Promise<{ balance: bigint; decimals: number; symbol: string }> {
  const [balance, decimals, symbol] = await Promise.all([
    publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }),
    publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "symbol",
    }),
  ]);

  const formatted = Number(balance) / 10 ** decimals;
  console.log(`${symbol}: ${formatted}`);

  return { balance, decimals, symbol };
}

const wallet: Address = "0xYourAddress";
await getTokenBalance(USDC, wallet);
await getTokenBalance(WMON, wallet);
```

## Multicall3 Batched Reads

Multicall3 aggregates multiple read calls into a single RPC request. On Monad, cold storage access costs 4x Ethereum (8,100 gas per slot), so batching saves round trips without increasing on-chain cost.

```typescript
const multicall3Abi = [
  {
    name: "aggregate3",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;

async function batchTokenBalances(
  tokens: Address[],
  owner: Address
): Promise<{ token: Address; balance: bigint }[]> {
  const calls = tokens.map((token) => ({
    target: token,
    allowFailure: true,
    callData: encodeFunctionData({
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }),
  }));

  const results = await publicClient.readContract({
    address: MULTICALL3,
    abi: multicall3Abi,
    functionName: "aggregate3",
    args: [calls],
  });

  return results.map((result, i) => {
    if (!result.success) {
      console.warn(`balanceOf failed for token ${tokens[i]}`);
      return { token: tokens[i], balance: 0n };
    }

    const decoded = decodeFunctionResult({
      abi: erc20Abi,
      functionName: "balanceOf",
      data: result.returnData,
    });

    return { token: tokens[i], balance: decoded };
  });
}

const tokens: Address[] = [WMON, USDC];
const balances = await batchTokenBalances(tokens, "0xYourAddress" as Address);
for (const { token, balance } of balances) {
  console.log(`${token}: ${balance}`);
}
```

## viem Built-in Multicall

viem has native multicall support that is simpler for common cases.

```typescript
async function readMultipleContracts(owner: Address) {
  const results = await publicClient.multicall({
    contracts: [
      {
        address: WMON,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      },
      {
        address: USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      },
      {
        address: WMON,
        abi: erc20Abi,
        functionName: "symbol",
      },
      {
        address: USDC,
        abi: erc20Abi,
        functionName: "symbol",
      },
    ],
    multicallAddress: MULTICALL3,
  });

  for (const result of results) {
    if (result.status === "failure") {
      console.error(`Call failed: ${result.error}`);
      continue;
    }
    console.log(`Result: ${result.result}`);
  }

  return results;
}
```

## Staking Precompile Reads

The staking precompile at `0x...1000` supports read operations via `CALL` only. `STATICCALL` is not permitted, so these must be called through a helper contract or by using `eth_call` (which viem's `readContract` does by default, issuing an `eth_call` under the hood).

### Staking ABI

```typescript
const stakingAbi = [
  {
    name: "delegate",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "validatorId", type: "uint64" }],
    outputs: [],
  },
  {
    name: "undelegate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "validatorId", type: "uint64" },
      { name: "amount", type: "uint256" },
      { name: "position", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "claimRewards",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "validatorId", type: "uint64" }],
    outputs: [],
  },
  {
    name: "compound",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "validatorId", type: "uint64" }],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "validatorId", type: "uint64" },
      { name: "position", type: "uint8" },
    ],
    outputs: [],
  },
] as const;
```

### Delegate to a Validator

```typescript
import { createWalletClient } from "viem";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: monad,
  transport: http(),
});

async function delegateStake(validatorId: bigint, amount: bigint) {
  const hash = await walletClient.sendTransaction({
    to: STAKING,
    value: amount,
    data: encodeFunctionData({
      abi: stakingAbi,
      functionName: "delegate",
      args: [validatorId],
    }),
    // Staking precompile gas cost is fixed at 260,850
    gas: 280_000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Delegation failed in tx ${hash}`);
  }

  console.log(`Delegated ${formatEther(amount)} MON to validator ${validatorId}`);
  return receipt;
}

await delegateStake(1n, parseEther("100"));
```

### Claim Staking Rewards

```typescript
async function claimStakingRewards(validatorId: bigint) {
  const hash = await walletClient.sendTransaction({
    to: STAKING,
    data: encodeFunctionData({
      abi: stakingAbi,
      functionName: "claimRewards",
      args: [validatorId],
    }),
    // claimRewards fixed gas cost: 155,375
    gas: 170_000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Claim rewards failed in tx ${hash}`);
  }

  console.log(`Rewards claimed from validator ${validatorId}`);
  return receipt;
}
```

### Compound Staking Rewards

```typescript
async function compoundRewards(validatorId: bigint) {
  const hash = await walletClient.sendTransaction({
    to: STAKING,
    data: encodeFunctionData({
      abi: stakingAbi,
      functionName: "compound",
      args: [validatorId],
    }),
    // compound fixed gas cost: 285,050
    gas: 310_000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Compound failed in tx ${hash}`);
  }

  console.log(`Rewards compounded for validator ${validatorId}`);
  return receipt;
}
```

## Read Block and Chain State

```typescript
async function getChainInfo() {
  const [blockNumber, chainId, gasPrice, block] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.getChainId(),
    publicClient.getGasPrice(),
    publicClient.getBlock(),
  ]);

  console.log(`Chain ID: ${chainId}`);
  console.log(`Block: ${blockNumber}`);
  console.log(`Gas price: ${gasPrice} wei`);
  // Monad 400ms blocks -- timestamp granularity is ~1 second (2-3 blocks share same second)
  console.log(`Block timestamp: ${block.timestamp}`);
  console.log(`Transactions in block: ${block.transactions.length}`);

  return { blockNumber, chainId, gasPrice, block };
}
```

## Read Raw Storage Slots

Useful for reading packed storage or verifying contract state directly.

```typescript
async function readStorageSlot(
  contractAddress: Address,
  slot: bigint
): Promise<`0x${string}`> {
  const value = await publicClient.getStorageAt({
    address: contractAddress,
    slot: `0x${slot.toString(16).padStart(64, "0")}` as `0x${string}`,
  });

  if (!value) {
    throw new Error(`No storage at slot ${slot} for ${contractAddress}`);
  }

  console.log(`Slot ${slot}: ${value}`);
  return value;
}

// Slot 0 is commonly the first state variable
await readStorageSlot("0xYourContract" as Address, 0n);
```

## Cold vs Warm Access Costs

On Monad, cold storage reads cost 8,100 gas (vs 2,100 on Ethereum). Use access lists to pre-warm storage slots when you know which slots a transaction will touch.

```typescript
async function sendWithAccessList(
  to: Address,
  data: `0x${string}`,
  storageKeys: `0x${string}`[]
) {
  const hash = await walletClient.sendTransaction({
    to,
    data,
    // EIP-2930 access list pre-warms these storage slots
    // Pays a small upfront cost to avoid 8,100 gas cold penalty per slot
    accessList: [
      {
        address: to,
        storageKeys,
      },
    ],
    type: "eip2930",
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }

  return receipt;
}
```
