# Create Safe Examples

Creating and deploying Safe multisig wallets using Safe{Core} Protocol Kit.

## Setup

```typescript
import Safe from "@safe-global/protocol-kit";
import { SafeAccountConfig } from "@safe-global/protocol-kit";

const RPC_URL = process.env.RPC_URL!;
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
```

## Deploy a 2-of-3 Multisig

```typescript
async function deployTwoOfThree() {
  const safeAccountConfig: SafeAccountConfig = {
    owners: [
      "0xOwner1Address",
      "0xOwner2Address",
      "0xOwner3Address",
    ],
    threshold: 2,
  };

  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: DEPLOYER_KEY,
    predictedSafe: {
      safeAccountConfig,
      safeDeploymentConfig: {
        saltNonce: BigInt(Date.now()).toString(),
        safeVersion: "1.4.1",
      },
    },
  });

  const predictedAddress = await protocolKit.getAddress();
  console.log("Safe will deploy to:", predictedAddress);

  const deployTx = await protocolKit.createSafeDeploymentTransaction();

  // Re-init with the deployed address
  const deployedKit = await Safe.init({
    provider: RPC_URL,
    signer: DEPLOYER_KEY,
    safeAddress: predictedAddress,
  });

  const isDeployed = await deployedKit.isSafeDeployed();
  console.log("Deployed:", isDeployed);

  return predictedAddress;
}
```

## Deploy a 3-of-5 Multisig

```typescript
async function deployThreeOfFive() {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: DEPLOYER_KEY,
    predictedSafe: {
      safeAccountConfig: {
        owners: [
          "0xOwner1Address",
          "0xOwner2Address",
          "0xOwner3Address",
          "0xOwner4Address",
          "0xOwner5Address",
        ],
        threshold: 3,
      },
      safeDeploymentConfig: {
        saltNonce: BigInt(Date.now()).toString(),
        safeVersion: "1.4.1",
      },
    },
  });

  const predictedAddress = await protocolKit.getAddress();
  console.log("3-of-5 Safe will deploy to:", predictedAddress);

  await protocolKit.createSafeDeploymentTransaction();
  return predictedAddress;
}
```

## Predict Address Before Deployment

The Safe address is deterministic. Same owners, threshold, salt nonce, and Safe version always produce the same address. Use this to pre-fund or whitelist a Safe before deployment.

```typescript
async function predictSafeAddress(
  owners: string[],
  threshold: number,
  saltNonce: string
): Promise<string> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: DEPLOYER_KEY,
    predictedSafe: {
      safeAccountConfig: { owners, threshold },
      safeDeploymentConfig: {
        saltNonce,
        safeVersion: "1.4.1",
      },
    },
  });

  const predictedAddress = await protocolKit.getAddress();
  console.log("Predicted address:", predictedAddress);

  // Not deployed yet -- isSafeDeployed() would return false
  return predictedAddress;
}

// Same inputs always produce the same address
const addr1 = await predictSafeAddress(
  ["0xOwner1", "0xOwner2"],
  1,
  "42"
);
const addr2 = await predictSafeAddress(
  ["0xOwner1", "0xOwner2"],
  1,
  "42"
);
console.log(addr1 === addr2); // true
```

## Deploy with Custom Fallback Handler

```typescript
async function deployWithFallbackHandler() {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: DEPLOYER_KEY,
    predictedSafe: {
      safeAccountConfig: {
        owners: ["0xOwner1", "0xOwner2", "0xOwner3"],
        threshold: 2,
        // v1.4.1 Compatibility Fallback Handler
        fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
      },
      safeDeploymentConfig: {
        saltNonce: BigInt(Date.now()).toString(),
        safeVersion: "1.4.1",
      },
    },
  });

  const address = await protocolKit.getAddress();
  await protocolKit.createSafeDeploymentTransaction();
  return address;
}
```

## Verify Deployment

```typescript
async function verifySafeDeployment(safeAddress: string) {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: DEPLOYER_KEY,
    safeAddress,
  });

  const isDeployed = await protocolKit.isSafeDeployed();
  if (!isDeployed) {
    throw new Error(`Safe at ${safeAddress} is not deployed`);
  }

  const owners = await protocolKit.getOwners();
  const threshold = await protocolKit.getThreshold();
  const nonce = await protocolKit.getNonce();

  console.log({
    address: safeAddress,
    owners,
    threshold,
    nonce,
    deployed: isDeployed,
  });

  return { owners, threshold, nonce };
}
```

## Complete Example

```typescript
async function main() {
  const owners = [
    "0xOwner1Address",
    "0xOwner2Address",
    "0xOwner3Address",
  ];
  const threshold = 2;
  const saltNonce = BigInt(Date.now()).toString();

  // Predict address
  const predicted = await predictSafeAddress(owners, threshold, saltNonce);
  console.log("Will deploy to:", predicted);

  // Deploy
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: DEPLOYER_KEY,
    predictedSafe: {
      safeAccountConfig: { owners, threshold },
      safeDeploymentConfig: { saltNonce, safeVersion: "1.4.1" },
    },
  });
  await protocolKit.createSafeDeploymentTransaction();

  // Verify
  const info = await verifySafeDeployment(predicted);
  console.log("Safe deployed and verified:", info);
}

main().catch(console.error);
```
