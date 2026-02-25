# Cross-Chain Query: Read Remote State Without a Transaction

Working example: use Wormhole Queries to read an ERC-20 token balance on Arbitrum from an application running on Ethereum, without sending a transaction to Arbitrum. Guardians execute the read and return a signed response.

## Setup

```typescript
import {
  createPublicClient,
  http,
  encodeFunctionData,
  decodeFunctionResult,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";

const ethClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const WORMHOLE_ARBITRUM_CHAIN_ID = 23;
const QUERY_URL = "https://query.wormhole.com/v1/query";
```

## ABIs

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
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;
```

## Build and Submit a Query

```typescript
interface QueryCallData {
  to: Address;
  data: `0x${string}`;
}

interface PerChainQuery {
  chainId: number;
  type: "eth_call";
  blockTag: "latest" | "finalized" | "safe";
  calls: QueryCallData[];
}

interface QueryResult {
  responses: Array<{
    chainId: number;
    blockNumber: bigint;
    blockTime: bigint;
    results: Array<{ result: `0x${string}` }>;
  }>;
  signatures: Array<{
    guardianIndex: number;
    signature: `0x${string}`;
  }>;
}

async function submitQuery(queries: PerChainQuery[]): Promise<QueryResult> {
  const requestBody = {
    queries: queries.map((q) => ({
      chain_id: q.chainId,
      type: q.type,
      block_tag: q.blockTag,
      calls: q.calls.map((c) => ({
        to: c.to,
        data: c.data,
      })),
    })),
  };

  const response = await fetch(QUERY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Query API returned ${response.status}: ${text}`);
  }

  return (await response.json()) as QueryResult;
}
```

## Example 1: Read a Single Balance on Arbitrum

```typescript
async function readRemoteBalance(
  tokenAddress: Address,
  holder: Address
): Promise<bigint> {
  const callData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [holder],
  });

  const result = await submitQuery([
    {
      chainId: WORMHOLE_ARBITRUM_CHAIN_ID,
      type: "eth_call",
      blockTag: "finalized",
      calls: [{ to: tokenAddress, data: callData }],
    },
  ]);

  const balanceHex = result.responses[0].results[0].result;
  const balance = decodeFunctionResult({
    abi: erc20Abi,
    functionName: "balanceOf",
    data: balanceHex,
  });

  return balance;
}
```

## Example 2: Batch Read Multiple Values

Read balance, total supply, and decimals in a single query request.

```typescript
async function readTokenInfo(
  tokenAddress: Address,
  holder: Address
): Promise<{
  balance: bigint;
  totalSupply: bigint;
  decimals: number;
  blockNumber: bigint;
}> {
  const balanceCall = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [holder],
  });

  const supplyCall = encodeFunctionData({
    abi: erc20Abi,
    functionName: "totalSupply",
  });

  const decimalsCall = encodeFunctionData({
    abi: erc20Abi,
    functionName: "decimals",
  });

  const result = await submitQuery([
    {
      chainId: WORMHOLE_ARBITRUM_CHAIN_ID,
      type: "eth_call",
      blockTag: "finalized",
      calls: [
        { to: tokenAddress, data: balanceCall },
        { to: tokenAddress, data: supplyCall },
        { to: tokenAddress, data: decimalsCall },
      ],
    },
  ]);

  const response = result.responses[0];

  const balance = decodeFunctionResult({
    abi: erc20Abi,
    functionName: "balanceOf",
    data: response.results[0].result,
  });

  const totalSupply = decodeFunctionResult({
    abi: erc20Abi,
    functionName: "totalSupply",
    data: response.results[1].result,
  });

  const decimals = decodeFunctionResult({
    abi: erc20Abi,
    functionName: "decimals",
    data: response.results[2].result,
  });

  return {
    balance,
    totalSupply,
    decimals,
    blockNumber: response.blockNumber,
  };
}
```

## Example 3: Multi-Chain Query

Read state from multiple chains in a single request.

```typescript
const WORMHOLE_BASE_CHAIN_ID = 30;
const WORMHOLE_OPTIMISM_CHAIN_ID = 24;

async function readMultiChainBalances(
  tokenAddresses: Record<number, Address>,
  holder: Address
): Promise<Map<number, bigint>> {
  const balanceCallData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [holder],
  });

  const queries: PerChainQuery[] = Object.entries(tokenAddresses).map(
    ([chainId, tokenAddr]) => ({
      chainId: Number(chainId),
      type: "eth_call" as const,
      blockTag: "finalized" as const,
      calls: [{ to: tokenAddr, data: balanceCallData }],
    })
  );

  const result = await submitQuery(queries);

  const balances = new Map<number, bigint>();
  for (const response of result.responses) {
    const balance = decodeFunctionResult({
      abi: erc20Abi,
      functionName: "balanceOf",
      data: response.results[0].result,
    });
    balances.set(response.chainId, balance);
  }

  return balances;
}
```

## On-Chain Verification

Query responses are signed by Guardians and can be verified on-chain for trustless use.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {QueryResponse} from "@wormhole-foundation/wormhole-solidity-sdk/QueryResponse.sol";

error StaleData(uint256 blockTime, uint256 maxAge);
error UnexpectedChainId(uint16 expected, uint16 actual);

/// @title Cross-chain balance verifier using Wormhole Queries
contract BalanceVerifier is QueryResponse {
    /// @dev Max acceptable age for query responses (5 minutes)
    uint256 public constant MAX_STALENESS = 300;

    constructor(address wormhole) QueryResponse(wormhole) {}

    /// @notice Verify a cross-chain balance query response
    /// @param response Serialized query response from Guardians
    /// @param signatures Guardian signatures
    /// @param expectedChainId Wormhole chain ID we expect the data from
    /// @return balance The verified token balance
    function verifyBalance(
        bytes memory response,
        IWormhole.Signature[] memory signatures,
        uint16 expectedChainId
    ) external view returns (uint256 balance) {
        ParsedQueryResponse memory parsed = parseAndVerifyQueryResponse(
            response,
            signatures
        );

        EthCallQueryResponse memory ethCall = parseEthCallQueryResponse(
            parsed.responses[0]
        );

        if (ethCall.chainId != expectedChainId) {
            revert UnexpectedChainId(expectedChainId, ethCall.chainId);
        }

        if (block.timestamp - ethCall.blockTime > MAX_STALENESS) {
            revert StaleData(ethCall.blockTime, MAX_STALENESS);
        }

        balance = abi.decode(ethCall.results[0].result, (uint256));
    }
}
```

## Complete Usage

```typescript
async function main() {
  // Arbitrum USDC address
  const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address;
  const holder = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address; // vitalik.eth

  // Single balance read
  console.log("Reading balance on Arbitrum...");
  const balance = await readRemoteBalance(ARB_USDC, holder);
  console.log(`Balance: ${balance} (raw, 6 decimals)`);
  console.log(`Balance: ${Number(balance) / 1e6} USDC`);

  // Batch read
  console.log("\nReading full token info...");
  const info = await readTokenInfo(ARB_USDC, holder);
  console.log(`Balance: ${Number(info.balance) / 10 ** info.decimals} USDC`);
  console.log(`Total Supply: ${Number(info.totalSupply) / 10 ** info.decimals} USDC`);
  console.log(`As of block: ${info.blockNumber}`);

  // Multi-chain read
  console.log("\nReading USDC across chains...");
  const usdcAddresses: Record<number, Address> = {
    [WORMHOLE_ARBITRUM_CHAIN_ID]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    [WORMHOLE_BASE_CHAIN_ID]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    [WORMHOLE_OPTIMISM_CHAIN_ID]: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  };

  const multiBalances = await readMultiChainBalances(usdcAddresses, holder);
  for (const [chainId, bal] of multiBalances) {
    console.log(`Chain ${chainId}: ${Number(bal) / 1e6} USDC`);
  }
}

main().catch(console.error);
```

## Notes

- Queries are read-only -- they do not modify state on the target chain.
- No gas is spent on the target chain. The Guardians execute the `eth_call` themselves.
- Use `"finalized"` block tag for data that needs strong consistency guarantees. Use `"latest"` for lower latency when eventual consistency is acceptable.
- Query responses include the block number and timestamp, enabling staleness checks on-chain.
- Multi-chain queries are atomic -- all chain reads are executed and returned together.
- The Query API may rate limit aggressive usage. Cache results when freshness requirements allow.
