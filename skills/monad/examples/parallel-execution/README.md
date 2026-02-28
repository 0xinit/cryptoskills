# Parallel Execution Patterns

Monad executes transactions concurrently with optimistic conflict detection. No Solidity changes are needed -- parallelism is at the runtime level. However, contract design determines how much parallelism the runtime can extract. This example covers parallel-friendly patterns, batch operations, and how to avoid serialization bottlenecks.

## How Monad Parallel Execution Works

1. Multiple virtual executors process transactions simultaneously
2. Each generates "pending results" tracking storage reads (SLOADs) and writes (SSTOREs)
3. Serial commitment validates each result's inputs are still valid
4. Conflict detected: the affected transaction is re-executed (at most once)
5. Results committed in original transaction order

Transactions that touch different storage slots run in parallel. Transactions that write to the same slot cause conflicts and serialize.

## Parallel-Friendly Contract: Per-User Vault

This vault stores balances in per-user mappings. Deposits from different users hit different storage slots, enabling full parallel execution.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ParallelVault {
    mapping(address => uint256) private _balances;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    error InsufficientBalance(uint256 requested, uint256 available);
    error ZeroAmount();

    /// @notice Deposit MON into the vault. Each user's balance is independent,
    /// so deposits from different users execute in parallel on Monad.
    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();
        _balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw MON. Only touches the caller's storage slot.
    function withdraw(uint256 amount) external {
        uint256 balance = _balances[msg.sender];
        if (amount > balance) revert InsufficientBalance(amount, balance);

        _balances[msg.sender] = balance - amount;

        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    function balanceOf(address user) external view returns (uint256) {
        return _balances[user];
    }
}
```

## Serialization Bottleneck: Global Counter

This pattern forces all transactions to read and write the same storage slot. On Monad, every transaction conflicts with every other, causing serial re-execution.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ANTI-PATTERN for Monad parallel execution.
/// Global counter forces all transactions through a single storage slot.
contract GlobalCounter {
    uint256 private _totalDeposits; // single slot -- serializes all txns

    function deposit() external payable {
        _totalDeposits += msg.value; // every deposit conflicts
    }
}
```

## Parallel-Friendly Alternative: Aggregated Tracking

Track per-user state independently. Compute global totals off-chain or via a view function that reads multiple slots (reads don't cause write conflicts).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Parallel-friendly alternative to global counter.
/// Per-user tracking avoids write conflicts between different users.
contract AggregatedVault {
    mapping(address => uint256) private _deposits;
    address[] private _depositors;
    mapping(address => bool) private _isDepositor;

    event Deposited(address indexed user, uint256 amount);

    error ZeroAmount();

    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();

        if (!_isDepositor[msg.sender]) {
            _isDepositor[msg.sender] = true;
            _depositors.push(msg.sender);
        }

        _deposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function depositOf(address user) external view returns (uint256) {
        return _deposits[user];
    }

    /// @notice Compute total off-chain or accept the gas cost of iteration.
    /// This is a view function -- it does not cause execution conflicts.
    function totalDeposits() external view returns (uint256 total) {
        for (uint256 i = 0; i < _depositors.length; i++) {
            total += _deposits[_depositors[i]];
        }
    }
}
```

## Batch Operations with viem

High throughput (10,000+ TPS) means Monad can absorb large batches. Send multiple independent transactions in parallel from the client side.

### Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  defineChain,
  type Address,
  type Hash,
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

const vaultAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

### Send Batch Deposits

```typescript
async function batchDeposit(
  vaultAddress: Address,
  amounts: bigint[]
): Promise<Hash[]> {
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
  });

  // Send all deposits concurrently with sequential nonces.
  // On Monad, 400ms blocks mean these can land in the same or adjacent blocks.
  const txPromises = amounts.map((amount, i) =>
    walletClient.writeContract({
      address: vaultAddress,
      abi: vaultAbi,
      functionName: "deposit",
      value: amount,
      nonce: nonce + i,
      gas: 60_000n, // tight limit for a simple deposit
    })
  );

  const hashes = await Promise.all(txPromises);

  const receipts = await Promise.all(
    hashes.map((hash) => publicClient.waitForTransactionReceipt({ hash }))
  );

  for (const receipt of receipts) {
    if (receipt.status !== "success") {
      throw new Error(`Deposit reverted in tx ${receipt.transactionHash}`);
    }
  }

  console.log(`${amounts.length} deposits confirmed across ${new Set(receipts.map((r) => r.blockNumber)).size} block(s)`);
  return hashes;
}

const depositAmounts = [
  parseEther("1"),
  parseEther("2"),
  parseEther("0.5"),
  parseEther("3"),
];

await batchDeposit("0xYourVaultAddress" as Address, depositAmounts);
```

### Monitor Batch with WebSocket

```typescript
import { createPublicClient, webSocket } from "viem";

const wsClient = createPublicClient({
  chain: monad,
  transport: webSocket("wss://rpc.monad.xyz"),
});

function watchVaultDeposits(vaultAddress: Address) {
  const unwatch = wsClient.watchContractEvent({
    address: vaultAddress,
    abi: [
      {
        name: "Deposited",
        type: "event",
        inputs: [
          { name: "user", type: "address", indexed: true },
          { name: "amount", type: "uint256", indexed: false },
        ],
      },
    ],
    eventName: "Deposited",
    onLogs: (logs) => {
      for (const log of logs) {
        console.log(
          `Deposit: ${log.args.user} deposited ${log.args.amount} wei ` +
          `in block ${log.blockNumber}`
        );
      }
    },
    onError: (error) => {
      console.error(`WebSocket error: ${error.message}`);
    },
  });

  return unwatch;
}
```

## Parallelism Summary

| Pattern | Parallelizes | Why |
|---------|-------------|-----|
| Per-user mappings | Yes | Independent storage slots per user |
| ERC-20 transfers (different pairs) | Yes | Different balance slots |
| Global counter increment | No | All txns write same slot |
| AMM swaps on same pool | No | Same reserves storage |
| NFT mint with incremental ID | Partially | tokenId counter serializes |
| Independent oracle updates | Yes | Different price feed slots |
| Batch approvals (different spenders) | Yes | Different allowance slots |

## Design Guidelines

1. **Prefer per-user mappings** over global accumulators
2. **Compute aggregates off-chain** when global state is needed for reads only
3. **Shard global state** into buckets if on-chain aggregation is required
4. **No Solidity changes needed** for parallelism -- it happens at the runtime
5. **Same security model** -- reentrancy guards and CEI pattern still apply
6. **Test on Monad Foundry fork** -- `forge test` uses sequential execution, but the contract logic is identical
