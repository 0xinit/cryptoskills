# Token Bridge: Bridge ERC-20 with Wrapped Token Attestation and Redemption

Working example: bridge an ERC-20 token from Ethereum to Arbitrum using Wormhole's legacy Token Bridge. Covers attestation (first-time registration), transfer (lock on source), and redemption (mint wrapped on destination).

## When to Use Token Bridge

Use the Token Bridge when:
- You do not control the token contract (third-party tokens like WETH, USDC, etc.)
- You need wrapped token representations on the destination chain
- You are integrating with existing Token Bridge wrapped assets

Use NTT instead when:
- You deploy and control the token on both chains
- You need canonical (non-wrapped) tokens on the destination
- You need full decimal precision (Token Bridge truncates to 8 decimals)

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, arbitrum } from "viem/chains";

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const ethClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const ethWallet = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const arbClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARB_RPC_URL),
});

const arbWallet = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(process.env.ARB_RPC_URL),
});

const ETH_CORE_BRIDGE = "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B" as const;
const ETH_TOKEN_BRIDGE = "0x3ee18B2214AFF97000D974cf647E7C347E8fa585" as const;
const ARB_TOKEN_BRIDGE = "0x0b2402144Bb366A632D14B83F244D2e0e21bD39c" as const;

const WORMHOLE_ETHEREUM_CHAIN_ID = 2;
const WORMHOLE_ARBITRUM_CHAIN_ID = 23;
```

## ABIs

```typescript
const coreBridgeAbi = [
  {
    name: "messageFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const tokenBridgeAbi = [
  {
    name: "attestToken",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tokenAddress", type: "address" },
      { name: "nonce", type: "uint32" },
    ],
    outputs: [{ name: "sequence", type: "uint64" }],
  },
  {
    name: "createWrapped",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "encodedVm", type: "bytes" }],
    outputs: [{ name: "token", type: "address" }],
  },
  {
    name: "transferTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "recipientChain", type: "uint16" },
      { name: "recipient", type: "bytes32" },
      { name: "arbiterFee", type: "uint256" },
      { name: "nonce", type: "uint32" },
    ],
    outputs: [{ name: "sequence", type: "uint64" }],
  },
  {
    name: "completeTransfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "encodedVm", type: "bytes" }],
    outputs: [],
  },
  {
    name: "wrappedAsset",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenChainId", type: "uint16" },
      { name: "tokenAddress", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "isWrappedAsset",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

## Helper Functions

```typescript
function evmAddressToBytes32(address: Address): `0x${string}` {
  return `0x000000000000000000000000${address.slice(2)}` as `0x${string}`;
}

interface VaaResponse {
  data: { vaa: string };
}

async function fetchVaa(
  emitterChain: number,
  emitterAddress: string,
  sequence: bigint,
  maxRetries = 60,
  delayMs = 5000
): Promise<Uint8Array> {
  const url = `https://api.wormholescan.io/api/v1/vaas/${emitterChain}/${emitterAddress}/${sequence}`;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const json = (await response.json()) as VaaResponse;
        return Uint8Array.from(atob(json.data.vaa), (c) => c.charCodeAt(0));
      }
    } catch {
      // Guardian network not ready, retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`VAA not found after ${maxRetries} retries`);
}
```

## Step 1: Attest Token (First-Time Registration)

Before a token can be transferred via the Token Bridge, it must be "attested" -- this registers the token metadata on the destination chain so a wrapped version can be created.

```typescript
async function attestToken(tokenAddress: Address): Promise<bigint> {
  const messageFee = await ethClient.readContract({
    address: ETH_CORE_BRIDGE,
    abi: coreBridgeAbi,
    functionName: "messageFee",
  });

  const { request, result } = await ethClient.simulateContract({
    address: ETH_TOKEN_BRIDGE,
    abi: tokenBridgeAbi,
    functionName: "attestToken",
    args: [tokenAddress, 0],
    value: messageFee,
    account: account.address,
  });

  const hash = await ethWallet.writeContract(request);
  const receipt = await ethClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("attestToken reverted");

  console.log(`Attestation tx: ${hash}`);
  return result;
}
```

## Step 2: Create Wrapped Token on Destination

After the attestation VAA is signed by Guardians, submit it to the destination Token Bridge to create the wrapped token contract.

```typescript
async function createWrapped(attestationSequence: bigint): Promise<Address> {
  // Token Bridge emitter address
  const emitterAddress = evmAddressToBytes32(ETH_TOKEN_BRIDGE).slice(2);

  console.log("Waiting for attestation VAA...");
  const vaaBytes = await fetchVaa(
    WORMHOLE_ETHEREUM_CHAIN_ID,
    emitterAddress,
    attestationSequence
  );

  const encodedVaa = `0x${Buffer.from(vaaBytes).toString("hex")}` as `0x${string}`;

  const { request, result } = await arbClient.simulateContract({
    address: ARB_TOKEN_BRIDGE,
    abi: tokenBridgeAbi,
    functionName: "createWrapped",
    args: [encodedVaa],
    account: account.address,
  });

  const hash = await arbWallet.writeContract(request);
  const receipt = await arbClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("createWrapped reverted");

  console.log(`Wrapped token created at: ${result}`);
  return result;
}
```

## Step 3: Check if Wrapped Asset Already Exists

Skip attestation if the token has already been registered.

```typescript
async function getWrappedAsset(
  originChainId: number,
  originTokenAddress: Address
): Promise<Address | null> {
  const tokenBytes32 = evmAddressToBytes32(originTokenAddress);

  const wrappedAddress = await arbClient.readContract({
    address: ARB_TOKEN_BRIDGE,
    abi: tokenBridgeAbi,
    functionName: "wrappedAsset",
    args: [originChainId, tokenBytes32],
  });

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  if (wrappedAddress === ZERO_ADDRESS) return null;

  return wrappedAddress;
}
```

## Step 4: Transfer Tokens (Lock on Source)

```typescript
async function transferTokens(
  tokenAddress: Address,
  amount: bigint
): Promise<{ hash: `0x${string}`; sequence: bigint }> {
  const messageFee = await ethClient.readContract({
    address: ETH_CORE_BRIDGE,
    abi: coreBridgeAbi,
    functionName: "messageFee",
  });

  // Approve Token Bridge to spend tokens
  const { request: approveReq } = await ethClient.simulateContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [ETH_TOKEN_BRIDGE, amount],
    account: account.address,
  });
  const approveHash = await ethWallet.writeContract(approveReq);
  const approveReceipt = await ethClient.waitForTransactionReceipt({ hash: approveHash });
  if (approveReceipt.status !== "success") throw new Error("Approval reverted");

  // Token Bridge normalizes to 8 decimals -- amounts below 1e-8 base unit are lost
  const { request: transferReq, result: sequence } = await ethClient.simulateContract({
    address: ETH_TOKEN_BRIDGE,
    abi: tokenBridgeAbi,
    functionName: "transferTokens",
    args: [
      tokenAddress,
      amount,
      WORMHOLE_ARBITRUM_CHAIN_ID,
      evmAddressToBytes32(account.address),
      0n, // arbiterFee: 0 = self-relay
      0,  // nonce
    ],
    value: messageFee,
    account: account.address,
  });

  const hash = await ethWallet.writeContract(transferReq);
  const receipt = await ethClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("transferTokens reverted");

  return { hash, sequence };
}
```

## Step 5: Redeem on Destination (Mint Wrapped Tokens)

```typescript
async function redeemTransfer(transferSequence: bigint): Promise<`0x${string}`> {
  const emitterAddress = evmAddressToBytes32(ETH_TOKEN_BRIDGE).slice(2);

  console.log("Waiting for transfer VAA...");
  const vaaBytes = await fetchVaa(
    WORMHOLE_ETHEREUM_CHAIN_ID,
    emitterAddress,
    transferSequence
  );

  const encodedVaa = `0x${Buffer.from(vaaBytes).toString("hex")}` as `0x${string}`;

  const { request } = await arbClient.simulateContract({
    address: ARB_TOKEN_BRIDGE,
    abi: tokenBridgeAbi,
    functionName: "completeTransfer",
    args: [encodedVaa],
    account: account.address,
  });

  const hash = await arbWallet.writeContract(request);
  const receipt = await arbClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("completeTransfer reverted");

  return hash;
}
```

## Complete Usage

```typescript
async function main() {
  // Example: bridge DAI from Ethereum to Arbitrum
  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as Address;
  const amount = 100_000000000000000000n; // 100 DAI (18 decimals)

  // Check if wrapped DAI already exists on Arbitrum
  const existingWrapped = await getWrappedAsset(WORMHOLE_ETHEREUM_CHAIN_ID, DAI);

  if (!existingWrapped) {
    console.log("Attesting DAI on Arbitrum...");
    const attestSequence = await attestToken(DAI);
    await createWrapped(attestSequence);
  } else {
    console.log(`Wrapped DAI already exists: ${existingWrapped}`);
  }

  // Transfer DAI to Arbitrum
  console.log("Transferring 100 DAI to Arbitrum...");
  const { hash: transferHash, sequence } = await transferTokens(DAI, amount);
  console.log(`Transfer tx: ${transferHash}`);

  // Redeem wrapped DAI on Arbitrum
  console.log("Redeeming on Arbitrum...");
  const redeemHash = await redeemTransfer(sequence);
  console.log(`Redemption tx: ${redeemHash}`);

  // Check wrapped DAI balance on Arbitrum
  const wrappedAddress = await getWrappedAsset(WORMHOLE_ETHEREUM_CHAIN_ID, DAI);
  if (wrappedAddress) {
    const balance = await arbClient.readContract({
      address: wrappedAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    // Token Bridge truncates to 8 decimals, so 100 DAI = 10_000_000_000 (1e10)
    console.log(`Wrapped DAI balance: ${balance}`);
  }
}

main().catch(console.error);
```

## Decimal Precision Warning

The Token Bridge normalizes all amounts to 8 decimal places. For tokens with more than 8 decimals:

| Token Decimals | Amount Sent | Amount Received (normalized) | Precision Lost |
|---------------|-------------|------------------------------|---------------|
| 18 (DAI, WETH) | 100.123456789012345678 | 100.12345678 | Yes (10 digits) |
| 8 (WBTC) | 1.12345678 | 1.12345678 | No |
| 6 (USDC, USDT) | 1000.123456 | 1000.123456 | No |

If you need full precision, use NTT instead.

## Notes

- Attestation is a one-time operation per token per destination chain. Once attested, the wrapped token contract is permanent.
- The `arbiterFee` parameter allows a third party to redeem the transfer and claim a fee. Set to 0 for self-relay.
- Each VAA can only be redeemed once. Attempting to call `completeTransfer` twice with the same VAA reverts with replay protection.
- The wrapped token name includes the source chain (e.g., "DAI (Wormhole)" or has the `wh` suffix).
- Token Bridge transfers typically take 15-20 minutes on Ethereum (finality + Guardian signing).
