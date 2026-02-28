# Read Account Resources on Aptos

Query on-chain state using account resources, view functions, and the Aptos indexer. All examples use `@aptos-labs/ts-sdk`.

## Read All Resources at an Address

```typescript
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAddress,
} from "@aptos-labs/ts-sdk";

const config = new AptosConfig({ network: Network.MAINNET });
const aptos = new Aptos(config);

async function getAllResources(address: string) {
  const resources = await aptos.getAccountResources({
    accountAddress: AccountAddress.from(address),
  });

  for (const resource of resources) {
    console.log(resource.type, JSON.stringify(resource.data, null, 2));
  }

  return resources;
}
```

## Read a Specific Resource

```typescript
interface CoinStoreData {
  coin: { value: string };
  frozen: boolean;
  deposit_events: { counter: string };
  withdraw_events: { counter: string };
}

async function getAPTBalance(address: string): Promise<bigint> {
  const resource = await aptos.getAccountResource<CoinStoreData>({
    accountAddress: AccountAddress.from(address),
    resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
  });

  return BigInt(resource.coin.value);
}

async function getCustomCoinBalance(
  address: string,
  coinType: string
): Promise<bigint> {
  try {
    const resource = await aptos.getAccountResource<CoinStoreData>({
      accountAddress: AccountAddress.from(address),
      resourceType: `0x1::coin::CoinStore<${coinType}>`,
    });
    return BigInt(resource.coin.value);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return 0n;
    }
    throw error;
  }
}
```

## View Functions

View functions are annotated with `#[view]` in Move. They execute off-chain and do not require a transaction.

```typescript
async function callViewFunction(
  functionId: string,
  typeArgs: string[],
  args: (string | number | boolean)[]
): Promise<unknown[]> {
  const result = await aptos.view({
    payload: {
      function: functionId as `${string}::${string}::${string}`,
      typeArguments: typeArgs,
      functionArguments: args,
    },
  });

  return result;
}

// Get APT balance via view function
async function getBalanceView(address: string): Promise<bigint> {
  const result = await aptos.view({
    payload: {
      function: "0x1::coin::balance",
      typeArguments: ["0x1::aptos_coin::AptosCoin"],
      functionArguments: [AccountAddress.from(address)],
    },
  });

  return BigInt(result[0] as string);
}

// Check if an account is registered for a coin
async function isCoinRegistered(
  address: string,
  coinType: string
): Promise<boolean> {
  const result = await aptos.view({
    payload: {
      function: "0x1::coin::is_account_registered",
      typeArguments: [coinType],
      functionArguments: [AccountAddress.from(address)],
    },
  });

  return result[0] as boolean;
}

// Get coin supply
async function getCoinSupply(coinType: string): Promise<bigint | null> {
  const result = await aptos.view({
    payload: {
      function: "0x1::coin::supply",
      typeArguments: [coinType],
      functionArguments: [],
    },
  });

  const supply = result[0] as { vec: string[] };
  if (supply.vec.length === 0) {
    return null; // supply tracking not enabled
  }
  return BigInt(supply.vec[0]);
}
```

## Read Account Modules

```typescript
async function getAccountModules(address: string) {
  const modules = await aptos.getAccountModules({
    accountAddress: AccountAddress.from(address),
  });

  for (const mod of modules) {
    console.log("Module:", mod.abi?.name);
    const functions = mod.abi?.exposed_functions ?? [];
    for (const fn of functions) {
      const visibility = fn.is_view ? "[view]" : fn.is_entry ? "[entry]" : "[public]";
      console.log(`  ${visibility} ${fn.name}(${fn.params.join(", ")})`);
    }
  }

  return modules;
}
```

## Read Transaction History

```typescript
async function getAccountTransactions(
  address: string,
  limit: number = 25
) {
  const transactions = await aptos.getAccountTransactions({
    accountAddress: AccountAddress.from(address),
    options: { limit },
  });

  for (const tx of transactions) {
    if (tx.type === "user_transaction") {
      console.log(
        `Hash: ${tx.hash}`,
        `Success: ${tx.success}`,
        `Function: ${(tx as { payload?: { function?: string } }).payload?.function ?? "unknown"}`,
        `Gas: ${tx.gas_used}`
      );
    }
  }

  return transactions;
}
```

## Read Events

```typescript
async function getDepositEvents(address: string) {
  const events = await aptos.getAccountEventsByEventType({
    accountAddress: AccountAddress.from(address),
    eventType: "0x1::coin::DepositEvent",
  });

  return events;
}

// Read module-emitted events (Aptos framework events, post-v1.9)
async function getModuleEvents(
  accountAddress: string,
  eventType: string,
  limit: number = 10
) {
  const events = await aptos.getEvents({
    options: {
      where: {
        account_address: { _eq: accountAddress },
        type: { _eq: eventType },
      },
      limit,
      orderBy: [{ transaction_version: "desc" }],
    },
  });

  return events;
}
```

## Check if Resource Exists

```typescript
async function resourceExists(
  address: string,
  resourceType: string
): Promise<boolean> {
  try {
    await aptos.getAccountResource({
      accountAddress: AccountAddress.from(address),
      resourceType,
    });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return false;
    }
    throw error;
  }
}
```

## Read Table Items

Tables in Aptos are key-value stores that live inside resources. You need the table handle to query them.

```typescript
async function readTableItem(
  tableHandle: string,
  keyType: string,
  valueType: string,
  key: string
): Promise<unknown> {
  const result = await aptos.getTableItem({
    handle: tableHandle,
    data: {
      key_type: keyType,
      value_type: valueType,
      key,
    },
  });

  return result;
}

// Read a staking pool's stake amount
async function getStakePoolBalance(poolAddress: string): Promise<{
  active: bigint;
  inactive: bigint;
  pending_active: bigint;
  pending_inactive: bigint;
}> {
  const resource = await aptos.getAccountResource<{
    active: { value: string };
    inactive: { value: string };
    pending_active: { value: string };
    pending_inactive: { value: string };
  }>({
    accountAddress: AccountAddress.from(poolAddress),
    resourceType: "0x1::stake::StakePool",
  });

  return {
    active: BigInt(resource.active.value),
    inactive: BigInt(resource.inactive.value),
    pending_active: BigInt(resource.pending_active.value),
    pending_inactive: BigInt(resource.pending_inactive.value),
  };
}
```

## Move: View Function Examples

```move
module my_addr::reader {
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::account;

    #[view]
    public fun get_apt_balance(addr: address): u64 {
        coin::balance<AptosCoin>(addr)
    }

    #[view]
    public fun account_exists(addr: address): bool {
        account::exists_at(addr)
    }

    #[view]
    public fun current_timestamp(): u64 {
        timestamp::now_seconds()
    }

    #[view]
    public fun has_coin_store<CoinType>(addr: address): bool {
        coin::is_account_registered<CoinType>(addr)
    }
}
```

## Common Patterns

| Task | Method |
|------|--------|
| Get APT balance | `aptos.view({ function: "0x1::coin::balance", typeArguments: ["0x1::aptos_coin::AptosCoin"] })` |
| Get all resources | `aptos.getAccountResources({ accountAddress })` |
| Get specific resource | `aptos.getAccountResource({ accountAddress, resourceType })` |
| List modules | `aptos.getAccountModules({ accountAddress })` |
| Read table entry | `aptos.getTableItem({ handle, data: { key_type, value_type, key } })` |
| Get events | `aptos.getAccountEventsByEventType({ accountAddress, eventType })` |
| Check account exists | `aptos.getAccountInfo({ accountAddress })` |
