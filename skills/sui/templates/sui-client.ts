import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";

// --- Configuration ---

type SuiNetwork = "mainnet" | "testnet" | "devnet";

const NETWORK: SuiNetwork = (process.env.SUI_NETWORK as SuiNetwork) ?? "testnet";

const client = new SuiClient({
  url: process.env.SUI_RPC_URL ?? getFullnodeUrl(NETWORK),
});

function getKeypair(): Ed25519Keypair {
  const key = process.env.SUI_PRIVATE_KEY;
  if (!key) {
    throw new Error("SUI_PRIVATE_KEY environment variable is required");
  }
  return Ed25519Keypair.fromSecretKey(fromBase64(key));
}

// --- Read Operations ---

async function getBalance(address: string): Promise<bigint> {
  const balance = await client.getBalance({
    owner: address,
    coinType: "0x2::sui::SUI",
  });
  return BigInt(balance.totalBalance);
}

async function getObjectFields(
  objectId: string
): Promise<Record<string, unknown> | null> {
  const obj = await client.getObject({
    id: objectId,
    options: { showContent: true },
  });

  if (obj.data?.content?.dataType !== "moveObject") {
    return null;
  }

  return obj.data.content.fields as Record<string, unknown>;
}

// --- Write Operations ---

async function transferSui(
  recipientAddress: string,
  amountMist: bigint
): Promise<string> {
  const keypair = getKeypair();
  const tx = new Transaction();

  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
  tx.transferObjects([coin], tx.pure.address(recipientAddress));

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Transfer failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  return result.digest;
}

async function callMoveFunction(
  packageId: string,
  moduleName: string,
  functionName: string,
  args: Array<{ type: "object"; value: string } | { type: "u64"; value: bigint } | { type: "string"; value: string } | { type: "address"; value: string } | { type: "bool"; value: boolean }>,
  typeArgs: string[] = []
): Promise<string> {
  const keypair = getKeypair();
  const tx = new Transaction();

  const txArgs = args.map((arg) => {
    switch (arg.type) {
      case "object":
        return tx.object(arg.value);
      case "u64":
        return tx.pure.u64(arg.value);
      case "string":
        return tx.pure.string(arg.value);
      case "address":
        return tx.pure.address(arg.value);
      case "bool":
        return tx.pure.bool(arg.value);
    }
  });

  tx.moveCall({
    target: `${packageId}::${moduleName}::${functionName}`,
    arguments: txArgs,
    typeArguments: typeArgs,
  });

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showEvents: true },
  });

  if (result.effects?.status?.status !== "success") {
    throw new Error(
      `Move call failed: ${result.effects?.status?.error ?? "unknown error"}`
    );
  }

  return result.digest;
}

// --- Main ---

async function main() {
  const keypair = getKeypair();
  const address = keypair.getPublicKey().toSuiAddress();

  console.log("Network:", NETWORK);
  console.log("Address:", address);

  const balance = await getBalance(address);
  console.log("Balance:", `${balance} MIST (${Number(balance) / 1e9} SUI)`);
}

main().catch((err: Error) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
