# Interchain Accounts

Execute transactions on a remote chain using Hyperlane Interchain Accounts (ICA). An ICA is a smart contract account on the destination chain that only you (via Hyperlane messaging from the origin chain) can control.

## Architecture

```
Ethereum (Origin)                      Arbitrum (Destination)
┌────────────────┐                     ┌──────────────────────┐
│  Your EOA/     │──dispatch──────────>│  ICA Router          │
│  Contract      │                     │    │                  │
└────────────────┘                     │    v                  │
                                       │  Your ICA Account    │
                                       │  (deterministic addr)│
                                       │    │                  │
                                       │    v                  │
                                       │  Target Contract     │
                                       │  (any contract)      │
                                       └──────────────────────┘
```

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseAbi,
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

const ICA_ROUTER = "0xYourICARouterAddress" as const;
const ARBITRUM_DOMAIN = 42161;
```

## Get Your ICA Address

The ICA address is deterministic. You can compute it before ever using it. Fund it before executing calls that require ETH.

```typescript
const icaRouterAbi = parseAbi([
  "function callRemote(uint32 _destinationDomain, (address to, uint256 value, bytes data)[] _calls) payable returns (bytes32 messageId)",
  "function getRemoteInterchainAccount(uint32 _destination, address _owner, address _router, address _ism) view returns (address)",
  "function quoteGasPayment(uint32 _destinationDomain) view returns (uint256)",
]);

async function getICAAddress(
  destinationDomain: number,
  owner: Address,
  router: Address,
  ism: Address
): Promise<Address> {
  const icaAddress = await publicClient.readContract({
    address: ICA_ROUTER,
    abi: icaRouterAbi,
    functionName: "getRemoteInterchainAccount",
    args: [destinationDomain, owner, router, ism],
  });

  return icaAddress;
}

// Zero address for default ISM
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const myICAOnArbitrum = await getICAAddress(
  ARBITRUM_DOMAIN,
  account.address,
  ICA_ROUTER,
  ZERO_ADDRESS
);
console.log(`Your ICA on Arbitrum: ${myICAOnArbitrum}`);
```

## Execute a Remote ERC-20 Transfer

Transfer tokens that your ICA holds on the destination chain.

```typescript
async function executeRemoteTransfer(
  tokenAddress: Address,
  to: Address,
  amount: bigint
): Promise<{ hash: `0x${string}`; messageId: `0x${string}` }> {
  // Encode the ERC-20 transfer calldata
  const transferCalldata = encodeFunctionData({
    abi: parseAbi([
      "function transfer(address to, uint256 amount) returns (bool)",
    ]),
    functionName: "transfer",
    args: [to, amount],
  });

  // Quote gas
  const gasFee = await publicClient.readContract({
    address: ICA_ROUTER,
    abi: icaRouterAbi,
    functionName: "quoteGasPayment",
    args: [ARBITRUM_DOMAIN],
  });

  // Execute the remote call
  const { request, result } = await publicClient.simulateContract({
    address: ICA_ROUTER,
    abi: icaRouterAbi,
    functionName: "callRemote",
    args: [
      ARBITRUM_DOMAIN,
      [
        {
          to: tokenAddress,
          value: 0n,
          data: transferCalldata,
        },
      ],
    ],
    value: gasFee,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("ICA call reverted");

  return { hash, messageId: result };
}
```

## Execute Multiple Remote Calls (Batched)

ICA supports batching multiple calls in a single cross-chain message.

```typescript
async function executeBatchRemoteCalls(
  calls: { to: Address; value: bigint; data: `0x${string}` }[]
): Promise<{ hash: `0x${string}`; messageId: `0x${string}` }> {
  const gasFee = await publicClient.readContract({
    address: ICA_ROUTER,
    abi: icaRouterAbi,
    functionName: "quoteGasPayment",
    args: [ARBITRUM_DOMAIN],
  });

  const { request, result } = await publicClient.simulateContract({
    address: ICA_ROUTER,
    abi: icaRouterAbi,
    functionName: "callRemote",
    args: [ARBITRUM_DOMAIN, calls],
    value: gasFee,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Batch ICA call reverted");

  return { hash, messageId: result };
}
```

## Complete Example: Approve + Swap on Remote Chain

Execute a DeFi operation on Arbitrum from Ethereum — approve a DEX router and swap tokens, all in one cross-chain transaction.

```typescript
async function main() {
  // Look up your ICA address on Arbitrum
  const myICA = await getICAAddress(
    ARBITRUM_DOMAIN,
    account.address,
    ICA_ROUTER,
    ZERO_ADDRESS
  );
  console.log(`ICA on Arbitrum: ${myICA}`);
  console.log(`Fund this address with tokens before executing calls.`);

  const USDC_ARBITRUM: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const SWAP_ROUTER: Address = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
  const swapAmount = 500_000000n; // 500 USDC (6 decimals)

  // Batch: approve router + execute swap
  const approveCalldata = encodeFunctionData({
    abi: parseAbi([
      "function approve(address spender, uint256 amount) returns (bool)",
    ]),
    functionName: "approve",
    args: [SWAP_ROUTER, swapAmount],
  });

  const swapCalldata = encodeFunctionData({
    abi: parseAbi([
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
    ]),
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: USDC_ARBITRUM,
        tokenOut: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as Address, // WETH on Arbitrum
        fee: 500,
        recipient: myICA, // tokens go back to ICA
        amountIn: swapAmount,
        amountOutMinimum: 0n, // SET IN PRODUCTION — quote first
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const { hash, messageId } = await executeBatchRemoteCalls([
    { to: USDC_ARBITRUM, value: 0n, data: approveCalldata },
    { to: SWAP_ROUTER, value: 0n, data: swapCalldata },
  ]);

  console.log(`Cross-chain ICA call dispatched: ${hash}`);
  console.log(`Message ID: ${messageId}`);
  console.log(
    `Track: https://explorer.hyperlane.xyz/message/${messageId}`
  );
}

main().catch(console.error);
```
