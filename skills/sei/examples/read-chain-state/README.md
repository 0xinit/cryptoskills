# Reading Chain State on Sei

## Basic EVM Reads

Standard EVM state reads work on Sei with no changes.

```typescript
import { createPublicClient, http, formatEther, type Address } from "viem";
import { sei } from "./chains";

const client = createPublicClient({
  chain: sei,
  transport: http("https://evm-rpc.sei-apis.com"),
});

// Block number
const blockNumber = await client.getBlockNumber();

// Native SEI balance (18 decimals in EVM context)
const balance = await client.getBalance({
  address: "0xYourAddress" as Address,
});
console.log(`Balance: ${formatEther(balance)} SEI`);

// Gas price
const gasPrice = await client.getGasPrice();

// Block details
const block = await client.getBlock({ blockNumber });
console.log(`Block time: ${block.timestamp}`);
```

## Reading Associated Balances (Cosmos Native Tokens)

EVM addresses on Sei can hold Cosmos-native tokens. Query them via the Bank precompile.

```typescript
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { sei } from "./chains";

const client = createPublicClient({ chain: sei, transport: http() });

const BANK: Address = "0x0000000000000000000000000000000000001001";

const bankAbi = parseAbi([
  "function balance(address account, string denom) view returns (uint256)",
  "function name(string denom) view returns (string)",
  "function symbol(string denom) view returns (string)",
  "function decimals(string denom) view returns (uint8)",
  "function supply(string denom) view returns (uint256)",
]);

async function getCosmosBalance(
  account: Address,
  denom: string
): Promise<bigint> {
  return client.readContract({
    address: BANK,
    abi: bankAbi,
    functionName: "balance",
    args: [account, denom],
  });
}

// Native SEI balance in usei (6 decimals, Cosmos representation)
const useiBalance = await getCosmosBalance(
  "0xYourAddress" as Address,
  "usei"
);
console.log(`usei balance: ${useiBalance}`);

// IBC token balance
const atomBalance = await getCosmosBalance(
  "0xYourAddress" as Address,
  "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2"
);
```

## Reading ERC20 Balances

```typescript
import { createPublicClient, http, parseAbi, formatUnits, type Address } from "viem";
import { sei } from "./chains";

const client = createPublicClient({ chain: sei, transport: http() });

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
]);

async function getTokenInfo(tokenAddress: Address) {
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "name" }),
    client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "totalSupply" }),
  ]);

  return { name, symbol, decimals, totalSupply };
}

async function getTokenBalance(
  tokenAddress: Address,
  account: Address
): Promise<{ balance: bigint; formatted: string }> {
  const [balance, decimals] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account],
    }),
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ]);

  return {
    balance,
    formatted: formatUnits(balance, decimals),
  };
}
```

## Address Conversion

Look up the Cosmos (sei1...) address for an EVM address, or vice versa.

```typescript
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { sei } from "./chains";

const client = createPublicClient({ chain: sei, transport: http() });

const ADDR: Address = "0x0000000000000000000000000000000000001004";

const addrAbi = parseAbi([
  "function getSeiAddr(address evmAddr) view returns (string)",
  "function getEvmAddr(string seiAddr) view returns (address)",
]);

async function getCosmosAddress(evmAddr: Address): Promise<string> {
  return client.readContract({
    address: ADDR,
    abi: addrAbi,
    functionName: "getSeiAddr",
    args: [evmAddr],
  });
}

async function getEvmAddress(seiAddr: string): Promise<Address> {
  return client.readContract({
    address: ADDR,
    abi: addrAbi,
    functionName: "getEvmAddr",
    args: [seiAddr],
  });
}
```

## Querying Pointer Contracts

Check if a CW20 token has an ERC20 pointer and get its address.

```typescript
const POINTER: Address = "0x000000000000000000000000000000000000100b";

const pointerAbi = parseAbi([
  "function getPointer(uint16 pointerType, string tokenId) view returns (address, uint16, bool)",
]);

// pointerType: 0 = ERC20 for CW20, 1 = ERC721 for CW721, 4 = ERC20 for native denom
async function getPointer(
  pointerType: number,
  tokenId: string
): Promise<{ address: Address; exists: boolean }> {
  const [addr, , exists] = await client.readContract({
    address: POINTER,
    abi: pointerAbi,
    functionName: "getPointer",
    args: [pointerType, tokenId],
  });

  return { address: addr, exists };
}

// Get ERC20 pointer for a CW20 token
const cw20Pointer = await getPointer(0, "sei1..cw20contractaddr...");
if (cw20Pointer.exists) {
  const balance = await getTokenBalance(cw20Pointer.address, "0xYourAddress" as Address);
  console.log(`CW20 balance via ERC20 pointer: ${balance.formatted}`);
}

// Get ERC20 pointer for a native Cosmos denom
const denomPointer = await getPointer(4, "usei");
```

## Querying Staking State

```typescript
const STAKING: Address = "0x0000000000000000000000000000000000001005";

const stakingAbi = parseAbi([
  "function delegation(address delegator, string validator) view returns (uint256)",
]);

async function getDelegation(
  delegator: Address,
  validatorAddr: string
): Promise<bigint> {
  return client.readContract({
    address: STAKING,
    abi: stakingAbi,
    functionName: "delegation",
    args: [delegator, validatorAddr],
  });
}
```

## Querying CosmWasm State from EVM

Use the Wasm precompile to query CosmWasm contracts directly from TypeScript.

```typescript
const WASM: Address = "0x0000000000000000000000000000000000001002";

const wasmAbi = parseAbi([
  "function query(string contractAddress, bytes req) view returns (bytes)",
]);

async function queryCosmWasm(
  contractAddr: string,
  queryMsg: object
): Promise<unknown> {
  const queryBytes = new TextEncoder().encode(JSON.stringify(queryMsg));

  const responseBytes = await client.readContract({
    address: WASM,
    abi: wasmAbi,
    functionName: "query",
    args: [contractAddr, `0x${Buffer.from(queryBytes).toString("hex")}`],
  });

  const decoded = new TextDecoder().decode(
    Buffer.from(responseBytes.slice(2), "hex")
  );
  return JSON.parse(decoded);
}

// Query a CW20 balance
const cw20Balance = await queryCosmWasm("sei1...cw20addr...", {
  balance: { address: "sei1...owneraddr..." },
});
```

## Watching New Blocks

```typescript
const unwatch = client.watchBlocks({
  onBlock: (block) => {
    console.log(`Block ${block.number} at ${block.timestamp}`);
    console.log(`Transactions: ${block.transactions.length}`);
  },
});

// Stop watching
// unwatch();
```

## Key Notes

- SEI has 18 decimals in EVM context (msg.value, balance) but 6 decimals in Cosmos context (usei)
- Associated balances (Cosmos native tokens) are readable via the Bank precompile
- Every EVM address has a deterministic Cosmos address -- use the Address precompile to convert
- Pointer contracts make CW20 tokens accessible as ERC20 -- query the Pointer precompile to find them
- All amounts are `bigint` -- never use `number` for token amounts
- Standard viem/ethers.js patterns work for all EVM state reads
- Sei's ~390ms block time means state updates are nearly instant
