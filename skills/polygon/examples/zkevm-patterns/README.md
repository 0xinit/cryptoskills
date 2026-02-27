# Polygon zkEVM Patterns

Patterns and considerations specific to deploying and interacting with Polygon zkEVM.

## Chain Setup

```typescript
import { createPublicClient, createWalletClient, http } from "viem";
import { polygonZkEvm } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY!}`);

const publicClient = createPublicClient({
  chain: polygonZkEvm,
  transport: http("https://zkevm-rpc.com"),
});

const walletClient = createWalletClient({
  account,
  chain: polygonZkEvm,
  transport: http("https://zkevm-rpc.com"),
});
```

## Deployment on zkEVM

Standard Solidity contracts deploy without modification. zkEVM is Type-2 EVM-equivalent.

```bash
# Foundry deployment -- same as any EVM chain
forge create src/MyContract.sol:MyContract \
  --rpc-url https://zkevm-rpc.com \
  --private-key $PRIVATE_KEY \
  --broadcast
```

```typescript
// Viem deployment
import { encodeDeployData } from "viem";

const deployData = encodeDeployData({
  abi: myContractAbi,
  bytecode: myContractBytecode,
  args: [constructorArg1, constructorArg2],
});

const hash = await walletClient.sendTransaction({
  data: deployData,
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status === "reverted") {
  throw new Error("Deployment reverted");
}
console.log(`Deployed at: ${receipt.contractAddress}`);
```

## EVM Opcode Differences

zkEVM aims for full EVM equivalence, but some opcodes behave differently due to ZK circuit constraints.

| Opcode | Behavior on zkEVM |
|--------|-------------------|
| `DIFFICULTY` / `PREVRANDAO` | Returns `0`. No beacon chain randomness. |
| `SELFDESTRUCT` | Disabled (noop per EIP-6049). |
| `BLOCKHASH` | Returns hashes for last 256 blocks. Same spec, but proof timing may affect edge cases. |
| `COINBASE` | Returns sequencer address. |
| `NUMBER` | Returns L2 block number, not L1. |

### Contracts That May Need Changes

If your contract relies on `PREVRANDAO` for randomness, replace with Chainlink VRF or a commit-reveal scheme:

```solidity
// BAD on zkEVM: PREVRANDAO returns 0
function pseudoRandom() external view returns (uint256) {
    return block.prevrandao; // Always 0 on zkEVM
}

// GOOD: Use Chainlink VRF or off-chain randomness
// See chainlink skill for VRF integration
```

## Gas Estimation on zkEVM

Gas on zkEVM includes L2 execution cost and amortized L1 data/proof costs.

```typescript
async function estimateZkEvmGas(
  to: `0x${string}`,
  data: `0x${string}`
): Promise<{ estimatedGas: bigint; gasPrice: bigint; totalCostWei: bigint }> {
  const gasPrice = await publicClient.getGasPrice();

  const estimatedGas = await publicClient.estimateGas({
    account: account.address,
    to,
    data,
  });

  const totalCostWei = gasPrice * estimatedGas;

  return { estimatedGas, gasPrice, totalCostWei };
}
```

### Gas Price Behavior

- zkEVM uses a single gas price (no EIP-1559 base/priority split)
- Gas price fluctuates with L1 gas prices since batch data is posted to Ethereum
- During L1 congestion, zkEVM gas prices increase proportionally

```typescript
// Monitor gas price trends
const gasPrice = await publicClient.getGasPrice();
// Typical range: 0.01-0.5 gwei (much lower than L1)
// Spikes correlate with Ethereum L1 gas spikes
```

## Transaction Finality on zkEVM

Transactions go through three states. Choose the right trust level for your application.

```typescript
type FinalityLevel = "trusted" | "virtual" | "consolidated";

async function checkTransactionFinality(
  txHash: `0x${string}`
): Promise<FinalityLevel> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (!receipt) {
    throw new Error("Transaction not found");
  }

  const blockNumber = receipt.blockNumber;

  // Check consolidated (fully proven on L1)
  // Use zkEVM-specific RPC method
  const consolidatedBlock = await publicClient.request({
    method: "zkevm_consolidatedBlockNumber" as "eth_blockNumber",
    params: [],
  });

  if (blockNumber <= BigInt(consolidatedBlock)) {
    return "consolidated";
  }

  // Check virtual (batch posted to L1, not yet proven)
  const virtualBlock = await publicClient.request({
    method: "zkevm_virtualBatchNumber" as "eth_blockNumber",
    params: [],
  });

  if (blockNumber <= BigInt(virtualBlock)) {
    return "virtual";
  }

  return "trusted";
}
```

## Testing on Cardona Testnet

```typescript
import { defineChain } from "viem";

const polygonZkEvmCardona = defineChain({
  id: 2442,
  name: "Polygon zkEVM Cardona",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.cardona.zkevm-rpc.com"] },
  },
  blockExplorers: {
    default: { name: "Polygonscan", url: "https://cardona-zkevm.polygonscan.com" },
  },
  testnet: true,
});

const cardonaClient = createPublicClient({
  chain: polygonZkEvmCardona,
  transport: http(),
});

// Get testnet ETH from https://faucet.polygon.technology
// Select "Polygon zkEVM Cardona" network
```

```bash
# Foundry deployment to Cardona
forge create src/MyContract.sol:MyContract \
  --rpc-url https://rpc.cardona.zkevm-rpc.com \
  --private-key $PRIVATE_KEY \
  --broadcast

# Verify on Cardona explorer
forge verify-contract <ADDRESS> src/MyContract.sol:MyContract \
  --chain-id 2442 \
  --verifier-url https://api-cardona-zkevm.polygonscan.com/api \
  --etherscan-api-key $POLYGONSCAN_API_KEY
```

## zkEVM-Specific RPC Methods

The zkEVM RPC extends standard Ethereum JSON-RPC with additional methods:

| Method | Description |
|--------|-------------|
| `zkevm_consolidatedBlockNumber` | Latest block with verified ZK proof on L1 |
| `zkevm_virtualBatchNumber` | Latest batch posted to L1 (not yet proven) |
| `zkevm_verifiedBatchNumber` | Latest batch verified on L1 |
| `zkevm_batchNumberByBlockNumber` | Get batch number for a given block |
| `zkevm_getBatchByNumber` | Get batch details |
| `zkevm_isBlockConsolidated` | Check if block is finalized |
| `zkevm_isBlockVirtualized` | Check if block batch is on L1 |

```typescript
// Query zkEVM-specific state
const consolidatedBlock = await publicClient.request({
  method: "zkevm_consolidatedBlockNumber" as "eth_blockNumber",
  params: [],
});

const virtualBatch = await publicClient.request({
  method: "zkevm_virtualBatchNumber" as "eth_blockNumber",
  params: [],
});

console.log(`Consolidated block: ${consolidatedBlock}`);
console.log(`Virtual batch: ${virtualBatch}`);
```
