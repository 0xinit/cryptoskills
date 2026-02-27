# Token Bridging on Polygon

Bridge tokens between Ethereum and Polygon chains using the PoS Bridge and zkEVM LxLy Bridge.

## PoS Bridge: Deposit (Ethereum -> Polygon PoS)

Deposits take ~7-8 minutes via state sync from Ethereum to Polygon PoS.

### Deposit ERC20

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
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const ROOT_CHAIN_MANAGER = "0xA0c68C638235ee32657e8f720a23ceC1bFc77C77" as const;
const ERC20_PREDICATE = "0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf" as const;

const rootChainManagerAbi = parseAbi([
  "function depositFor(address user, address rootToken, bytes calldata depositData) external",
  "function depositEtherFor(address user) external payable",
  "function exit(bytes calldata inputData) external",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY!}`);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

async function depositERC20(
  tokenAddress: Address,
  amount: bigint,
  recipient: Address
): Promise<void> {
  // Step 1: Approve ERC20Predicate to spend tokens
  const currentAllowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, ERC20_PREDICATE],
  });

  if (currentAllowance < amount) {
    const approveTx = await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [ERC20_PREDICATE, amount],
    });
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
    if (approveReceipt.status === "reverted") {
      throw new Error("Approval transaction reverted");
    }
  }

  // Step 2: Deposit via RootChainManager
  // depositData is ABI-encoded amount
  const depositData = encodeAbiParameters(
    parseAbiParameters("uint256"),
    [amount]
  );

  const depositTx = await walletClient.writeContract({
    address: ROOT_CHAIN_MANAGER,
    abi: rootChainManagerAbi,
    functionName: "depositFor",
    args: [recipient, tokenAddress, depositData],
  });

  const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });
  if (depositReceipt.status === "reverted") {
    throw new Error("Deposit transaction reverted");
  }

  console.log(`Deposit tx: ${depositTx}`);
  console.log("Tokens will arrive on Polygon PoS in ~7-8 minutes");
}
```

### Deposit ETH (PoS Bridge)

```typescript
async function depositETH(amount: bigint, recipient: Address): Promise<void> {
  const depositTx = await walletClient.writeContract({
    address: ROOT_CHAIN_MANAGER,
    abi: rootChainManagerAbi,
    functionName: "depositEtherFor",
    args: [recipient],
    value: amount,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });
  if (receipt.status === "reverted") {
    throw new Error("ETH deposit reverted");
  }
  console.log(`ETH deposit tx: ${depositTx}`);
}
```

## PoS Bridge: Withdraw (Polygon PoS -> Ethereum)

Withdrawals require waiting for a checkpoint (~30 minutes) then submitting an exit proof on Ethereum.

### Step 1: Burn on Polygon PoS

```typescript
import { createWalletClient, http, parseAbi, type Address } from "viem";
import { polygon } from "viem/chains";

const polygonWallet = createWalletClient({
  account,
  chain: polygon,
  transport: http("https://polygon-rpc.com"),
});

// For ERC20: transfer to zero address or call withdraw on the child token
const childErc20Abi = parseAbi([
  "function withdraw(uint256 amount) external",
]);

async function burnOnPolygon(childTokenAddress: Address, amount: bigint): Promise<string> {
  const burnTx = await polygonWallet.writeContract({
    address: childTokenAddress,
    abi: childErc20Abi,
    functionName: "withdraw",
    args: [amount],
  });
  console.log(`Burn tx on Polygon: ${burnTx}`);
  console.log("Wait for checkpoint inclusion (~30 min) before calling exit on Ethereum");
  return burnTx;
}
```

### Step 2: Check Checkpoint and Exit on Ethereum

```typescript
const PROOF_API = "https://proof-generator.polygon.technology/api/v1";

async function isCheckpointed(burnTxBlockNumber: bigint): Promise<boolean> {
  const response = await fetch(
    `${PROOF_API}/matic/block-included/${burnTxBlockNumber}?networkType=mainnet`
  );
  const data = await response.json();
  return data.message === "success";
}

async function getExitProof(burnTxHash: string): Promise<string> {
  const response = await fetch(
    `${PROOF_API}/matic/exit-payload/${burnTxHash}?eventSignature=0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036`
  );
  const data = await response.json();
  return data.result;
}

async function exitOnEthereum(burnTxHash: string): Promise<void> {
  const exitPayload = await getExitProof(burnTxHash);

  const exitTx = await walletClient.writeContract({
    address: ROOT_CHAIN_MANAGER,
    abi: rootChainManagerAbi,
    functionName: "exit",
    args: [exitPayload as `0x${string}`],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: exitTx });
  if (receipt.status === "reverted") {
    throw new Error("Exit transaction reverted");
  }
  console.log(`Exit tx on Ethereum: ${exitTx}`);
}
```

## zkEVM LxLy Bridge: Bridge Asset (Ethereum -> zkEVM)

```typescript
import { createWalletClient, createPublicClient, http, parseAbi, type Address } from "viem";
import { mainnet } from "viem/chains";

const ZKEVM_BRIDGE = "0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe" as const;

const bridgeAbi = parseAbi([
  "function bridgeAsset(uint32 destinationNetwork, address destinationAddress, uint256 amount, address token, bool forceUpdateGlobalExitRoot, bytes calldata permitData) external payable",
  "function claimAsset(bytes32[32] calldata smtProofLocalExitRoot, bytes32[32] calldata smtProofRollupExitRoot, uint256 globalIndex, bytes32 mainnetExitRoot, bytes32 rollupExitRoot, uint32 originNetwork, address originTokenAddress, uint32 destinationNetwork, address destinationAddress, uint256 amount, bytes calldata metadata) external",
]);

// networkId 0 = Ethereum mainnet
// networkId 1 = Polygon zkEVM mainnet
const ZKEVM_NETWORK_ID = 1;

async function bridgeETHToZkEVM(amount: bigint, recipient: Address): Promise<void> {
  // For ETH: token address is 0x0, amount sent as msg.value
  const bridgeTx = await walletClient.writeContract({
    address: ZKEVM_BRIDGE,
    abi: bridgeAbi,
    functionName: "bridgeAsset",
    args: [
      ZKEVM_NETWORK_ID,
      recipient,
      amount,
      "0x0000000000000000000000000000000000000000",
      true,  // forceUpdateGlobalExitRoot
      "0x",  // no permit data
    ],
    value: amount,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: bridgeTx });
  if (receipt.status === "reverted") {
    throw new Error("Bridge transaction reverted");
  }
  console.log(`Bridge tx: ${bridgeTx}`);
  console.log("Claim on zkEVM after proof is generated (~10-30 min)");
}

async function bridgeERC20ToZkEVM(
  tokenAddress: Address,
  amount: bigint,
  recipient: Address
): Promise<void> {
  // Step 1: Approve bridge contract
  const approveTx = await walletClient.writeContract({
    address: tokenAddress,
    abi: parseAbi(["function approve(address,uint256) external returns (bool)"]),
    functionName: "approve",
    args: [ZKEVM_BRIDGE, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  // Step 2: Bridge the token
  const bridgeTx = await walletClient.writeContract({
    address: ZKEVM_BRIDGE,
    abi: bridgeAbi,
    functionName: "bridgeAsset",
    args: [
      ZKEVM_NETWORK_ID,
      recipient,
      amount,
      tokenAddress,
      true,
      "0x",
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: bridgeTx });
  if (receipt.status === "reverted") {
    throw new Error("ERC20 bridge transaction reverted");
  }
  console.log(`ERC20 bridge tx: ${bridgeTx}`);
}
```

## zkEVM LxLy Bridge: Claim on Destination

After bridging, retrieve the Merkle proof from the bridge API and call `claimAsset`.

```typescript
const ZKEVM_BRIDGE_API = "https://bridge-api.zkevm-rpc.com";

interface BridgeDeposit {
  deposit_cnt: number;
  network_id: number;
  orig_net: number;
  orig_addr: string;
  amount: string;
  dest_net: number;
  dest_addr: string;
  ready_for_claim: boolean;
}

async function getClaimableDeposits(address: Address): Promise<BridgeDeposit[]> {
  const response = await fetch(
    `${ZKEVM_BRIDGE_API}/bridges/${address}?offset=0&limit=25`
  );
  const data = await response.json();
  return data.deposits.filter((d: BridgeDeposit) => d.ready_for_claim);
}

interface MerkleProof {
  merkle_proof: string[];
  rollup_merkle_proof: string[];
  main_exit_root: string;
  rollup_exit_root: string;
}

async function getMerkleProof(
  depositCount: number,
  networkId: number
): Promise<MerkleProof> {
  const response = await fetch(
    `${ZKEVM_BRIDGE_API}/merkle-proof?deposit_cnt=${depositCount}&net_id=${networkId}`
  );
  const data = await response.json();
  return data.proof;
}
```

## Bridge Monitoring

```typescript
async function monitorPosBridgeDeposit(txHash: string): Promise<void> {
  const PROOF_API = "https://proof-generator.polygon.technology/api/v1";

  const response = await fetch(
    `${PROOF_API}/matic/exit-payload/${txHash}?eventSignature=0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036`
  );

  if (response.ok) {
    console.log("Checkpoint included, ready for exit");
  } else {
    console.log("Checkpoint not yet included, try again later");
  }
}

async function monitorZkEvmBridge(address: Address): Promise<void> {
  const deposits = await getClaimableDeposits(address);
  for (const deposit of deposits) {
    console.log(`Deposit ${deposit.deposit_cnt}: ready=${deposit.ready_for_claim}, amount=${deposit.amount}`);
  }
}
```

## Third-Party Bridge Aggregators

For production use, consider bridge aggregators that find optimal routes:

| Aggregator | URL | Notes |
|------------|-----|-------|
| Socket | https://socket.tech | Multi-chain bridge aggregator |
| LI.FI | https://li.fi | Cross-chain DEX + bridge |
| Bungee | https://bungee.exchange | Socket-powered UI |
| Jumper | https://jumper.exchange | LI.FI-powered UI |
| Polygon Portal | https://portal.polygon.technology/bridge | Official Polygon bridge UI |
