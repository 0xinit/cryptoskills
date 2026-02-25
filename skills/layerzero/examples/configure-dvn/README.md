# Configure DVN Examples

Working TypeScript examples for configuring Decentralized Verifier Networks (DVNs) on a LayerZero V2 OApp deployment.

## Overview

DVN configuration determines which verifiers must attest to your cross-chain messages. Each pathway (source chain -> destination chain) has its own DVN config for both the send and receive libraries.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
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

// Ethereum addresses
const ENDPOINT_V2: Address = "0x1a44076050125825900e736c501f859c50fE728c";
const SEND_LIB: Address = "0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1";
const RECEIVE_LIB: Address = "0xc02Ab410f0734EFa3F14628780e6e695156024C2";

// DVN addresses on Ethereum
const LZ_DVN: Address = "0x589dEDbD617eE7783Ae3a7427E16b13280a2C00C";
const GOOGLE_DVN: Address = "0xD56e4eAb23cb81f43168F9F45211Eb027b9aC7cc";
const POLYHEDRA_DVN: Address = "0x8ddf05F9A5c488b4973897E278B58895bF87Cb24";

const OAPP: Address = "0xYourOAppAddress" as Address;
const ARBITRUM_EID = 30110;
```

## ULN Config Structure

```typescript
// ULN (Ultra Light Node) configuration
interface UlnConfig {
  confirmations: bigint;       // block confirmations before DVN can verify
  requiredDVNCount: number;    // DVNs that ALL must verify
  optionalDVNCount: number;    // size of optional DVN pool
  optionalDVNThreshold: number; // how many optional DVNs must verify
  requiredDVNs: Address[];     // required DVN addresses (sorted ascending)
  optionalDVNs: Address[];     // optional DVN addresses (sorted ascending)
}
```

## Encode ULN Config

```typescript
// Config type 2 = ULN config for both send and receive libraries
const CONFIG_TYPE_ULN = 2;

function encodeUlnConfig(config: UlnConfig): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters(
      "uint64 confirmations, uint8 requiredDVNCount, uint8 optionalDVNCount, uint8 optionalDVNThreshold, address[] requiredDVNs, address[] optionalDVNs"
    ),
    [
      config.confirmations,
      config.requiredDVNCount,
      config.optionalDVNCount,
      config.optionalDVNThreshold,
      config.requiredDVNs,
      config.optionalDVNs,
    ]
  );
}
```

## Configure Send Library DVNs

Set which DVNs verify outbound messages from your OApp on the source chain.

```typescript
const endpointAbi = parseAbi([
  "function setConfig(address oapp, address lib, (uint32 eid, uint32 configType, bytes config)[] calldata params) external",
]);

async function configureSendDVN(
  dstEid: number,
  config: UlnConfig
): Promise<`0x${string}`> {
  const encodedConfig = encodeUlnConfig(config);

  const { request } = await publicClient.simulateContract({
    address: ENDPOINT_V2,
    abi: endpointAbi,
    functionName: "setConfig",
    args: [
      OAPP,
      SEND_LIB,
      [
        {
          eid: dstEid,
          configType: CONFIG_TYPE_ULN,
          config: encodedConfig,
        },
      ],
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("setSendConfig reverted");

  return hash;
}
```

## Configure Receive Library DVNs

Set which DVNs must have verified inbound messages before your OApp accepts them.

```typescript
async function configureReceiveDVN(
  srcEid: number,
  config: UlnConfig
): Promise<`0x${string}`> {
  const encodedConfig = encodeUlnConfig(config);

  const { request } = await publicClient.simulateContract({
    address: ENDPOINT_V2,
    abi: endpointAbi,
    functionName: "setConfig",
    args: [
      OAPP,
      RECEIVE_LIB,
      [
        {
          eid: srcEid,
          configType: CONFIG_TYPE_ULN,
          config: encodedConfig,
        },
      ],
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("setReceiveConfig reverted");

  return hash;
}
```

## Example: Production Security Config

Require LayerZero Labs DVN, plus 1-of-2 optional DVNs (Google Cloud, Polyhedra).

```typescript
async function configureProductionSecurity(): Promise<void> {
  // DVN addresses MUST be sorted in ascending order
  const sortedOptionalDVNs = [GOOGLE_DVN, POLYHEDRA_DVN].sort(
    (a, b) => a.toLowerCase().localeCompare(b.toLowerCase())
  ) as Address[];

  const config: UlnConfig = {
    confirmations: 15n,           // 15 block confirmations for Ethereum
    requiredDVNCount: 1,
    optionalDVNCount: 2,
    optionalDVNThreshold: 1,      // 1 of 2 optional must also verify
    requiredDVNs: [LZ_DVN],
    optionalDVNs: sortedOptionalDVNs,
  };

  // Configure send side (Ethereum -> Arbitrum)
  const sendHash = await configureSendDVN(ARBITRUM_EID, config);
  console.log(`Send DVN configured: ${sendHash}`);

  // Configure receive side (Arbitrum -> Ethereum)
  const receiveHash = await configureReceiveDVN(ARBITRUM_EID, config);
  console.log(`Receive DVN configured: ${receiveHash}`);
}
```

## Example: Minimal Config (LayerZero DVN Only)

For testnet or lower-value pathways:

```typescript
const minimalConfig: UlnConfig = {
  confirmations: 5n,
  requiredDVNCount: 1,
  optionalDVNCount: 0,
  optionalDVNThreshold: 0,
  requiredDVNs: [LZ_DVN],
  optionalDVNs: [],
};
```

## Example: High-Security Config (2 Required + 2-of-3 Optional)

For high-value protocols:

```typescript
const ANIMOCA_DVN: Address = "0x7E65BDd15C8Db8995F80aBf0D6593b57dc8BE437";

const highSecConfig: UlnConfig = {
  confirmations: 64n,           // deep finality on Ethereum
  requiredDVNCount: 2,
  optionalDVNCount: 3,
  optionalDVNThreshold: 2,
  requiredDVNs: [LZ_DVN, GOOGLE_DVN].sort(
    (a, b) => a.toLowerCase().localeCompare(b.toLowerCase())
  ) as Address[],
  optionalDVNs: [POLYHEDRA_DVN, ANIMOCA_DVN, LZ_DVN].sort(
    (a, b) => a.toLowerCase().localeCompare(b.toLowerCase())
  ) as Address[],
};
```

## Read Current DVN Config

```typescript
const getConfigAbi = parseAbi([
  "function getConfig(address oapp, address lib, uint32 eid, uint32 configType) view returns (bytes memory config)",
]);

async function readCurrentConfig(
  lib: Address,
  eid: number
): Promise<void> {
  const configBytes = await publicClient.readContract({
    address: ENDPOINT_V2,
    abi: getConfigAbi,
    functionName: "getConfig",
    args: [OAPP, lib, eid, CONFIG_TYPE_ULN],
  });

  console.log(`Raw config for eid ${eid}: ${configBytes}`);
}
```

## Important Notes

- DVN addresses in `requiredDVNs` and `optionalDVNs` arrays **must be sorted in ascending order**. The contract reverts on unsorted arrays.
- Configuration is per-pathway. Ethereum->Arbitrum and Arbitrum->Ethereum are configured independently.
- Send config is set on the source chain. Receive config is set on the destination chain.
- Both sides must be configured. If only the send side is configured, the receive side falls back to defaults (which may differ from your intent).
- The caller must be the OApp's delegate (typically the owner).
