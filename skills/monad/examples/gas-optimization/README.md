# Gas Optimization for Monad

Monad charges for gas **limit**, not gas **used**. This fundamentally changes gas optimization strategy compared to Ethereum. On Ethereum, you optimize to reduce gas consumed. On Monad, you optimize to set the tightest possible gas limit.

## Gas-Limit Charging Model

```
Ethereum:  cost = gas_used * effective_gas_price
Monad:     cost = gas_limit * effective_gas_price
```

A transaction that uses 21,000 gas but has a 100,000 gas limit costs 21,000 on Ethereum but 100,000 on Monad. The unused 79,000 gas is wasted money on Monad.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  formatGwei,
  defineChain,
  type Address,
  type TransactionRequest,
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

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: monad,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: monad,
  transport: http(),
});
```

## Estimate Then Cap

The core pattern: estimate gas usage, then set a tight limit with a small buffer.

```typescript
async function estimateAndSend(
  tx: TransactionRequest,
  bufferPercent = 10n
): Promise<{ hash: `0x${string}`; gasLimit: bigint; gasUsed: bigint; savings: bigint }> {
  const estimated = await publicClient.estimateGas({
    ...tx,
    account: account.address,
  });

  // Buffer protects against minor gas fluctuations between estimation and execution.
  // 10% is safe for most operations. Use 20% for state-dependent calls.
  const gasLimit = estimated + (estimated * bufferPercent) / 100n;

  const hash = await walletClient.sendTransaction({
    ...tx,
    gas: gasLimit,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }

  // On Monad, you paid for gasLimit regardless of gasUsed
  const savings = estimated * 3n - gasLimit;
  console.log(`Gas limit: ${gasLimit} | Used: ${receipt.gasUsed}`);
  console.log(`vs default 3x estimate: saved ${savings} gas units`);

  return { hash, gasLimit, gasUsed: receipt.gasUsed, savings };
}
```

## MON Transfer with Exact Gas

Simple MON transfers always cost exactly 21,000 gas. Set the limit to exactly 21,000 to pay the minimum.

```typescript
async function transferMON(to: Address, amount: bigint) {
  const TRANSFER_GAS = 21_000n;

  const gasPrice = await publicClient.getGasPrice();
  // On Monad you pay gas_limit * gas_price, so cost is fully predictable
  const exactCost = TRANSFER_GAS * gasPrice;

  console.log(`Transfer cost: ${formatEther(exactCost)} MON (${formatGwei(gasPrice)} gwei)`);

  const hash = await walletClient.sendTransaction({
    to,
    value: amount,
    gas: TRANSFER_GAS,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transfer reverted: ${hash}`);
  }

  return receipt;
}

await transferMON("0xRecipient" as Address, parseEther("1"));
```

## Gas Limit Profiles for Common Operations

Pre-computed gas limits for operations with fixed or near-fixed costs. These avoid the overhead of `estimateGas` calls.

```typescript
// Fixed-cost operations on Monad.
// These values include a safety buffer over the actual gas used.
const GAS_PROFILES = {
  monTransfer: 21_000n,
  erc20Transfer: 55_000n,
  erc20Approve: 50_000n,
  stakingDelegate: 280_000n,   // precompile fixed cost: 260,850
  stakingUndelegate: 165_000n, // precompile fixed cost: 147,750
  stakingCompound: 310_000n,   // precompile fixed cost: 285,050
  stakingClaim: 170_000n,      // precompile fixed cost: 155,375
  stakingWithdraw: 80_000n,    // precompile fixed cost: 68,675
} as const;

async function sendERC20(
  token: Address,
  to: Address,
  amount: bigint
) {
  const erc20Abi = [
    {
      name: "transfer",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
    },
  ] as const;

  const hash = await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
    gas: GAS_PROFILES.erc20Transfer,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`ERC-20 transfer reverted: ${hash}`);
  }

  console.log(`Transferred. Gas limit: ${GAS_PROFILES.erc20Transfer} | Used: ${receipt.gasUsed}`);
  return receipt;
}
```

## Compare Default vs Optimized Gas Cost

```typescript
async function compareGasCost(tx: TransactionRequest) {
  const estimated = await publicClient.estimateGas({
    ...tx,
    account: account.address,
  });

  const gasPrice = await publicClient.getGasPrice();

  // Wallets typically set gas limit to 3x estimate for safety on Ethereum.
  // On Monad, this means paying 3x actual cost.
  const defaultLimit = estimated * 3n;
  const optimizedLimit = estimated + (estimated * 10n) / 100n;

  const defaultCost = defaultLimit * gasPrice;
  const optimizedCost = optimizedLimit * gasPrice;
  const savedWei = defaultCost - optimizedCost;

  console.log("Gas comparison:");
  console.log(`  Estimated usage:   ${estimated}`);
  console.log(`  Default limit (3x): ${defaultLimit} -> ${formatEther(defaultCost)} MON`);
  console.log(`  Optimized (1.1x):   ${optimizedLimit} -> ${formatEther(optimizedCost)} MON`);
  console.log(`  Savings:            ${formatEther(savedWei)} MON (${(Number(savedWei) * 100 / Number(defaultCost)).toFixed(1)}%)`);

  return { estimated, defaultLimit, optimizedLimit, savedWei };
}
```

## Access List Optimization

Monad reprices cold state access at 4x Ethereum. EIP-2930 access lists let you declare which storage slots a transaction will touch. The upfront access list cost is lower than the cold access penalty.

```typescript
async function buildAccessList(tx: TransactionRequest) {
  // eth_createAccessList returns the optimal access list for a transaction.
  // This is especially valuable on Monad where cold access is 4x more expensive.
  const accessListResult = await publicClient.request({
    method: "eth_createAccessList" as "eth_chainId",
    params: [
      {
        from: account.address,
        to: tx.to,
        data: tx.data,
        value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
      },
    ],
  });

  return accessListResult;
}

async function sendWithAccessList(
  to: Address,
  data: `0x${string}`,
  value?: bigint
) {
  const accessListResult = await buildAccessList({ to, data, value });

  // Type assertion needed because eth_createAccessList is non-standard
  const { accessList, gasUsed } = accessListResult as unknown as {
    accessList: { address: Address; storageKeys: `0x${string}`[] }[];
    gasUsed: string;
  };

  const gasEstimate = BigInt(gasUsed);
  const gasLimit = gasEstimate + (gasEstimate * 15n) / 100n;

  console.log(`Access list has ${accessList.length} entries`);
  console.log(`Gas with access list: ${gasEstimate} (limit: ${gasLimit})`);

  const hash = await walletClient.sendTransaction({
    to,
    data,
    value,
    accessList,
    gas: gasLimit,
    type: "eip2930",
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }

  return receipt;
}
```

## Solidity: Minimize Cold Storage Reads

Cache storage reads in memory to avoid paying the 8,100 gas cold penalty multiple times for the same slot.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract StorageOptimized {
    uint256 private _threshold;
    uint256 private _multiplier;
    mapping(address => uint256) private _balances;

    error BelowThreshold(uint256 amount, uint256 threshold);

    /// @notice BAD: reads _threshold and _multiplier from cold storage twice each.
    /// On Monad, each cold SLOAD is 8,100 gas (vs 2,100 on Ethereum).
    function processNaive(uint256 amount) external view returns (uint256) {
        require(amount > _threshold, "below threshold");
        return amount * _multiplier + _threshold * _multiplier;
    }

    /// @notice GOOD: caches cold reads in memory variables.
    /// Pays 8,100 gas once per slot, then 3 gas per MLOAD.
    function processOptimized(uint256 amount) external view returns (uint256) {
        uint256 threshold = _threshold;
        uint256 multiplier = _multiplier;

        if (amount <= threshold) revert BelowThreshold(amount, threshold);
        return amount * multiplier + threshold * multiplier;
    }
}
```

## Solidity: Batch State Updates

Fewer transactions means fewer gas-limit overhead charges. Batch multiple operations into a single call.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract BatchProcessor {
    mapping(address => uint256) private _balances;

    event Distributed(address indexed recipient, uint256 amount);

    error ArrayLengthMismatch();
    error InsufficientBalance(uint256 required, uint256 available);

    /// @notice Distribute tokens to multiple recipients in one transaction.
    /// One gas limit covers all transfers instead of N separate limits.
    function batchDistribute(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        if (recipients.length != amounts.length) revert ArrayLengthMismatch();

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        uint256 senderBalance = _balances[msg.sender];
        if (total > senderBalance) {
            revert InsufficientBalance(total, senderBalance);
        }

        _balances[msg.sender] = senderBalance - total;

        for (uint256 i = 0; i < recipients.length; i++) {
            _balances[recipients[i]] += amounts[i];
            emit Distributed(recipients[i], amounts[i]);
        }
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }
}
```

## Gas Optimization Checklist

| Technique | Ethereum Impact | Monad Impact | Why |
|-----------|----------------|--------------|-----|
| Tight gas limit | None (charged for used) | High | Monad charges for limit |
| Cache storage reads | Medium (2,100 cold) | High (8,100 cold) | 4x cold penalty on Monad |
| Access lists | Low | Medium-High | Pre-warm slots to avoid 8,100 cold cost |
| Batch operations | Medium | High | One gas limit covers N operations |
| Fixed gas for known ops | None | High | Skip estimateGas overhead |
| Minimize contract size | Low | Low | 128 KB limit is generous |

## Common Mistakes

1. **Using wallet defaults**: Most wallets set gas limit to 3x estimate. On Monad, this means paying 3x the necessary cost. Always override with a tight limit.

2. **Ignoring cold access costs**: A contract that reads 10 cold storage slots costs 81,000 gas just for storage on Monad (vs 21,000 on Ethereum). Cache reads in memory.

3. **Sending many small transactions**: Each transaction pays its own gas limit. Batch operations into fewer transactions to reduce total gas-limit exposure.

4. **Not using access lists**: EIP-2930 access lists are more valuable on Monad than Ethereum because the cold-to-warm savings are 4x larger.

5. **Over-buffering gas estimates**: A 10% buffer is sufficient for most operations. The 50-100% buffers common on Ethereum are pure waste on Monad.
