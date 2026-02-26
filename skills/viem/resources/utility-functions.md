# Viem Utility Functions Reference

Essential utility functions for value conversion, ABI encoding, address handling, and byte manipulation.

## Value Conversion

| Function | Signature | Example |
|----------|-----------|---------|
| `parseEther` | `(value: string) => bigint` | `parseEther("1.0")` -> `1000000000000000000n` |
| `formatEther` | `(value: bigint) => string` | `formatEther(1000000000000000000n)` -> `"1"` |
| `parseUnits` | `(value: string, decimals: number) => bigint` | `parseUnits("100", 6)` -> `100000000n` |
| `formatUnits` | `(value: bigint, decimals: number) => string` | `formatUnits(100000000n, 6)` -> `"100"` |
| `parseGwei` | `(value: string) => bigint` | `parseGwei("20")` -> `20000000000n` |
| `formatGwei` | `(value: bigint) => string` | `formatGwei(20000000000n)` -> `"20"` |

```typescript
import { parseEther, formatEther, parseUnits, formatUnits } from "viem";

const weiAmount = parseEther("1.5");        // 1500000000000000000n
const ethString = formatEther(weiAmount);    // "1.5"

// USDC has 6 decimals
const usdcAmount = parseUnits("250.50", 6); // 250500000n
const usdcString = formatUnits(usdcAmount, 6); // "250.5"
```

## ABI Utilities

| Function | Signature | Purpose |
|----------|-----------|---------|
| `parseAbi` | `(signatures: string[]) => Abi` | Parse human-readable ABI strings into ABI objects |
| `parseAbiItem` | `(signature: string) => AbiItem` | Parse a single ABI item |
| `encodeFunctionData` | `({ abi, functionName, args }) => Hex` | Encode calldata for a function call |
| `decodeFunctionData` | `({ abi, data }) => { functionName, args }` | Decode calldata back to function name and args |
| `encodeFunctionResult` | `({ abi, functionName, result }) => Hex` | Encode a function return value |
| `decodeFunctionResult` | `({ abi, functionName, data }) => unknown` | Decode a function return value |
| `encodeAbiParameters` | `(params, values) => Hex` | Encode raw ABI parameters |
| `decodeAbiParameters` | `(params, data) => unknown[]` | Decode raw ABI parameters |
| `encodeDeployData` | `({ abi, bytecode, args }) => Hex` | Encode bytecode + constructor args |
| `encodeEventTopics` | `({ abi, eventName, args }) => Hex[]` | Encode event topics for filtering |
| `decodeEventLog` | `({ abi, data, topics }) => { eventName, args }` | Decode a raw log into typed event |

```typescript
import {
  parseAbi,
  parseAbiItem,
  encodeFunctionData,
  decodeFunctionData,
  encodeAbiParameters,
} from "viem";

const abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const calldata = encodeFunctionData({
  abi,
  functionName: "transfer",
  args: ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 1000000n],
});

const { functionName, args } = decodeFunctionData({ abi, data: calldata });

const encoded = encodeAbiParameters(
  [
    { name: "x", type: "uint256" },
    { name: "y", type: "address" },
  ],
  [123n, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"]
);
```

## Address Utilities

| Function | Signature | Purpose |
|----------|-----------|---------|
| `getAddress` | `(address: string) => Address` | Normalize to EIP-55 checksummed address |
| `isAddress` | `(value: string) => boolean` | Validate address format |
| `isAddressEqual` | `(a: Address, b: Address) => boolean` | Case-insensitive address comparison |
| `getContractAddress` | `(opts) => Address` | Predict CREATE/CREATE2 deployment address |

```typescript
import { getAddress, isAddress, isAddressEqual } from "viem";

const checksummed = getAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
// "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"

isAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"); // true
isAddress("not-an-address");                                 // false

isAddressEqual(
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
); // true
```

## Hashing and Encoding

| Function | Signature | Purpose |
|----------|-----------|---------|
| `keccak256` | `(value: Hex \| ByteArray) => Hex` | Keccak-256 hash |
| `toHex` | `(value: number \| bigint \| string \| ByteArray) => Hex` | Convert to hex string |
| `fromHex` | `(hex: Hex, type) => number \| bigint \| string \| ByteArray` | Convert from hex |
| `toBytes` | `(value: string \| number \| bigint \| boolean \| Hex) => ByteArray` | Convert to Uint8Array |
| `fromBytes` | `(bytes: ByteArray, type) => string \| number \| bigint \| boolean \| Hex` | Convert from Uint8Array |
| `toRlp` | `(value: RecursiveArray<Hex>) => Hex` | RLP encode |
| `concat` | `(values: Hex[]) => Hex` | Concatenate hex values |
| `pad` | `(hex: Hex, opts?) => Hex` | Pad hex to target size |
| `slice` | `(hex: Hex, start?, end?) => Hex` | Slice hex value |
| `size` | `(hex: Hex) => number` | Get byte size of hex value |

```typescript
import { keccak256, toBytes, toHex, fromHex } from "viem";

const hash = keccak256(toBytes("hello"));
// 0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8

toHex(420);              // "0x1a4"
toHex("hello");          // "0x68656c6c6f"
fromHex("0x1a4", "number"); // 420
```

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `maxUint256` | `2^256 - 1` | Max approval / infinite allowance |
| `zeroAddress` | `"0x0000...0000"` | Zero address |
| `zeroHash` | `"0x0000...0000"` | 32-byte zero hash |

```typescript
import { maxUint256, zeroAddress } from "viem";

// Infinite approval
await walletClient.writeContract({
  address: token,
  abi,
  functionName: "approve",
  args: [spender, maxUint256],
});
```
