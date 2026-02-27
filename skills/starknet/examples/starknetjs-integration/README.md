# Starknet.js Integration Examples

Starknet.js (v6+) is the primary JavaScript/TypeScript SDK for interacting with StarkNet.

## Installation

```bash
npm install starknet
```

## Provider Setup

```typescript
import { RpcProvider, constants } from "starknet";

// Public RPC (rate limited — use a provider key for production)
const mainnetProvider = new RpcProvider({
  nodeUrl: "https://starknet-mainnet.public.blastapi.io/rpc/v0_7",
});

const sepoliaProvider = new RpcProvider({
  nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_7",
});

// Alchemy
const alchemyProvider = new RpcProvider({
  nodeUrl: `https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_7/${process.env.ALCHEMY_KEY}`,
});

// Basic queries
const block = await mainnetProvider.getBlockLatestAccepted();
console.log("Block number:", block.block_number);

const chainId = await mainnetProvider.getChainId();
console.log("Chain ID:", chainId);
```

## Account Instantiation

```typescript
import { Account, RpcProvider } from "starknet";

const provider = new RpcProvider({
  nodeUrl: process.env.STARKNET_RPC_URL!,
});

// Account requires: provider, address, private key
const account = new Account(
  provider,
  process.env.ACCOUNT_ADDRESS!,
  process.env.PRIVATE_KEY!,
);

// Verify the account exists on-chain
const nonce = await account.getNonce();
console.log("Account nonce:", nonce);
```

## Contract Read (call)

```typescript
import { Contract, RpcProvider } from "starknet";

const provider = new RpcProvider({
  nodeUrl: process.env.STARKNET_RPC_URL!,
});

// Load ABI from compiled contract
const abi = [
  {
    name: "get_count",
    type: "function",
    inputs: [],
    outputs: [{ type: "core::integer::u128" }],
    state_mutability: "view",
  },
  {
    name: "get_balance",
    type: "function",
    inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
];

const contract = new Contract(abi, contractAddress, provider);

// Call view functions (no account needed)
const count = await contract.get_count();
console.log("Count:", count.toString());

const balance = await contract.get_balance(accountAddress);
console.log("Balance:", balance.toString());
```

## Contract Write (invoke)

```typescript
import { Account, Contract, RpcProvider } from "starknet";

const provider = new RpcProvider({
  nodeUrl: process.env.STARKNET_RPC_URL!,
});

const account = new Account(
  provider,
  process.env.ACCOUNT_ADDRESS!,
  process.env.PRIVATE_KEY!,
);

const contract = new Contract(abi, contractAddress, provider);

// Connect account for write operations
contract.connect(account);

// Invoke a state-changing function
const tx = await contract.increment();
console.log("Tx hash:", tx.transaction_hash);

// Wait for confirmation
const receipt = await provider.waitForTransaction(tx.transaction_hash);
console.log("Status:", receipt.execution_status);
```

## Multicall (Batch Transactions)

Every StarkNet account natively supports multicall. Execute multiple contract calls in a single transaction.

```typescript
const calls = [
  // Call 1: Approve token spend
  {
    contractAddress: ethTokenAddress,
    entrypoint: "approve",
    calldata: [vaultAddress, amountLow, amountHigh],
  },
  // Call 2: Deposit to vault
  {
    contractAddress: vaultAddress,
    entrypoint: "deposit",
    calldata: [amountLow, amountHigh],
  },
];

const tx = await account.execute(calls);
console.log("Multicall tx:", tx.transaction_hash);
await provider.waitForTransaction(tx.transaction_hash);
```

## Event Parsing

```typescript
const receipt = await provider.waitForTransaction(txHash);

// Raw events
for (const event of receipt.events) {
  console.log("From:", event.from_address);
  console.log("Keys:", event.keys);
  console.log("Data:", event.data);
}

// Parsed events using contract instance
const contract = new Contract(abi, contractAddress, provider);
const events = contract.parseEvents(receipt);

for (const event of events) {
  // Access typed event data
  if (event.Transfer) {
    console.log("Transfer from:", event.Transfer.from);
    console.log("Transfer to:", event.Transfer.to);
    console.log("Amount:", event.Transfer.amount.toString());
  }
}
```

## Typed Data Signing (Off-chain Signatures)

StarkNet supports EIP-712-like typed data signing for off-chain messages.

```typescript
import { typedData, Account } from "starknet";

const myTypedData: typedData.TypedData = {
  types: {
    StarknetDomain: [
      { name: "name", type: "shortstring" },
      { name: "version", type: "shortstring" },
      { name: "chainId", type: "shortstring" },
    ],
    Order: [
      { name: "maker", type: "ContractAddress" },
      { name: "amount", type: "u256" },
      { name: "price", type: "u128" },
      { name: "nonce", type: "felt" },
    ],
  },
  primaryType: "Order",
  domain: {
    name: "MyDex",
    version: "1",
    chainId: "SN_MAIN",
  },
  message: {
    maker: account.address,
    amount: { low: "1000000000000000000", high: "0" },
    price: "2500000000",
    nonce: "1",
  },
};

// Sign
const signature = await account.signMessage(myTypedData);
console.log("Signature:", signature);

// Verify (on-chain via is_valid_signature, or off-chain)
const msgHash = typedData.getMessageHash(myTypedData, account.address);
console.log("Message hash:", msgHash);
```

## ERC-20 Token Operations

```typescript
const ETH_ADDRESS = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
const STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

const ethContract = new Contract(erc20Abi, ETH_ADDRESS, provider);
const strkContract = new Contract(erc20Abi, STRK_ADDRESS, provider);

// Check balance
const ethBalance = await ethContract.balanceOf(account.address);
console.log("ETH balance:", ethBalance.toString());

// Transfer
ethContract.connect(account);
const transferTx = await ethContract.transfer(recipientAddress, {
  low: "1000000000000000000", // 1 ETH (u256 as struct)
  high: "0",
});
await provider.waitForTransaction(transferTx.transaction_hash);
```

## Error Handling

```typescript
import { LibraryError, Provider } from "starknet";

try {
  const tx = await contract.some_function();
  const receipt = await provider.waitForTransaction(tx.transaction_hash);

  if (receipt.execution_status === "REVERTED") {
    console.error("Transaction reverted:", receipt.revert_reason);
  }
} catch (error) {
  if (error instanceof LibraryError) {
    console.error("StarkNet error:", error.message);
  }
  throw error;
}
```
