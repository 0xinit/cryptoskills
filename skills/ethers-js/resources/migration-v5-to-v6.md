# ethers.js v5 to v6 Migration Guide

Comprehensive reference for migrating from ethers.js v5 to v6. v6 is a ground-up rewrite. Most v5 code will NOT work without changes.

## Breaking Change Summary

1. `BigNumber` replaced by native `bigint`
2. `ethers.utils.*` replaced by top-level exports
3. `ethers.providers.*` replaced by top-level exports
4. `Web3Provider` renamed to `BrowserProvider`
5. Contract constructor "runner" semantics
6. `contract.address` is now async (`getAddress()`)
7. `tx.wait()` can return `null`

## BigNumber to bigint

This is the most impactful change. Every uint256 value in v6 is a native `bigint`.

### v5 (WRONG -- do not use)

```typescript
// v5 -- ALL of this is wrong in v6
import { BigNumber } from "ethers";

const a = BigNumber.from("1000000000000000000");
const b = BigNumber.from(42);
const sum = a.add(b);
const product = a.mul(b);
const isZero = a.isZero();
const num = a.toNumber();
const str = a.toString();
const isGt = a.gt(b);
```

### v6 (CORRECT)

```typescript
// v6 -- native bigint
const a = 1000000000000000000n;
const b = 42n;
const sum = a + b;
const product = a * b;
const isZero = a === 0n;
const num = Number(a); // CAUTION: only safe if value < Number.MAX_SAFE_INTEGER
const str = a.toString();
const isGt = a > b;
```

### Common Pitfalls

```typescript
// Division truncates (integer division)
10n / 3n; // 3n, not 3.333...

// Cannot mix bigint and number
// 10n + 5; // TypeError
10n + BigInt(5); // 15n

// Comparison with number works
10n > 5;    // true
10n === 10; // false (strict equality checks type)
10n == 10;  // true  (loose equality coerces)
```

## Provider Changes

### v5 (WRONG)

```typescript
// v5
import { ethers } from "ethers";

const provider = new ethers.providers.JsonRpcProvider(url);
const wsProvider = new ethers.providers.WebSocketProvider(url);
const browserProvider = new ethers.providers.Web3Provider(window.ethereum);
const alchemyProvider = new ethers.providers.AlchemyProvider("mainnet", key);
const infuraProvider = new ethers.providers.InfuraProvider("mainnet", key);
```

### v6 (CORRECT)

```typescript
// v6
import {
  JsonRpcProvider,
  WebSocketProvider,
  BrowserProvider,
  AlchemyProvider,
  InfuraProvider,
} from "ethers";

const provider = new JsonRpcProvider(url);
const wsProvider = new WebSocketProvider(url);
const browserProvider = new BrowserProvider(window.ethereum);
const alchemyProvider = new AlchemyProvider("mainnet", key);
const infuraProvider = new InfuraProvider("mainnet", key);
```

### Network Changes

```typescript
// v5: provider.getNetwork() returns { chainId: number, name: string }
// v6: provider.getNetwork() returns Network object with chainId as bigint

const network = await provider.getNetwork();
// v5: network.chainId is number
// v6: network.chainId is bigint
const chainId: bigint = network.chainId;
```

## Utility Function Changes

### v5 (WRONG)

```typescript
// v5
import { ethers } from "ethers";

ethers.utils.parseEther("1.0");
ethers.utils.formatEther(wei);
ethers.utils.parseUnits("100", 6);
ethers.utils.formatUnits(val, 6);
ethers.utils.keccak256(data);
ethers.utils.id("Transfer(address,address,uint256)");
ethers.utils.toUtf8Bytes("hello");
ethers.utils.hexlify(data);
ethers.utils.arrayify(hex);
ethers.utils.solidityPack(types, values);
ethers.utils.solidityKeccak256(types, values);
ethers.utils.defaultAbiCoder.encode(types, values);
new ethers.utils.Interface(abi);
```

### v6 (CORRECT)

```typescript
// v6
import {
  parseEther,
  formatEther,
  parseUnits,
  formatUnits,
  keccak256,
  id,
  toUtf8Bytes,
  hexlify,
  getBytes,
  solidityPacked,
  solidityPackedKeccak256,
  AbiCoder,
  Interface,
} from "ethers";

parseEther("1.0");
formatEther(wei);
parseUnits("100", 6);
formatUnits(val, 6);
keccak256(data);
id("Transfer(address,address,uint256)");
toUtf8Bytes("hello");
hexlify(data);
getBytes(hex);          // replaces arrayify
solidityPacked(types, values);  // replaces solidityPack
solidityPackedKeccak256(types, values);
AbiCoder.defaultAbiCoder().encode(types, values);
new Interface(abi);
```

## Contract Changes

### Constructor

```typescript
// v5 and v6 constructor signature is the same:
const contract = new Contract(address, abi, providerOrSigner);

// But v5 called the third arg "providerOrSigner"
// v6 calls it "runner" (can be Provider or Signer)
```

### Getting the Contract Address

```typescript
// v5
const addr = contract.address; // string property

// v6
const addr = await contract.getAddress(); // async method
```

### Deployment

```typescript
// v5
const contract = await factory.deploy(...args);
await contract.deployed();
console.log(contract.address);

// v6
const contract = await factory.deploy(...args);
await contract.waitForDeployment();
const addr = await contract.getAddress();
console.log(addr);
```

### Static Calls

```typescript
// v5
const result = await contract.callStatic.transfer(to, amount);

// v6
const result = await contract.transfer.staticCall(to, amount);
```

### Gas Estimation

```typescript
// v5
const gas = await contract.estimateGas.transfer(to, amount);

// v6
const gas = await contract.transfer.estimateGas(to, amount);
```

### Populating Transactions

```typescript
// v5
const populated = await contract.populateTransaction.transfer(to, amount);

// v6
const populated = await contract.transfer.populateTransaction(to, amount);
```

## Event Changes

### Querying Events

```typescript
// v5
const filter = contract.filters.Transfer(from, to);
const events = await contract.queryFilter(filter, fromBlock, toBlock);
// events[0].args.from, events[0].args.to, events[0].args.value

// v6 (same pattern, but values are bigint)
const filter = contract.filters.Transfer(from, to);
const events = await contract.queryFilter(filter, fromBlock, toBlock);
// events[0].args[0] (from), events[0].args[1] (to), events[0].args[2] (value as bigint)
```

### Listening to Events

```typescript
// v5
contract.on("Transfer", (from, to, value, event) => {
  // value is BigNumber
  console.log(value.toString());
});

// v6
contract.on("Transfer", (from, to, value, event) => {
  // value is bigint
  console.log(value);
});
```

## Transaction Changes

### tx.wait() Returns null

```typescript
// v5: tx.wait() always returns TransactionReceipt
const receipt = await tx.wait();

// v6: tx.wait() returns TransactionReceipt | null
// Returns null if the transaction is dropped or replaced
const receipt = await tx.wait();
if (receipt === null) {
  throw new Error("Transaction dropped or replaced");
}
```

### Fee Data

```typescript
// v5
const gasPrice = await provider.getGasPrice(); // BigNumber

// v6
const feeData = await provider.getFeeData();
feeData.gasPrice;              // bigint | null
feeData.maxFeePerGas;          // bigint | null
feeData.maxPriorityFeePerGas;  // bigint | null
```

## Signer Changes

### Getting a Signer from BrowserProvider

```typescript
// v5
const signer = provider.getSigner(); // synchronous

// v6
const signer = await provider.getSigner(); // async
```

### Wallet

```typescript
// v5
const wallet = new ethers.Wallet(privateKey, provider);

// v6
import { Wallet } from "ethers";
const wallet = new Wallet(privateKey, provider);
```

## Error Handling Changes

### v5

```typescript
// v5
try {
  await contract.transfer(to, amount);
} catch (error) {
  if (error.code === "INSUFFICIENT_FUNDS") { ... }
  if (error.code === "CALL_EXCEPTION") { ... }
}
```

### v6

```typescript
// v6
import { isError } from "ethers";

try {
  await contract.transfer(to, amount);
} catch (error: unknown) {
  if (isError(error, "INSUFFICIENT_FUNDS")) { ... }
  if (isError(error, "CALL_EXCEPTION")) {
    console.error(error.reason);
  }
}
```

## Import Pattern Changes

### v5

```typescript
// v5 -- namespace imports
import { ethers } from "ethers";
ethers.providers.JsonRpcProvider
ethers.utils.parseEther
ethers.BigNumber
ethers.Contract
```

### v6

```typescript
// v6 -- tree-shakeable named imports
import {
  JsonRpcProvider,
  parseEther,
  Contract,
  Wallet,
  Interface,
} from "ethers";
```

## Quick Detection: Are You Looking at v5 or v6?

| Pattern | Version |
|---------|---------|
| `ethers.providers.*` | v5 |
| `ethers.utils.*` | v5 |
| `BigNumber` | v5 |
| `Web3Provider` | v5 |
| `.add()`, `.mul()`, `.div()` on numbers | v5 |
| `contract.callStatic.*` | v5 |
| `contract.address` (sync) | v5 |
| `BrowserProvider` | v6 |
| `parseEther()` (top-level) | v6 |
| Native `bigint` / `123n` | v6 |
| `contract.fn.staticCall()` | v6 |
| `await contract.getAddress()` | v6 |
| `isError(err, code)` | v6 |
