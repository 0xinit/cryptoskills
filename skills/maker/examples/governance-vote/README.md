# MKR Governance -- Executive Voting

Lock MKR in the Chief contract and vote for executive spells. Covers the full governance lifecycle: lock, vote, check hat, and free MKR. Also covers SKY token voting after the Sky rebrand.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
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

const MKR = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2" as const;
const MCD_ADM = "0x0a3f6849f78076aefaDf113F5BED87720274dDC0" as const; // DSChief v1.2
```

## ABIs

```typescript
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

const chiefAbi = [
  {
    name: "lock",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
  },
  {
    name: "free",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
  },
  {
    name: "vote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "yays", type: "address[]" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "lift",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "whom", type: "address" }],
    outputs: [],
  },
  {
    name: "hat",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "approvals",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "candidate", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "deposits",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "usr", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "votes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "usr", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;
```

## Lock MKR in Chief

```typescript
async function lockMkr(amount: bigint): Promise<`0x${string}`> {
  // Approve Chief to spend MKR
  const approveHash = await walletClient.writeContract({
    address: MKR,
    abi: erc20Abi,
    functionName: "approve",
    args: [MCD_ADM, amount],
  });
  const approveReceipt = await publicClient.waitForTransactionReceipt({
    hash: approveHash,
  });
  if (approveReceipt.status !== "success") {
    throw new Error("MKR approval for Chief failed");
  }

  // Lock MKR in governance
  const { request } = await publicClient.simulateContract({
    address: MCD_ADM,
    abi: chiefAbi,
    functionName: "lock",
    args: [amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Chief.lock() reverted");
  }

  return hash;
}
```

## Vote for Executive Spell

```typescript
async function voteForSpell(
  spellAddress: Address
): Promise<`0x${string}`> {
  // Check that we have MKR locked
  const deposits = await publicClient.readContract({
    address: MCD_ADM,
    abi: chiefAbi,
    functionName: "deposits",
    args: [account.address],
  });

  if (deposits === 0n) {
    throw new Error("No MKR locked in Chief -- call lock() first");
  }

  // Vote for the spell (moves all locked weight to this candidate)
  const { request } = await publicClient.simulateContract({
    address: MCD_ADM,
    abi: chiefAbi,
    functionName: "vote",
    args: [[spellAddress]],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Chief.vote() reverted");
  }

  return hash;
}
```

## Check Governance State

```typescript
async function getGovernanceState(spellAddress: Address) {
  const [hat, approvals, deposits] = await Promise.all([
    publicClient.readContract({
      address: MCD_ADM,
      abi: chiefAbi,
      functionName: "hat",
    }),
    publicClient.readContract({
      address: MCD_ADM,
      abi: chiefAbi,
      functionName: "approvals",
      args: [spellAddress],
    }),
    publicClient.readContract({
      address: MCD_ADM,
      abi: chiefAbi,
      functionName: "deposits",
      args: [account.address],
    }),
  ]);

  const hatApprovals = await publicClient.readContract({
    address: MCD_ADM,
    abi: chiefAbi,
    functionName: "approvals",
    args: [hat],
  });

  return {
    currentHat: hat,
    currentHatMkr: hatApprovals,
    spellApprovals: approvals,
    myLockedMkr: deposits,
    // Spell becomes hat when its approvals exceed the current hat's approvals
    needsMoreMkr: approvals <= hatApprovals
      ? hatApprovals - approvals + 1n
      : 0n,
  };
}
```

## Lift Spell to Hat

```typescript
async function liftSpell(
  spellAddress: Address
): Promise<`0x${string}`> {
  const state = await getGovernanceState(spellAddress);

  if (state.needsMoreMkr > 0n) {
    throw new Error(
      `Spell needs ${formatEther(state.needsMoreMkr)} more MKR than current hat to be lifted`
    );
  }

  const { request } = await publicClient.simulateContract({
    address: MCD_ADM,
    abi: chiefAbi,
    functionName: "lift",
    args: [spellAddress],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Chief.lift() reverted");
  }

  return hash;
}
```

## Free MKR (Withdraw from Chief)

```typescript
async function freeMkr(amount: bigint): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: MCD_ADM,
    abi: chiefAbi,
    functionName: "free",
    args: [amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Chief.free() reverted");
  }

  return hash;
}
```

## Cast an Executive Spell

After a spell becomes the hat and passes the GSM delay (48 hours), anyone can cast it:

```typescript
const spellAbi = [
  {
    name: "schedule",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "cast",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "done",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "eta",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function castSpell(
  spellAddress: Address
): Promise<`0x${string}`> {
  const [done, eta] = await Promise.all([
    publicClient.readContract({
      address: spellAddress,
      abi: spellAbi,
      functionName: "done",
    }),
    publicClient.readContract({
      address: spellAddress,
      abi: spellAbi,
      functionName: "eta",
    }),
  ]);

  if (done) {
    throw new Error("Spell has already been cast");
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  // GSM delay must have passed (eta > 0 means it has been scheduled)
  if (eta === 0n) {
    throw new Error("Spell has not been scheduled yet -- call schedule() first");
  }
  if (now < eta) {
    const remaining = eta - now;
    throw new Error(
      `GSM delay not passed. ${remaining} seconds remaining (${Number(remaining) / 3600} hours)`
    );
  }

  const { request } = await publicClient.simulateContract({
    address: spellAddress,
    abi: spellAbi,
    functionName: "cast",
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Spell cast reverted");
  }

  return hash;
}
```

## Complete Usage

```typescript
import { parseEther } from "viem";

async function main() {
  const mkrAmount = parseEther("100"); // 100 MKR
  const spellAddress = "0x..." as Address; // replace with actual spell

  // 1. Lock MKR
  const lockHash = await lockMkr(mkrAmount);
  console.log(`Locked MKR: ${lockHash}`);

  // 2. Vote for spell
  const voteHash = await voteForSpell(spellAddress);
  console.log(`Voted: ${voteHash}`);

  // 3. Check state
  const state = await getGovernanceState(spellAddress);
  console.log(`Current hat: ${state.currentHat}`);
  console.log(`Spell approvals: ${formatEther(state.spellApprovals)} MKR`);
  console.log(`Hat approvals: ${formatEther(state.currentHatMkr)} MKR`);

  if (state.needsMoreMkr === 0n) {
    // 4. Lift spell to hat
    const liftHash = await liftSpell(spellAddress);
    console.log(`Lifted: ${liftHash}`);
  } else {
    console.log(`Need ${formatEther(state.needsMoreMkr)} more MKR to lift`);
  }

  // 5. Free MKR when done (after voting period)
  const freeHash = await freeMkr(mkrAmount);
  console.log(`Freed MKR: ${freeHash}`);
}

main().catch(console.error);
```
