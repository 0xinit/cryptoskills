// Aptos TypeScript Client Starter
//
// Usage:
//   1. npm install @aptos-labs/ts-sdk
//   2. Set APTOS_PRIVATE_KEY and APTOS_NETWORK environment variables
//   3. npx tsx aptos-client.ts

import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  AccountAddress,
} from "@aptos-labs/ts-sdk";

function getNetwork(): Network {
  const net = process.env.APTOS_NETWORK ?? "testnet";
  switch (net.toLowerCase()) {
    case "mainnet":
      return Network.MAINNET;
    case "testnet":
      return Network.TESTNET;
    case "devnet":
      return Network.DEVNET;
    default:
      throw new Error(`Unknown network: ${net}. Use mainnet, testnet, or devnet.`);
  }
}

function createClient(): Aptos {
  const config = new AptosConfig({ network: getNetwork() });
  return new Aptos(config);
}

function loadAccount(): Account {
  const key = process.env.APTOS_PRIVATE_KEY;
  if (!key) {
    throw new Error("APTOS_PRIVATE_KEY environment variable is required");
  }
  const privateKey = new Ed25519PrivateKey(key);
  return Account.fromPrivateKey({ privateKey });
}

// 1 APT = 100,000,000 octas
const OCTAS_PER_APT = 100_000_000;

async function getBalance(aptos: Aptos, address: AccountAddress): Promise<bigint> {
  const result = await aptos.view({
    payload: {
      function: "0x1::coin::balance",
      typeArguments: ["0x1::aptos_coin::AptosCoin"],
      functionArguments: [address],
    },
  });
  return BigInt(result[0] as string);
}

async function transfer(
  aptos: Aptos,
  sender: Account,
  recipient: string,
  amountOctas: number
): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: sender.accountAddress,
    data: {
      function: "0x1::aptos_account::transfer",
      functionArguments: [AccountAddress.from(recipient), amountOctas],
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

  return result.hash;
}

async function callEntryFunction(
  aptos: Aptos,
  sender: Account,
  functionId: `${string}::${string}::${string}`,
  typeArgs: string[],
  args: (string | number | boolean | Uint8Array)[]
): Promise<string> {
  const transaction = await aptos.transaction.build.simple({
    sender: sender.accountAddress,
    data: {
      function: functionId,
      typeArguments: typeArgs,
      functionArguments: args,
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
    throw new Error(`Transaction failed: ${result.vm_status}`);
  }

  return result.hash;
}

async function viewFunction(
  aptos: Aptos,
  functionId: `${string}::${string}::${string}`,
  typeArgs: string[],
  args: (string | number | boolean)[]
): Promise<unknown[]> {
  return aptos.view({
    payload: {
      function: functionId,
      typeArguments: typeArgs,
      functionArguments: args,
    },
  });
}

async function main() {
  const aptos = createClient();
  const account = loadAccount();

  console.log("Network:", process.env.APTOS_NETWORK ?? "testnet");
  console.log("Address:", account.accountAddress.toString());

  const balance = await getBalance(aptos, account.accountAddress);
  const apt = Number(balance) / OCTAS_PER_APT;
  console.log(`Balance: ${apt} APT (${balance} octas)`);
}

main().catch((error: Error) => {
  console.error("Fatal:", error.message);
  process.exit(1);
});
