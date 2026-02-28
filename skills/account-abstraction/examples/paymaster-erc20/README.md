# Pay Gas with ERC-20 Tokens

Working TypeScript example for sending a UserOperation where gas is paid in ERC-20 tokens via a Pimlico ERC-20 paymaster.

## Dependencies

```bash
npm install permissionless viem
```

## Setup

```typescript
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import {
  createPublicClient,
  http,
  parseEther,
  parseAbi,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});

const owner = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const; // Sepolia USDC

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
]);
```

## Create Smart Account with ERC-20 Paymaster

```typescript
const simpleAccount = await toSimpleSmartAccount({
  client: publicClient,
  owner,
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});

const pimlicoClient = createPimlicoClient({
  transport: http(
    `https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`
  ),
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});
```

## Approve Paymaster for Token Spending

The ERC-20 paymaster contract needs approval to pull tokens from the smart account. This approval is typically done once, or as part of the first UserOp.

```typescript
async function approvePaymasterForToken(
  paymasterAddress: Address,
  token: Address,
  amount: bigint
): Promise<`0x${string}`> {
  const smartAccountClient = createSmartAccountClient({
    account: simpleAccount,
    chain: sepolia,
    bundlerTransport: http(
      `https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`
    ),
    // First approval must be self-paid or use a sponsoring paymaster
    paymaster: pimlicoClient,
  });

  const txHash = await smartAccountClient.sendTransaction({
    to: token,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [paymasterAddress, amount],
    }),
  });

  return txHash;
}
```

## Estimate Gas Cost in Tokens

```typescript
async function estimateTokenGasCost(
  paymasterAddress: Address
): Promise<{ tokenAmount: bigint; tokenSymbol: string }> {
  // Pimlico ERC-20 paymaster exposes token cost estimation
  const paymasterAbi = parseAbi([
    "function getTokenValueOfEth(uint256 ethAmount) external view returns (uint256)",
  ]);

  // Typical UserOp gas cost ~0.001 ETH on L1, much less on L2
  const estimatedEthCost = parseEther("0.002");

  const tokenAmount = await publicClient.readContract({
    address: paymasterAddress,
    abi: paymasterAbi,
    functionName: "getTokenValueOfEth",
    args: [estimatedEthCost],
  });

  return { tokenAmount, tokenSymbol: "USDC" };
}
```

## Send UserOp Paying Gas in USDC

```typescript
async function sendWithERC20Gas(
  to: Address,
  value: bigint,
  data: `0x${string}`
): Promise<`0x${string}`> {
  const smartAccountClient = createSmartAccountClient({
    account: simpleAccount,
    chain: sepolia,
    bundlerTransport: http(
      `https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`
    ),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      },
    },
  });

  const txHash = await smartAccountClient.sendTransaction({
    to,
    value,
    data,
  });

  return txHash;
}
```

## Complete Usage

```typescript
import { encodeFunctionData } from "viem";

async function main() {
  const paymasterAddress = "0x..." as Address; // Pimlico ERC-20 paymaster

  // Check USDC balance in smart account
  const balance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [simpleAccount.address],
  });
  console.log(`USDC balance: ${balance}`);

  // Estimate gas cost
  const { tokenAmount } = await estimateTokenGasCost(paymasterAddress);
  console.log(`Estimated gas cost: ${tokenAmount} USDC`);

  // Send a transaction, gas paid in USDC
  const recipient = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address;
  const txHash = await sendWithERC20Gas(recipient, parseEther("0.001"), "0x");
  console.log(`Tx hash: ${txHash}`);
}

main().catch(console.error);
```

## Notes

- The smart account must hold enough ERC-20 tokens to cover gas costs. The paymaster charges tokens at a markup over the ETH gas price.
- Token approval to the paymaster contract must be granted before the first ERC-20-paid UserOp. Use a sponsored (verifying) paymaster for the initial approval transaction.
- Pimlico's ERC-20 paymaster supports USDC, USDT, and DAI on most chains. Check the Pimlico dashboard for supported tokens per chain.
- The paymaster pulls tokens from the smart account in the `postOp` phase, after execution succeeds. If the account lacks sufficient tokens at `postOp` time, the entire UserOp reverts.
