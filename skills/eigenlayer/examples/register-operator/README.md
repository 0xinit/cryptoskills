# Register as an EigenLayer Operator

Working TypeScript example for registering as an EigenLayer operator and opting into an AVS.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
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

const DELEGATION_MANAGER = "0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A" as const;
const AVS_DIRECTORY = "0x135DDa560e946695d6f155dACaFC6f1F25C1F5AF" as const;
```

## ABIs

```typescript
const delegationManagerAbi = parseAbi([
  "function registerAsOperator((address earningsReceiver, address delegationApprover, uint32 stakerOptOutWindowBlocks) registeringOperatorDetails, string metadataURI) external",
  "function modifyOperatorDetails((address earningsReceiver, address delegationApprover, uint32 stakerOptOutWindowBlocks) newOperatorDetails) external",
  "function updateOperatorMetadataURI(string metadataURI) external",
  "function isOperator(address operator) external view returns (bool)",
  "function operatorDetails(address operator) external view returns ((address earningsReceiver, address delegationApprover, uint32 stakerOptOutWindowBlocks))",
]);

const avsDirectoryAbi = parseAbi([
  "function registerOperatorToAVS(address operator, (bytes signature, bytes32 salt, uint256 expiry) operatorSignature) external",
  "function deregisterOperatorFromAVS(address operator) external",
  "function calculateOperatorAVSRegistrationDigestHash(address operator, address avs, bytes32 salt, uint256 expiry) external view returns (bytes32)",
  "function operatorSaltIsSpent(address operator, bytes32 salt) external view returns (bool)",
]);
```

## Register as Operator

```typescript
async function registerAsOperator(params: {
  earningsReceiver: Address;
  metadataURI: string;
  delegationApprover?: Address;
  stakerOptOutWindowBlocks?: number;
}): Promise<`0x${string}`> {
  const isAlreadyOperator = await publicClient.readContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "isOperator",
    args: [account.address],
  });

  if (isAlreadyOperator) {
    throw new Error("Address is already registered as an operator");
  }

  const zeroAddress = "0x0000000000000000000000000000000000000000" as Address;

  const { request } = await publicClient.simulateContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "registerAsOperator",
    args: [
      {
        earningsReceiver: params.earningsReceiver,
        // Zero address = anyone can delegate without approval
        delegationApprover: params.delegationApprover ?? zeroAddress,
        stakerOptOutWindowBlocks: params.stakerOptOutWindowBlocks ?? 0,
      },
      params.metadataURI,
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Registration reverted");

  return hash;
}
```

## Generate AVS Registration Signature

Operators must sign a message to authorize their registration to a specific AVS. The AVS's ServiceManager calls `AVSDirectory.registerOperatorToAVS()` with this signature.

```typescript
import { keccak256, toBytes } from "viem";

async function generateAvsRegistrationSignature(
  avsAddress: Address
): Promise<{
  signature: `0x${string}`;
  salt: `0x${string}`;
  expiry: bigint;
}> {
  // Random salt -- must not have been used before
  const salt = keccak256(
    toBytes(`${account.address}-${avsAddress}-${Date.now()}`)
  );

  // Signature valid for 1 hour
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);

  // Verify salt is not already spent
  const saltSpent = await publicClient.readContract({
    address: AVS_DIRECTORY,
    abi: avsDirectoryAbi,
    functionName: "operatorSaltIsSpent",
    args: [account.address, salt],
  });
  if (saltSpent) throw new Error("Salt already spent");

  const digestHash = await publicClient.readContract({
    address: AVS_DIRECTORY,
    abi: avsDirectoryAbi,
    functionName: "calculateOperatorAVSRegistrationDigestHash",
    args: [account.address, avsAddress, salt, expiry],
  });

  const signature = await walletClient.signMessage({
    message: { raw: digestHash },
  });

  return { signature, salt, expiry };
}
```

## Check Operator Status

```typescript
async function getOperatorDetails(operatorAddress: Address) {
  const isOperator = await publicClient.readContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "isOperator",
    args: [operatorAddress],
  });

  if (!isOperator) {
    return { isOperator: false, details: null };
  }

  const details = await publicClient.readContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "operatorDetails",
    args: [operatorAddress],
  });

  return {
    isOperator: true,
    details: {
      earningsReceiver: details.earningsReceiver,
      delegationApprover: details.delegationApprover,
      stakerOptOutWindowBlocks: details.stakerOptOutWindowBlocks,
    },
  };
}
```

## Update Operator Metadata

```typescript
async function updateMetadata(
  newMetadataURI: string
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "updateOperatorMetadataURI",
    args: [newMetadataURI],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Metadata update reverted");

  return hash;
}
```

## Complete Usage

```typescript
async function main() {
  // Step 1: Register as operator
  // Metadata should be hosted at a public URL (HTTPS or IPFS)
  const metadataURI = "https://myoperator.xyz/eigenlayer-metadata.json";

  console.log("Registering as operator...");
  const regHash = await registerAsOperator({
    earningsReceiver: account.address,
    metadataURI,
  });
  console.log(`Registration tx: ${regHash}`);

  // Step 2: Generate signature for AVS registration
  // The AVS will call registerOperatorToAVS with this signature
  const avsAddress = "0x..." as Address; // Replace with target AVS ServiceManager
  const { signature, salt, expiry } = await generateAvsRegistrationSignature(
    avsAddress
  );
  console.log("AVS registration signature generated:");
  console.log(`  Signature: ${signature}`);
  console.log(`  Salt: ${salt}`);
  console.log(`  Expiry: ${expiry}`);

  // Step 3: Send signature to AVS for on-chain registration
  // The AVS ServiceManager calls AVSDirectory.registerOperatorToAVS()
  // with the operator address and this signature
}

main().catch(console.error);
```

## Operator Metadata Schema

Host a JSON file at your `metadataURI` following this schema:

```json
{
  "name": "My Operator",
  "website": "https://myoperator.xyz",
  "description": "Professional EigenLayer operator with 99.9% uptime",
  "logo": "https://myoperator.xyz/logo.png",
  "twitter": "https://twitter.com/myoperator"
}
```

## Notes

- An operator is automatically delegated to themselves upon registration.
- `delegationApprover` set to zero address means any staker can delegate without approval. Set it to a non-zero address to require approval signatures for each delegation.
- `stakerOptOutWindowBlocks` sets the minimum notice period a staker must wait after opting out. Cannot be decreased after registration.
- The AVS registration signature has an expiry. Generate it close to when the AVS will submit it on-chain.
- Each salt can only be used once per operator. The `operatorSaltIsSpent` check prevents replay.
