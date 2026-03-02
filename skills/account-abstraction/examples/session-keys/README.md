# Session Keys for Scoped Access

Working TypeScript example for creating, using, and revoking session keys with ZeroDev Kernel's permission framework.

## Dependencies

```bash
npm install @zerodev/sdk @zerodev/ecdsa-validator @zerodev/permissions permissionless viem
```

## Setup

```typescript
import {
  createKernelAccount,
  createKernelAccountClient,
} from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  toPermissionValidator,
  toCallPolicy,
  CallPolicyVersion,
  ParamCondition,
} from "@zerodev/permissions";
import { toECDSASigner } from "@zerodev/permissions/signers";
import {
  createPublicClient,
  http,
  parseEther,
  parseAbi,
  encodeFunctionData,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import {
  generatePrivateKey,
  privateKeyToAccount,
} from "viem/accounts";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});

const ownerSigner = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const TOKEN_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;
const ALLOWED_RECIPIENT = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address;

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);
```

## Create the Owner Account

```typescript
const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
  signer: ownerSigner,
  entryPoint: entryPoint07Address,
});

const ownerAccount = await createKernelAccount(publicClient, {
  plugins: {
    sudo: ecdsaValidator,
  },
  entryPoint: entryPoint07Address,
});

console.log(`Kernel account: ${ownerAccount.address}`);
```

## Create a Session Key with Constraints

Session keys are ephemeral key pairs with on-chain constraints enforced by the permission validator module. The constraints define exactly what the session key can do.

```typescript
async function createSessionKey(): Promise<{
  sessionPrivateKey: `0x${string}`;
  sessionAccount: typeof ownerAccount;
}> {
  const sessionPrivateKey = generatePrivateKey();
  const sessionKeySigner = privateKeyToAccount(sessionPrivateKey);

  const ecdsaSigner = toECDSASigner({
    signer: sessionKeySigner,
  });

  // Scoped to: transfer TOKEN to ALLOWED_RECIPIENT only
  const permissionValidator = await toPermissionValidator(publicClient, {
    entryPoint: entryPoint07Address,
    signer: ecdsaSigner,
    policies: [
      toCallPolicy({
        policyVersion: CallPolicyVersion.V0_0_4,
        permissions: [
          {
            target: TOKEN_ADDRESS,
            abi: erc20Abi,
            functionName: "transfer",
            args: [
              {
                condition: ParamCondition.EQUAL,
                value: ALLOWED_RECIPIENT,
              },
              null,
            ],
          },
        ],
      }),
    ],
  });

  const sessionAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
      regular: permissionValidator,
    },
    entryPoint: entryPoint07Address,
  });

  return { sessionPrivateKey, sessionAccount };
}
```

## Use the Session Key

```typescript
async function executeWithSessionKey(
  sessionAccount: typeof ownerAccount,
  amount: bigint
): Promise<`0x${string}`> {
  const sessionClient = createKernelAccountClient({
    account: sessionAccount,
    chain: sepolia,
    bundlerTransport: http(process.env.BUNDLER_URL),
  });

  const txHash = await sessionClient.sendTransaction({
    to: TOKEN_ADDRESS,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [ALLOWED_RECIPIENT, amount],
    }),
  });

  return txHash;
}
```

## Revoke a Session Key

The owner can disable the permission validator module, which revokes all session keys associated with it.

```typescript
async function revokeSessionKey(
  permissionValidatorAddress: Address
): Promise<`0x${string}`> {
  const ownerClient = createKernelAccountClient({
    account: ownerAccount,
    chain: sepolia,
    bundlerTransport: http(process.env.BUNDLER_URL),
  });

  const txHash = await ownerClient.sendUserOperation({
    calls: [
      {
        to: ownerAccount.address,
        data: encodeFunctionData({
          abi: parseAbi([
            "function disablePlugin(address plugin) external",
          ]),
          functionName: "disablePlugin",
          args: [permissionValidatorAddress],
        }),
      },
    ],
  });

  return txHash;
}
```

## Complete Usage

```typescript
async function main() {
  console.log("Creating session key...");
  const { sessionPrivateKey, sessionAccount } = await createSessionKey();
  console.log("Session key created (store sessionPrivateKey securely)");

  console.log("\nExecuting transfer via session key...");
  const txHash = await executeWithSessionKey(
    sessionAccount,
    parseEther("10")
  );
  console.log(`Transfer tx: ${txHash}`);

  // The session key CANNOT call other functions or send to other recipients
  // Attempting to call approve() or transfer to a non-whitelisted address
  // will fail at the validation phase
}

main().catch(console.error);
```

## Notes

- Session keys are validated on-chain by the permission validator module. The constraints are enforced during `validateUserOp`, not during execution. This means invalid session key usage fails cheaply during validation.
- The `ParamCondition` enum supports `EQUAL`, `GREATER_THAN`, `LESS_THAN`, `GREATER_THAN_OR_EQUAL`, `LESS_THAN_OR_EQUAL`, and `NOT_EQUAL` for flexible parameter constraints.
- Session key private keys should be stored client-side (localStorage, secure enclave) and never sent to a backend. They are intentionally limited in scope.
- Revoking a permission validator disables ALL session keys using that validator. For granular revocation, use separate validator instances per session key.
- ERC-7579 modules provide the standard interface for validator plugins. Kernel implements ERC-7579, making session key modules portable across compatible smart accounts.
