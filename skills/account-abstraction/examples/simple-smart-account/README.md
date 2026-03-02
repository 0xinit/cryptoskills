# Create and Use a Simple Smart Account

Working TypeScript example for creating a SimpleAccount smart account with permissionless.js and sending a UserOperation via a Pimlico bundler.

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

## Create Smart Account

The SimpleAccount is a minimal ERC-4337 account with ECDSA signature validation. The account address is deterministic based on the owner and salt.

```typescript
const simpleAccount = await toSimpleSmartAccount({
  client: publicClient,
  owner,
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  },
});

console.log(`Smart account address: ${simpleAccount.address}`);
```

## Create Smart Account Client

The client wraps the account with bundler and paymaster configuration. All subsequent transactions go through the ERC-4337 pipeline.

```typescript
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
```

## Send a UserOperation

```typescript
async function sendUserOp(
  to: Address,
  value: bigint
): Promise<`0x${string}`> {
  const txHash = await smartAccountClient.sendTransaction({
    to,
    value,
    data: "0x",
  });

  return txHash;
}
```

## Check UserOp Receipt

```typescript
async function waitForReceipt(hash: `0x${string}`) {
  const receipt = await smartAccountClient.waitForUserOperationReceipt({
    hash,
  });

  if (!receipt.success) {
    throw new Error(`UserOp failed: ${receipt.reason}`);
  }

  return receipt;
}
```

## Complete Usage

```typescript
async function main() {
  const recipient = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address;

  console.log(`Account: ${simpleAccount.address}`);
  console.log(`Owner: ${owner.address}`);

  const txHash = await sendUserOp(recipient, parseEther("0.001"));
  console.log(`UserOp hash: ${txHash}`);

  const receipt = await waitForReceipt(txHash);
  console.log(`Transaction mined in block: ${receipt.receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.actualGasUsed}`);
}

main().catch(console.error);
```

## Notes

- The smart account is deployed on first UserOp if it does not exist yet. The `initCode` is automatically included by the SDK.
- Pimlico's paymaster sponsors gas on testnets. For mainnet, you need a funded paymaster policy in the Pimlico dashboard.
- The `entryPoint07Address` constant is `0x0000000071727De22E5E9d8BAf0edAc6f37da032`, deployed on all EVM chains.
- Gas estimation is handled by the Pimlico bundler. The `estimateFeesPerGas` callback fetches current gas prices from the bundler.
