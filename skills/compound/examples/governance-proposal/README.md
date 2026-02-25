# Governance Proposal Example

Create and vote on Compound governance proposals using GovernorBravo.

## Overview

Compound governance uses:
- **COMP Token** — ERC-20 governance token. Must be delegated to vote.
- **GovernorBravo** — Proposal creation, voting, and execution.
- **Timelock** — Enforces a delay between proposal passing and execution.

Key thresholds:
- **Proposal threshold**: 25,000 COMP delegated to proposer
- **Quorum**: 400,000 COMP votes required for a proposal to pass
- **Voting period**: ~2.5 days (19,710 blocks on Ethereum)
- **Timelock delay**: 2 days

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
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

const COMP = "0xc00e94Cb662C3520282E6f5717214004A7f26888" as const;
const GOVERNOR_BRAVO = "0xc0Da02939E1441F497fd74F78cE7Decb17B66529" as const;
const TIMELOCK = "0x6d903f6003cca6255D85CcA4D3B5E5146dC33925" as const;
```

## ABIs

```typescript
const compAbi = [
  {
    name: "delegate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "delegatee", type: "address" }],
    outputs: [],
  },
  {
    name: "getCurrentVotes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint96" }],
  },
] as const;

const governorBravoAbi = [
  {
    name: "propose",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "signatures", type: "string[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "castVote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "castVoteWithReason",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "queue",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "state",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "proposals",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "proposer", type: "address" },
      { name: "eta", type: "uint256" },
      { name: "startBlock", type: "uint256" },
      { name: "endBlock", type: "uint256" },
      { name: "forVotes", type: "uint256" },
      { name: "againstVotes", type: "uint256" },
      { name: "abstainVotes", type: "uint256" },
      { name: "canceled", type: "bool" },
      { name: "executed", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "proposalThreshold",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

## Delegate COMP Voting Power

COMP must be delegated before it can be used to propose or vote. Self-delegation is required even for your own tokens.

```typescript
async function delegateComp(delegatee: Address): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: COMP,
    abi: compAbi,
    functionName: "delegate",
    args: [delegatee],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Delegate reverted");

  return hash;
}

// Self-delegate to activate voting power
await delegateComp(account.address);
```

## Check Voting Power

```typescript
async function getVotingPower(voter: Address): Promise<bigint> {
  return publicClient.readContract({
    address: COMP,
    abi: compAbi,
    functionName: "getCurrentVotes",
    args: [voter],
  });
}

const votes = await getVotingPower(account.address);
// COMP has 18 decimals
console.log(`Voting power: ${Number(votes) / 1e18} COMP`);
```

## Create a Proposal

Proposals encode on-chain actions: targets, values, function signatures, and calldata. The Timelock executes these after the voting period and delay.

```typescript
async function createProposal(
  targets: Address[],
  values: bigint[],
  signatures: string[],
  calldatas: `0x${string}`[],
  description: string
): Promise<{ hash: `0x${string}`; proposalId: bigint }> {
  // Verify proposer meets threshold
  const threshold = await publicClient.readContract({
    address: GOVERNOR_BRAVO,
    abi: governorBravoAbi,
    functionName: "proposalThreshold",
  });
  const votes = await getVotingPower(account.address);
  if (votes < threshold) {
    throw new Error(
      `Insufficient voting power: ${votes} < ${threshold} (need ${Number(threshold) / 1e18} COMP)`
    );
  }

  const { request, result } = await publicClient.simulateContract({
    address: GOVERNOR_BRAVO,
    abi: governorBravoAbi,
    functionName: "propose",
    args: [targets, values, signatures, calldatas, description],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Propose reverted");

  return { hash, proposalId: result };
}
```

## Example: Propose Adjusting Supply Cap

```typescript
const CONFIGURATOR = "0x316f9708bB98af7dA9c68C1C3b5e79039cD336E3" as const;
const COMET_USDC = "0xc3d688B66703497DAA19211EEdff47f25384cdc3" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;

// Encode the calldata for setSupplyCap
const newSupplyCap = 500_000n * 10n ** 18n; // 500,000 WETH

const calldata = encodeFunctionData({
  abi: [
    {
      name: "setSupplyCap",
      type: "function",
      inputs: [
        { name: "cometProxy", type: "address" },
        { name: "asset", type: "address" },
        { name: "newSupplyCap", type: "uint128" },
      ],
    },
  ],
  functionName: "setSupplyCap",
  args: [COMET_USDC, WETH, newSupplyCap],
});

const { proposalId } = await createProposal(
  [CONFIGURATOR],
  [0n],
  [""], // empty string = use calldata directly
  [calldata],
  "# Increase WETH Supply Cap\n\nIncrease the WETH collateral supply cap on the USDC market from 400,000 to 500,000 WETH to accommodate growing demand."
);

console.log(`Proposal created: ${proposalId}`);
```

## Vote on a Proposal

```typescript
// Proposal state enum:
// 0 = Pending, 1 = Active, 2 = Canceled, 3 = Defeated
// 4 = Succeeded, 5 = Queued, 6 = Expired, 7 = Executed

const PROPOSAL_STATES = [
  "Pending", "Active", "Canceled", "Defeated",
  "Succeeded", "Queued", "Expired", "Executed",
] as const;

async function getProposalState(proposalId: bigint): Promise<string> {
  const state = await publicClient.readContract({
    address: GOVERNOR_BRAVO,
    abi: governorBravoAbi,
    functionName: "state",
    args: [proposalId],
  });
  return PROPOSAL_STATES[state] ?? "Unknown";
}

// Vote support: 0 = Against, 1 = For, 2 = Abstain
async function vote(
  proposalId: bigint,
  support: 0 | 1 | 2,
  reason?: string
): Promise<`0x${string}`> {
  const state = await getProposalState(proposalId);
  if (state !== "Active") {
    throw new Error(`Cannot vote: proposal is ${state}, must be Active`);
  }

  if (reason) {
    const { request } = await publicClient.simulateContract({
      address: GOVERNOR_BRAVO,
      abi: governorBravoAbi,
      functionName: "castVoteWithReason",
      args: [proposalId, support, reason],
      account: account.address,
    });
    const hash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Vote reverted");
    return hash;
  }

  const { request } = await publicClient.simulateContract({
    address: GOVERNOR_BRAVO,
    abi: governorBravoAbi,
    functionName: "castVote",
    args: [proposalId, support],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Vote reverted");

  return hash;
}
```

## Queue and Execute (After Voting Succeeds)

```typescript
async function queueProposal(proposalId: bigint): Promise<`0x${string}`> {
  const state = await getProposalState(proposalId);
  if (state !== "Succeeded") {
    throw new Error(`Cannot queue: proposal is ${state}, must be Succeeded`);
  }

  const { request } = await publicClient.simulateContract({
    address: GOVERNOR_BRAVO,
    abi: governorBravoAbi,
    functionName: "queue",
    args: [proposalId],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Queue reverted");

  return hash;
}

async function executeProposal(proposalId: bigint): Promise<`0x${string}`> {
  const state = await getProposalState(proposalId);
  if (state !== "Queued") {
    throw new Error(`Cannot execute: proposal is ${state}, must be Queued`);
  }

  const { request } = await publicClient.simulateContract({
    address: GOVERNOR_BRAVO,
    abi: governorBravoAbi,
    functionName: "execute",
    args: [proposalId],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Execute reverted");

  return hash;
}
```

## Complete Lifecycle

```typescript
async function main() {
  // 1. Self-delegate
  await delegateComp(account.address);
  console.log("Delegated COMP to self");

  // 2. Check voting power
  const votes = await getVotingPower(account.address);
  console.log(`Voting power: ${Number(votes) / 1e18} COMP`);

  // 3. Vote on an active proposal
  const proposalId = 42n; // replace with actual proposal ID
  const state = await getProposalState(proposalId);
  console.log(`Proposal ${proposalId} state: ${state}`);

  if (state === "Active") {
    const voteHash = await vote(proposalId, 1, "Supporting increased capacity");
    console.log(`Voted For: ${voteHash}`);
  }
}

main().catch(console.error);
```
