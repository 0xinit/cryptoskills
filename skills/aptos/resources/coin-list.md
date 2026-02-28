# Aptos Coin and Token List

Verified coin types on Aptos mainnet. Coin types follow the format `<address>::<module>::<struct>`.

## Native Coin

| Name | Symbol | Decimals | Coin Type |
|------|--------|----------|-----------|
| Aptos Coin | APT | 8 | `0x1::aptos_coin::AptosCoin` |

1 APT = 100,000,000 octas (smallest unit).

## Bridged Stablecoins

| Name | Symbol | Decimals | Coin Type | Bridge |
|------|--------|----------|-----------|--------|
| USD Coin | USDC | 6 | `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC` | LayerZero |
| Tether USD | USDT | 6 | `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT` | LayerZero |
| Dai | DAI | 8 | `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::DAI` | LayerZero |

## Bridged Assets

| Name | Symbol | Decimals | Coin Type | Bridge |
|------|--------|----------|-----------|--------|
| Wrapped Ether | WETH | 6 | `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH` | LayerZero |
| Wrapped BTC | WBTC | 8 | `0xae478ff7d83ed072dbc5e264250e67ef58f57c99d89b447efd8a0a2e8b2be76e::coin::T` | Wormhole |

## Protocol Tokens

| Name | Symbol | Decimals | Coin Type | Protocol |
|------|--------|----------|-----------|----------|
| Thala Token | THL | 8 | `0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615::thl_coin::THL` | Thala |
| Tortuga Staked APT | tAPT | 8 | `0x84d7aeced0e65b1a12e1e16d3f8f2b0e1a12d6c7c4e76c1e2d6f8c9e3a5b7d0::staked_coin::StakedAptos` | Tortuga |
| Amnis Staked APT | amAPT | 8 | `0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt` | Amnis |

## Liquid Staking Tokens

| Name | Description | Coin Type |
|------|-------------|-----------|
| stAPT (Thala) | Thala liquid staked APT | `0xd11107bdf0d6d7040c6c0bfbdecb6545c68e526b67b4e6b17bb36826e8e8338e::staked_aptos_coin::StakedAptosCoin` |

Last verified: 2025-12-01. Verify coin types on-chain before production use.

## How to Verify a Coin Type On-Chain

```bash
# Check if a coin module exists at an address
aptos move view \
  --function-id '0x1::coin::name' \
  --type-args '0x1::aptos_coin::AptosCoin' \
  --profile mainnet

# Check coin decimals
aptos move view \
  --function-id '0x1::coin::decimals' \
  --type-args '<coin_type>' \
  --profile mainnet

# Check supply
aptos move view \
  --function-id '0x1::coin::supply' \
  --type-args '<coin_type>' \
  --profile mainnet
```

## TypeScript: Query Coin Info

```typescript
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

const aptos = new Aptos(new AptosConfig({ network: Network.MAINNET }));

interface CoinInfo {
  name: string;
  symbol: string;
  decimals: number;
  supply: bigint | null;
}

async function getCoinInfo(coinType: string): Promise<CoinInfo> {
  const [nameResult, symbolResult, decimalsResult, supplyResult] = await Promise.all([
    aptos.view({
      payload: {
        function: "0x1::coin::name",
        typeArguments: [coinType],
        functionArguments: [],
      },
    }),
    aptos.view({
      payload: {
        function: "0x1::coin::symbol",
        typeArguments: [coinType],
        functionArguments: [],
      },
    }),
    aptos.view({
      payload: {
        function: "0x1::coin::decimals",
        typeArguments: [coinType],
        functionArguments: [],
      },
    }),
    aptos.view({
      payload: {
        function: "0x1::coin::supply",
        typeArguments: [coinType],
        functionArguments: [],
      },
    }),
  ]);

  const supplyData = supplyResult[0] as { vec: string[] };

  return {
    name: nameResult[0] as string,
    symbol: symbolResult[0] as string,
    decimals: Number(decimalsResult[0]),
    supply: supplyData.vec.length > 0 ? BigInt(supplyData.vec[0]) : null,
  };
}
```

## Coin vs Fungible Asset

Aptos has two token standards. New projects should prefer Fungible Asset (FA).

| Feature | Coin Standard | Fungible Asset (FA) |
|---------|--------------|---------------------|
| Module | `aptos_framework::coin` | `aptos_framework::fungible_asset` |
| Type representation | Generic type parameter `Coin<T>` | Object with `Metadata` |
| Registration | Must register `CoinStore` | Primary store auto-created |
| Transfer | `coin::transfer<T>` | `primary_fungible_store::transfer` |
| Storage | CoinStore at user address | FungibleStore object |
| Freeze | Per-account via `FreezeCapability` | Per-store via `TransferRef` |
| Backward compatible | Yes (existing) | Yes (framework supported) |

APT itself is transitioning to use both Coin and FA interfaces. The `0x1::aptos_coin::AptosCoin` type works with both `coin::transfer` and `primary_fungible_store::transfer`.

## Amount Formatting

```typescript
function formatCoinAmount(octas: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = octas / divisor;
  const fraction = (octas % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
}

function parseCoinAmount(amount: string, decimals: number): bigint {
  const parts = amount.split(".");
  const whole = BigInt(parts[0]) * BigInt(10 ** decimals);
  if (parts.length === 1) return whole;
  const fractionStr = parts[1].padEnd(decimals, "0").slice(0, decimals);
  return whole + BigInt(fractionStr);
}
```
