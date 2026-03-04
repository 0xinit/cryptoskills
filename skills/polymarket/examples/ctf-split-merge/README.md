# CTF Split and Merge on Polymarket

Demonstrates splitting USDC into conditional outcome tokens, merging tokens back to USDC, and redeeming winning tokens after market resolution using the Conditional Token Framework.

## Prerequisites

```bash
npm install viem @polymarket/clob-client
```

Environment variables:

```
PRIVATE_KEY=0x...    # Polygon wallet private key
RPC_URL=https://...  # Polygon RPC endpoint
```

## Full Working Code

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

const USDC: Address = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const CTF: Address = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

// USDC.e on Polygon has 6 decimals
const USDC_DECIMALS = 6;

const ctfAbi = parseAbi([
  "function splitPosition(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata partition, uint256 amount) external",
  "function mergePositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata partition, uint256 amount) external",
  "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
]);

// Zero bytes32 for parentCollectionId (top-level positions)
const PARENT_COLLECTION_ID = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

// Binary market partition: Yes=1, No=2
const BINARY_PARTITION = [1n, 2n];

async function main() {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
  const transport = http(process.env.RPC_URL);

  const publicClient = createPublicClient({ chain: polygon, transport });
  const walletClient = createWalletClient({ account, chain: polygon, transport });

  // Replace with a real condition ID from the Gamma API
  const CONDITION_ID = "0xYOUR_CONDITION_ID" as Hex;

  // Replace with real token IDs from the market's tokens array
  const YES_TOKEN_ID = 12345n; // BigInt of the Yes token ID
  const NO_TOKEN_ID = 67890n;  // BigInt of the No token ID

  const usdcAmount = 100n * 10n ** BigInt(USDC_DECIMALS); // 100 USDC

  // --- Check and Approve USDC for CTF ---
  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, CTF],
  });

  if (allowance < usdcAmount) {
    console.log("Approving USDC for CTF contract...");
    const approveTx = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [CTF, usdcAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log("Approved:", approveTx);
  }

  // --- Split: USDC -> Yes + No Tokens ---
  console.log("\nSplitting 100 USDC into outcome tokens...");
  const splitTx = await walletClient.writeContract({
    address: CTF,
    abi: ctfAbi,
    functionName: "splitPosition",
    args: [USDC, PARENT_COLLECTION_ID, CONDITION_ID, BINARY_PARTITION, usdcAmount],
  });
  const splitReceipt = await publicClient.waitForTransactionReceipt({ hash: splitTx });
  console.log("Split tx:", splitTx, "status:", splitReceipt.status);

  // Check token balances
  const yesBalance = await publicClient.readContract({
    address: CTF,
    abi: ctfAbi,
    functionName: "balanceOf",
    args: [account.address, YES_TOKEN_ID],
  });
  const noBalance = await publicClient.readContract({
    address: CTF,
    abi: ctfAbi,
    functionName: "balanceOf",
    args: [account.address, NO_TOKEN_ID],
  });
  console.log(`Yes tokens: ${yesBalance}, No tokens: ${noBalance}`);

  // --- Merge: Yes + No Tokens -> USDC ---
  // Merge half back to USDC
  const mergeAmount = 50n * 10n ** BigInt(USDC_DECIMALS);
  console.log("\nMerging 50 token pairs back to USDC...");
  const mergeTx = await walletClient.writeContract({
    address: CTF,
    abi: ctfAbi,
    functionName: "mergePositions",
    args: [USDC, PARENT_COLLECTION_ID, CONDITION_ID, BINARY_PARTITION, mergeAmount],
  });
  const mergeReceipt = await publicClient.waitForTransactionReceipt({ hash: mergeTx });
  console.log("Merge tx:", mergeTx, "status:", mergeReceipt.status);

  // --- Redeem: After Market Resolution ---
  // Only call this after the market has resolved
  console.log("\nRedeeming positions (only works after resolution)...");
  try {
    const redeemTx = await walletClient.writeContract({
      address: CTF,
      abi: ctfAbi,
      functionName: "redeemPositions",
      // indexSets [1, 2] redeems both outcomes; only winner pays out
      args: [USDC, PARENT_COLLECTION_ID, CONDITION_ID, [1n, 2n]],
    });
    const redeemReceipt = await publicClient.waitForTransactionReceipt({ hash: redeemTx });
    console.log("Redeem tx:", redeemTx, "status:", redeemReceipt.status);
  } catch (err) {
    console.log("Redeem failed (market likely not resolved yet):", (err as Error).message);
  }
}

main().catch(console.error);
```

## Expected Output

```
Approving USDC for CTF contract...
Approved: 0xabc123...

Splitting 100 USDC into outcome tokens...
Split tx: 0xdef456... status: success
Yes tokens: 100000000, No tokens: 100000000

Merging 50 token pairs back to USDC...
Merge tx: 0xghi789... status: success

Redeeming positions (only works after resolution)...
Redeem tx: 0xjkl012... status: success
```

## Notes

- **Split** requires USDC approval for the CTF contract, not the Exchange contract.
- **Merge** requires equal amounts of both Yes and No tokens. No approval needed since you hold the tokens.
- **Redeem** burns your entire token balance for the condition. There is no amount parameter. Pass `indexSets: [1, 2]` to redeem both outcomes; only the winning outcome pays.
- USDC.e on Polygon has 6 decimals. All amounts are in base units (1 USDC = 1,000,000).
- For neg risk (multi-outcome) markets, use the Neg Risk Adapter (`0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`) for conversions between outcomes.
- Token IDs are large uint256 values. Get them from the Gamma API `tokens` array on the market object rather than computing them manually.
