# Create a Morpho Blue Market

Deploy a new isolated lending market on Morpho Blue. Anyone can create a market -- no governance approval needed. The market is identified by its five parameters and is immutable once created.

## Prerequisites

- **Oracle** deployed and returning valid prices in Morpho's 36-decimal format
- **IRM** governance-enabled (e.g., AdaptiveCurveIRM at `0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC`)
- **LLTV** governance-enabled (see enabled LLTVs table in SKILL.md)
- Both loan and collateral tokens deployed and liquid

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  keccak256,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const MORPHO = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as const;
const ADAPTIVE_CURVE_IRM = "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC" as const;
```

## Market ID Derivation

```typescript
type MarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

function computeMarketId(params: MarketParams): `0x${string}` {
  const encoded = encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
    ],
    [
      params.loanToken,
      params.collateralToken,
      params.oracle,
      params.irm,
      params.lltv,
    ]
  );
  return keccak256(encoded);
}
```

## ABI

```typescript
const morphoAbi = [
  {
    name: "createMarket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: "idToMarketParams",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
    ],
  },
] as const;
```

## Create Market

```typescript
async function createMorphoMarket(
  params: MarketParams
): Promise<{ hash: `0x${string}`; marketId: `0x${string}` }> {
  // Compute market ID before creation to verify it does not already exist
  const marketId = computeMarketId(params);

  // Check if market already exists by reading its params
  const existingParams = await publicClient.readContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "idToMarketParams",
    args: [marketId],
  });

  // If loanToken is non-zero, market already exists
  if (existingParams.loanToken !== "0x0000000000000000000000000000000000000000") {
    throw new Error(`Market already exists with ID: ${marketId}`);
  }

  // Simulate to catch reverts (non-enabled IRM or LLTV)
  const { request } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "createMarket",
    args: [params],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error("createMarket reverted");
  }

  return { hash, marketId };
}
```

## Complete Usage

```typescript
async function main() {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address;

  const marketParams: MarketParams = {
    loanToken: USDC,
    collateralToken: WETH,
    oracle: "0x..." as Address, // Your deployed MorphoChainlinkOracleV2
    irm: ADAPTIVE_CURVE_IRM,
    lltv: 860000000000000000n, // 86% -- must be governance-enabled
  };

  // Preview market ID
  const marketId = computeMarketId(marketParams);
  console.log(`Market ID will be: ${marketId}`);

  // Create market
  const { hash } = await createMorphoMarket(marketParams);
  console.log(`Market created: ${hash}`);
}

main().catch(console.error);
```

## Common Pitfalls

- **Non-enabled LLTV** -- `createMarket` reverts if the LLTV value has not been enabled by Morpho governance. Check the enabled LLTVs table.
- **Non-enabled IRM** -- Same applies to the IRM address. Only governance-enabled IRMs are accepted.
- **Duplicate market** -- Creating a market with identical params is a no-op (does not revert, but wastes gas). Check existence first.
- **Oracle not returning valid price** -- The oracle must return a non-zero price when `price()` is called. Deploy and verify the oracle before creating the market.
- **Immutability** -- Once created, the market parameters can never be changed. Triple-check oracle and IRM addresses before deploying.
