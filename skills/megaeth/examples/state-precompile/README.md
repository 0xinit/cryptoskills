# Efficient State Reads on MegaETH

MegaETH provides predeployed contracts for efficient state access: a high-precision timestamp oracle and Multicall3 for batched reads. Combined with `eth_getLogsWithCursor` for paginated log queries, these tools avoid the performance pitfalls of naive state reads on MegaEVM.

## Predeployed Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | Batch multiple read calls in one RPC request |
| Timestamp Oracle | `0x6342000000000000000000000000000000000002` | Microsecond-precision timestamps |
| WETH9 | `0x4200000000000000000000000000000000000006` | Wrapped ETH |

## Chain Setup

```typescript
import {
  defineChain,
  createPublicClient,
  http,
  parseAbi,
  formatEther,
  type Address,
} from 'viem';

const megaeth = defineChain({
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://mega.etherscan.io' },
  },
});

const publicClient = createPublicClient({ chain: megaeth, transport: http() });
```

## Batched State Reads with Multicall

Multicall amortizes per-RPC overhead. Since MegaETH v2.0.14, `eth_call` is 2-10x faster, making Multicall the preferred pattern for reading multiple contract values.

```typescript
import { multicall } from 'viem/actions';

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

async function readTokenState(
  tokenAddress: Address,
  userAddress: Address
) {
  const results = await multicall(publicClient, {
    contracts: [
      {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      },
      {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'totalSupply',
      },
      {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'decimals',
      },
      {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'symbol',
      },
    ],
  });

  const [balance, totalSupply, decimals, symbol] = results;

  if (balance.status === 'failure') {
    throw new Error(`Failed to read balanceOf: ${balance.error}`);
  }
  if (totalSupply.status === 'failure') {
    throw new Error(`Failed to read totalSupply: ${totalSupply.error}`);
  }

  return {
    balance: balance.result,
    totalSupply: totalSupply.result,
    decimals: decimals.status === 'success' ? decimals.result : 18,
    symbol: symbol.status === 'success' ? symbol.result : 'UNKNOWN',
  };
}
```

## Multi-Token Portfolio Read

```typescript
async function readPortfolio(
  tokens: Address[],
  userAddress: Address
): Promise<Array<{ token: Address; balance: bigint }>> {
  const contracts = tokens.map((token) => ({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf' as const,
    args: [userAddress] as const,
  }));

  const results = await multicall(publicClient, { contracts });

  return results.map((result, index) => ({
    token: tokens[index],
    balance: result.status === 'success' ? (result.result as bigint) : 0n,
  }));
}

const KNOWN_TOKENS: Address[] = [
  '0x4200000000000000000000000000000000000006', // WETH
  '0x28B7E77f82B25B95953825F1E3eA0E36c1c29861', // MEGA
  '0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7', // USDM
];
```

## Paginated Log Queries with eth_getLogsWithCursor

Standard `eth_getLogs` can time out on large result sets. MegaETH provides `eth_getLogsWithCursor` for paginated access.

```typescript
interface CursorLogsResponse {
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    logIndex: string;
  }>;
  cursor: string | null;
}

async function getAllLogs(
  contractAddress: Address,
  eventTopic: `0x${string}`,
  fromBlock: bigint = 0n
): Promise<CursorLogsResponse['logs']> {
  const allLogs: CursorLogsResponse['logs'] = [];
  let cursor: string | null = null;

  do {
    const params: Record<string, unknown> = {
      address: contractAddress,
      topics: [eventTopic],
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: 'latest',
    };

    if (cursor) {
      (params as Record<string, unknown>).cursor = cursor;
    }

    const response = await publicClient.request({
      method: 'eth_getLogsWithCursor' as 'eth_getLogs',
      params: [params],
    });

    const typed = response as unknown as CursorLogsResponse;
    allLogs.push(...typed.logs);
    cursor = typed.cursor;
  } while (cursor !== null);

  return allLogs;
}
```

## High-Precision Timestamp Oracle

`block.timestamp` has 1-second granularity. The predeployed oracle provides microsecond precision for time-sensitive operations.

### Reading from TypeScript

```typescript
const timestampOracleAbi = parseAbi([
  'function timestamp() external view returns (uint256)',
]);

const TIMESTAMP_ORACLE: Address = '0x6342000000000000000000000000000000000002';

async function getPreciseTimestamp(): Promise<bigint> {
  return publicClient.readContract({
    address: TIMESTAMP_ORACLE,
    abi: timestampOracleAbi,
    functionName: 'timestamp',
  });
}
```

### Reading from Solidity

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITimestampOracle {
    function timestamp() external view returns (uint256);
}

contract TimeAwareVault {
    error TimeAwareVault__TooEarly(uint256 current, uint256 required);
    error TimeAwareVault__ZeroAmount();

    event Deposited(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount, uint256 timestamp);

    /// @dev Predeployed on MegaETH mainnet
    ITimestampOracle private constant ORACLE =
        ITimestampOracle(0x6342000000000000000000000000000000000002);

    /// @dev Minimum lock duration in microseconds (1 hour = 3,600,000,000 us)
    uint256 private constant MIN_LOCK_DURATION = 3_600_000_000;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public depositTimestamps;

    /// @notice Deposit ETH with a time lock
    function deposit() external payable {
        if (msg.value == 0) revert TimeAwareVault__ZeroAmount();

        uint256 ts = ORACLE.timestamp();
        balances[msg.sender] += msg.value;
        depositTimestamps[msg.sender] = ts;

        emit Deposited(msg.sender, msg.value, ts);
    }

    /// @notice Withdraw after the lock period
    function withdraw() external {
        uint256 ts = ORACLE.timestamp();
        uint256 depositTs = depositTimestamps[msg.sender];

        if (ts < depositTs + MIN_LOCK_DURATION) {
            revert TimeAwareVault__TooEarly(ts, depositTs + MIN_LOCK_DURATION);
        }

        uint256 amount = balances[msg.sender];
        if (amount == 0) revert TimeAwareVault__ZeroAmount();

        balances[msg.sender] = 0;
        depositTimestamps[msg.sender] = 0;

        emit Withdrawn(msg.sender, amount, ts);

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "transfer failed");
    }
}
```

## Volatile Data Access Pattern

After accessing block metadata (`block.timestamp`, `block.number`, `blockhash(n)`), the transaction is limited to 20M additional compute gas. Structure contracts to do heavy computation first.

```solidity
contract VolatileAware {
    event Processed(uint256 result, uint256 blockTs);

    /// @notice Heavy compute BEFORE metadata access
    /// @dev Accessing block.timestamp late avoids the 20M compute gas cap
    function processAndLog(uint256[] calldata data) external {
        uint256 result;
        for (uint256 i = 0; i < data.length; i++) {
            result += data[i] * data[i];
        }

        // Access metadata last -- after this line, only 20M compute gas remains
        emit Processed(result, block.timestamp);
    }
}
```

## RPC Performance Notes

| Operation | Recommendation |
|-----------|---------------|
| Multiple `eth_call` | Use Multicall3 to batch |
| Large `eth_getLogs` | Use `eth_getLogsWithCursor` with pagination |
| `eth_call` + `eth_getLogs` mixed | Do NOT batch together -- logs are slower and block the entire batch |
| `eth_call` / `eth_estimateGas` | 10M gas limit on public RPC, higher on VIP endpoints |

## Common Pitfalls

1. **Batching eth_getLogs with eth_call** -- Logs are inherently slower than state reads. Mixing them in a single batch causes the fast calls to wait for the slow ones. Execute log queries separately.

2. **Ignoring Multicall for single-contract reads** -- Even when reading multiple values from the same contract, Multicall reduces RPC round trips. Each RPC call has network overhead that Multicall amortizes.

3. **Using block.timestamp for precise timing** -- `block.timestamp` has 1-second granularity despite mini-blocks arriving every ~10ms. Use the timestamp oracle at `0x6342000000000000000000000000000000000002` for microsecond precision.

4. **Accessing block metadata early in execution** -- Triggers the volatile data access 20M compute gas cap for the remainder of the transaction. Always access `block.timestamp`, `block.number`, or `blockhash(n)` as late as possible.
