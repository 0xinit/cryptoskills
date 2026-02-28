# Transfer Coins on Aptos

Transfer APT and custom coins using the TypeScript SDK. Covers single transfers, batch transfers, coin registration, and gas estimation.

## Transfer APT

```typescript
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  AccountAddress,
} from "@aptos-labs/ts-sdk";

async function transferAPT() {
  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);

  const privateKey = new Ed25519PrivateKey(process.env.APTOS_PRIVATE_KEY ?? "");
  const sender = Account.fromPrivateKey({ privateKey });
  const recipient = "0x1234..."; // recipient address

  // aptos_account::transfer handles registration automatically
  const transaction = await aptos.transaction.build.simple({
    sender: sender.accountAddress,
    data: {
      function: "0x1::aptos_account::transfer",
      functionArguments: [
        AccountAddress.from(recipient),
        100_000_000, // 1 APT = 100,000,000 octas
      ],
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: sender,
    transaction,
  });

  const result = await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  if (!result.success) {
    throw new Error(`Transfer failed: ${result.vm_status}`);
  }

  console.log("Transfer hash:", result.hash);
  return result;
}

transferAPT().catch(console.error);
```

## Transfer Custom Coin

For custom coins (not APT), the recipient must be registered for the coin type first.

```typescript
async function transferCustomCoin(
  aptos: Aptos,
  sender: Account,
  recipientAddress: string,
  coinType: string,
  amount: number
) {
  // coin::transfer requires recipient to be registered
  const transaction = await aptos.transaction.build.simple({
    sender: sender.accountAddress,
    data: {
      function: "0x1::coin::transfer",
      typeArguments: [coinType],
      functionArguments: [
        AccountAddress.from(recipientAddress),
        amount,
      ],
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: sender,
    transaction,
  });

  const result = await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  if (!result.success) {
    throw new Error(`Coin transfer failed: ${result.vm_status}`);
  }

  return result;
}

// Usage: transfer USDC on Aptos
// The coin type is the full module path: <address>::<module>::<struct>
const USDC_COIN_TYPE = "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC";
```

## Register for a Coin

An account must register before it can receive a coin type. APT registration is automatic via `aptos_account::transfer`, but custom coins require explicit registration.

```typescript
async function registerCoin(
  aptos: Aptos,
  account: Account,
  coinType: string
) {
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: "0x1::managed_coin::register",
      typeArguments: [coinType],
      functionArguments: [],
    },
  });

  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });

  return aptos.waitForTransaction({ transactionHash: pendingTx.hash });
}
```

## Check Balance

```typescript
async function getCoinBalance(
  aptos: Aptos,
  address: string,
  coinType: string = "0x1::aptos_coin::AptosCoin"
): Promise<bigint> {
  const result = await aptos.view({
    payload: {
      function: "0x1::coin::balance",
      typeArguments: [coinType],
      functionArguments: [AccountAddress.from(address)],
    },
  });

  return BigInt(result[0] as string);
}

async function getAPTBalance(aptos: Aptos, address: string): Promise<string> {
  const octas = await getCoinBalance(aptos, address);
  const apt = Number(octas) / 1e8;
  return `${apt} APT (${octas} octas)`;
}
```

## Batch Transfers

Send APT to multiple recipients in separate transactions. Aptos does not support multi-call in a single transaction natively, so submit sequentially with nonce management.

```typescript
interface TransferRequest {
  recipient: string;
  amountOctas: number;
}

async function batchTransfer(
  aptos: Aptos,
  sender: Account,
  transfers: TransferRequest[]
): Promise<string[]> {
  const hashes: string[] = [];

  for (const transfer of transfers) {
    const transaction = await aptos.transaction.build.simple({
      sender: sender.accountAddress,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [
          AccountAddress.from(transfer.recipient),
          transfer.amountOctas,
        ],
      },
    });

    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: sender,
      transaction,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    if (!result.success) {
      throw new Error(
        `Transfer to ${transfer.recipient} failed: ${result.vm_status}`
      );
    }

    hashes.push(result.hash);
  }

  return hashes;
}
```

## Estimate Transfer Cost

```typescript
async function estimateTransferCost(
  aptos: Aptos,
  sender: Account,
  recipient: string,
  amountOctas: number
): Promise<{ gasUsed: bigint; gasCostOctas: bigint }> {
  const transaction = await aptos.transaction.build.simple({
    sender: sender.accountAddress,
    data: {
      function: "0x1::aptos_account::transfer",
      functionArguments: [
        AccountAddress.from(recipient),
        amountOctas,
      ],
    },
  });

  const simulation = await aptos.transaction.simulate.simple({
    signerPublicKey: sender.publicKey,
    transaction,
  });

  const gasUsed = BigInt(simulation[0].gas_used);
  const gasUnitPrice = BigInt(simulation[0].gas_unit_price);
  const gasCostOctas = gasUsed * gasUnitPrice;

  return { gasUsed, gasCostOctas };
}
```

## Move: Coin Transfer Functions

For reference, these are the framework functions used under the hood.

```move
// 0x1::aptos_account::transfer — transfers APT, auto-registers recipient
public entry fun transfer(source: &signer, to: address, amount: u64)

// 0x1::coin::transfer — transfers any coin type, recipient must be registered
public entry fun transfer<CoinType>(from: &signer, to: address, amount: u64)

// 0x1::aptos_account::transfer_coins — transfers any coin, auto-registers
public entry fun transfer_coins<CoinType>(from: &signer, to: address, amount: u64)
```

Use `aptos_account::transfer_coins` for custom coins when you want automatic registration. Use `coin::transfer` when you know the recipient is already registered (saves gas).

## Common Transfer Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ECOIN_STORE_NOT_PUBLISHED` | Recipient not registered for the coin type | Register first or use `aptos_account::transfer_coins` |
| `EINSUFFICIENT_BALANCE` | Sender doesn't have enough coins | Check balance before transferring |
| `EACCOUNT_NOT_FOUND` | Recipient address does not exist on chain | Use `aptos_account::transfer` which creates the account |
| `SEQUENCE_NUMBER_TOO_OLD` | Nonce conflict from concurrent submissions | Fetch latest sequence number or wait for prior tx |
