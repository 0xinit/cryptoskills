# Gas Estimation on Optimism

Every OP Mainnet transaction pays two fees: L2 execution gas and L1 data fee. Ignoring the L1 data fee leads to underestimating costs.

## Reading the GasPriceOracle

The `GasPriceOracle` predeploy at `0x420000000000000000000000000000000000000F` provides L1 fee estimation.

```typescript
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { optimism } from "viem/chains";

const client = createPublicClient({
  chain: optimism,
  transport: http(process.env.OP_MAINNET_RPC),
});

const GAS_ORACLE: Address = "0x420000000000000000000000000000000000000F";

const oracleAbi = parseAbi([
  "function getL1Fee(bytes memory _data) external view returns (uint256)",
  "function l1BaseFee() external view returns (uint256)",
  "function blobBaseFee() external view returns (uint256)",
  "function baseFeeScalar() external view returns (uint32)",
  "function blobBaseFeeScalar() external view returns (uint32)",
  "function isEcotone() external view returns (bool)",
  "function isFjord() external view returns (bool)",
  "function getL1GasUsed(bytes memory _data) external view returns (uint256)",
]);

async function readGasOracleState() {
  const [l1BaseFee, blobBaseFee, baseFeeScalar, blobBaseFeeScalar, isEcotone, isFjord] =
    await Promise.all([
      client.readContract({ address: GAS_ORACLE, abi: oracleAbi, functionName: "l1BaseFee" }),
      client.readContract({ address: GAS_ORACLE, abi: oracleAbi, functionName: "blobBaseFee" }),
      client.readContract({ address: GAS_ORACLE, abi: oracleAbi, functionName: "baseFeeScalar" }),
      client.readContract({ address: GAS_ORACLE, abi: oracleAbi, functionName: "blobBaseFeeScalar" }),
      client.readContract({ address: GAS_ORACLE, abi: oracleAbi, functionName: "isEcotone" }),
      client.readContract({ address: GAS_ORACLE, abi: oracleAbi, functionName: "isFjord" }),
    ]);

  console.log({
    l1BaseFee: `${l1BaseFee} wei`,
    blobBaseFee: `${blobBaseFee} wei`,
    baseFeeScalar,
    blobBaseFeeScalar,
    isEcotone,
    isFjord,
  });
}
```

## Estimating L1 Data Fee for a Transaction

```typescript
async function estimateL1DataFee(serializedTx: `0x${string}`): Promise<bigint> {
  const l1Fee = await client.readContract({
    address: GAS_ORACLE,
    abi: oracleAbi,
    functionName: "getL1Fee",
    args: [serializedTx],
  });

  return l1Fee;
}
```

## Estimating Total Transaction Cost

```typescript
async function estimateTotalCost(
  to: Address,
  data: `0x${string}`,
  value: bigint = 0n
) {
  // L2 execution cost
  const [l2GasEstimate, gasPrice] = await Promise.all([
    client.estimateGas({ to, data, value }),
    client.getGasPrice(),
  ]);

  const l2ExecutionFee = l2GasEstimate * gasPrice;

  // L1 data fee — requires the serialized signed transaction
  // For estimation, use the unsigned tx data as an approximation
  const l1DataFee = await client.readContract({
    address: GAS_ORACLE,
    abi: oracleAbi,
    functionName: "getL1Fee",
    args: [data],
  });

  const totalFee = l2ExecutionFee + l1DataFee;

  return {
    l2Gas: l2GasEstimate,
    l2GasPrice: gasPrice,
    l2ExecutionFee,
    l1DataFee,
    totalFee,
    l1FeePercentage: Number((l1DataFee * 100n) / totalFee),
  };
}
```

## Ecotone/Fjord Gas Formula

### Ecotone (March 2024)

Replaced the old `overhead + scalar * l1BaseFee` model with:

```
l1DataFee = (baseFeeScalar * l1BaseFee * 16 + blobBaseFeeScalar * blobBaseFee) * compressedTxSize / 1e6
```

Key changes:
- Uses EIP-4844 blob base fee alongside L1 base fee
- Two scalars instead of one
- Dramatically lower L1 data fees (10-100x cheaper)

### Fjord (July 2024)

Improved the compressed size estimation using FastLZ compression:

```
compressedTxSize = max(100, FastLZ(signedTx))
```

- More accurate compression estimation
- Minimum floor of 100 bytes prevents underestimation

## Solidity: Reading L1 Fee in a Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGasPriceOracle {
    function getL1Fee(bytes memory _data) external view returns (uint256);
    function l1BaseFee() external view returns (uint256);
    function blobBaseFee() external view returns (uint256);
}

contract GasReader {
    IGasPriceOracle constant GAS_ORACLE =
        IGasPriceOracle(0x420000000000000000000000000000000000000F);

    function currentL1BaseFee() external view returns (uint256) {
        return GAS_ORACLE.l1BaseFee();
    }

    function currentBlobBaseFee() external view returns (uint256) {
        return GAS_ORACLE.blobBaseFee();
    }

    /// @notice Estimate the L1 data fee for arbitrary calldata.
    function estimateL1Fee(bytes calldata data) external view returns (uint256) {
        return GAS_ORACLE.getL1Fee(data);
    }
}
```

## Gas Optimization Tips

1. **Minimize calldata** — L1 data fee is proportional to transaction data size. Use tightly packed structs, avoid unnecessary function parameters.
2. **Use zero bytes** — Zero bytes cost 4 gas vs 16 gas for non-zero bytes in calldata. Encode data with leading zeros where possible.
3. **Batch operations** — One transaction with 10 operations has lower L1 data overhead than 10 separate transactions.
4. **Monitor blob fees** — After Ecotone, L1 data fees are tied to EIP-4844 blob pricing, which can spike during high L1 blob demand.
5. **Pre-Ecotone formulas are invalid** — If you find code using `l1FeeOverhead` and `l1FeeScalar` (single scalar), it predates Ecotone and will give wrong results.

## Impact of EIP-4844 Blobs

Before Ecotone (March 2024):
- Transaction data posted as L1 calldata
- L1 data fee = `(overhead + calldataGas) * l1BaseFee * scalar / 1e6`
- High and volatile L1 fees

After Ecotone:
- Transaction data posted as EIP-4844 blobs
- Separate blob base fee market
- L1 data fees dropped ~100x
- Typical L1 data fee: 0.001-0.01 USD per transaction (varies with blob demand)
