# Curve Pool Registry

Reference for finding and enumerating Curve pools on Ethereum mainnet.

> **Last verified:** February 2026

## Registry Architecture

Curve has multiple registries from different eras of the protocol. The **MetaRegistry** aggregates all of them into a single interface.

| Registry | Address | Purpose |
|----------|---------|---------|
| MetaRegistry | `0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC` | Aggregates all registries — use this first |
| AddressProvider | `0x0000000022D53366457F9d5E68Ec105046FC4383` | Root registry that points to all other registries |
| StableSwap Factory | `0xB9fC157394Af804a3578134A6585C0dc9cc990d4` | Factory for permissionless stableswap pools |
| CryptoSwap Factory | `0xF18056Bbd320E96A48e3Fbf8bC061322531aac99` | Factory for permissionless cryptoswap pools |

## Finding Pools with MetaRegistry

The MetaRegistry is the recommended entry point for pool discovery.

### Find Best Pool for a Token Pair

```typescript
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const META_REGISTRY = "0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC" as const;

const metaRegistryAbi = parseAbi([
  "function find_pool_for_coins(address _from, address _to) view returns (address)",
  "function find_pool_for_coins(address _from, address _to, uint256 i) view returns (address)",
  "function find_pools_for_coins(address _from, address _to) view returns (address[])",
  "function get_coins(address _pool) view returns (address[8])",
  "function get_balances(address _pool) view returns (uint256[8])",
  "function get_n_coins(address _pool) view returns (uint256)",
  "function get_pool_name(address _pool) view returns (string)",
  "function get_fees(address _pool) view returns (uint256[2])",
  "function get_gauge(address _pool) view returns (address)",
  "function get_lp_token(address _pool) view returns (address)",
  "function pool_count() view returns (uint256)",
  "function pool_list(uint256 i) view returns (address)",
]);

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const;

// Find the best (most liquid) pool for USDC/USDT
const bestPool = await publicClient.readContract({
  address: META_REGISTRY,
  abi: metaRegistryAbi,
  functionName: "find_pool_for_coins",
  args: [USDC, USDT],
});

// Find ALL pools that support this pair
const allPools = await publicClient.readContract({
  address: META_REGISTRY,
  abi: metaRegistryAbi,
  functionName: "find_pools_for_coins",
  args: [USDC, USDT],
});
```

### Get Pool Details

```typescript
async function getPoolInfo(pool: Address) {
  const [coins, balances, nCoins, name, fees, gauge, lpToken] = await Promise.all([
    publicClient.readContract({ address: META_REGISTRY, abi: metaRegistryAbi, functionName: "get_coins", args: [pool] }),
    publicClient.readContract({ address: META_REGISTRY, abi: metaRegistryAbi, functionName: "get_balances", args: [pool] }),
    publicClient.readContract({ address: META_REGISTRY, abi: metaRegistryAbi, functionName: "get_n_coins", args: [pool] }),
    publicClient.readContract({ address: META_REGISTRY, abi: metaRegistryAbi, functionName: "get_pool_name", args: [pool] }),
    publicClient.readContract({ address: META_REGISTRY, abi: metaRegistryAbi, functionName: "get_fees", args: [pool] }),
    publicClient.readContract({ address: META_REGISTRY, abi: metaRegistryAbi, functionName: "get_gauge", args: [pool] }),
    publicClient.readContract({ address: META_REGISTRY, abi: metaRegistryAbi, functionName: "get_lp_token", args: [pool] }),
  ]);

  // coins and balances arrays are padded to length 8 — trim by nCoins
  const activeCoins = coins.slice(0, Number(nCoins));
  const activeBalances = balances.slice(0, Number(nCoins));

  return { name, pool, activeCoins, activeBalances, nCoins, fees, gauge, lpToken };
}
```

### Enumerate All Registered Pools

```typescript
async function getAllPools(): Promise<Address[]> {
  const count = await publicClient.readContract({
    address: META_REGISTRY,
    abi: metaRegistryAbi,
    functionName: "pool_count",
  });

  const pools: Address[] = [];
  for (let i = 0n; i < count; i++) {
    const pool = await publicClient.readContract({
      address: META_REGISTRY,
      abi: metaRegistryAbi,
      functionName: "pool_list",
      args: [i],
    });
    pools.push(pool);
  }

  return pools;
}
```

## Finding Pools with AddressProvider

The AddressProvider is the root contract that points to all registries. Use it to discover registry addresses.

```typescript
const ADDRESS_PROVIDER = "0x0000000022D53366457F9d5E68Ec105046FC4383" as const;

const addressProviderAbi = parseAbi([
  "function get_registry() view returns (address)",
  "function get_address(uint256 _id) view returns (address)",
  "function max_id() view returns (uint256)",
]);

// Known IDs:
// 0 = Main Registry
// 1 = PoolInfo Getters (deprecated)
// 2 = Exchanges (deprecated)
// 3 = MetaPool Factory
// 4 = Fee Distributor
// 5 = CryptoSwap Registry
// 6 = CryptoSwap Factory
// 7 = MetaRegistry

const metaRegistryAddr = await publicClient.readContract({
  address: ADDRESS_PROVIDER,
  abi: addressProviderAbi,
  functionName: "get_address",
  args: [7n],
});
```

## Finding Factory Pools

Factory pools are user-deployed. They follow standard interfaces but may have unusual token configurations.

```typescript
const STABLESWAP_FACTORY = "0xB9fC157394Af804a3578134A6585C0dc9cc990d4" as const;

const factoryAbi = parseAbi([
  "function pool_count() view returns (uint256)",
  "function pool_list(uint256 i) view returns (address)",
  "function get_coins(address _pool) view returns (address[4])",
  "function get_balances(address _pool) view returns (uint256[4])",
  "function get_n_coins(address _pool) view returns (uint256[2])",
  "function find_pool_for_coins(address _from, address _to) view returns (address)",
  "function find_pool_for_coins(address _from, address _to, uint256 i) view returns (address)",
]);

// Enumerate factory pools
const factoryPoolCount = await publicClient.readContract({
  address: STABLESWAP_FACTORY,
  abi: factoryAbi,
  functionName: "pool_count",
});
```

## Determining Pool Type

Not all pools expose a type identifier. Heuristics for determining pool type:

1. **Check the registry it came from** — StableSwap Factory = stableswap, CryptoSwap Factory = cryptoswap
2. **Check for `gamma()` function** — CryptoSwap pools have `gamma()`, StableSwap pools do not
3. **Check coin count** — Tricrypto pools have exactly 3 coins with volatile assets
4. **Check `A()` value** — StableSwap typically has A in 10-5000 range

```typescript
async function isLikelyCryptoSwap(pool: Address): Promise<boolean> {
  try {
    const gammaAbi = parseAbi(["function gamma() view returns (uint256)"]);
    await publicClient.readContract({ address: pool, abi: gammaAbi, functionName: "gamma" });
    return true;
  } catch {
    return false;
  }
}
```

## Reference

- [Curve MetaRegistry Docs](https://docs.curve.fi/registry/MetaRegistry/)
- [Curve AddressProvider](https://docs.curve.fi/registry/AddressProvider/)
- [Curve Pool List (UI)](https://curve.fi/#/ethereum/pools)
