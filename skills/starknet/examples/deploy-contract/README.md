# Deploy Contract Examples

Complete deployment workflows for StarkNet contracts using starkli, sncast, and starknet.js.

## Prerequisites

A funded StarkNet account is required. On testnet, use the faucet at `https://starknet-faucet.vercel.app`.

## Build with Scarb

```bash
# Compile Cairo to Sierra
scarb build

# Output location
ls target/dev/
# my_contract_Counter.contract_class.json      (Sierra — for declaration)
# my_contract_Counter.compiled_contract_class.json  (CASM — optional, for local verification)
```

## Deploy with starkli

### Account Setup

```bash
# Create a new signer (generates private key)
starkli signer keystore new ~/.starkli-wallets/deployer/keystore.json

# Fetch an existing account descriptor (Argent X or Braavos)
starkli account fetch <ACCOUNT_ADDRESS> \
  --output ~/.starkli-wallets/deployer/account.json \
  --rpc https://starknet-sepolia.public.blastapi.io/rpc/v0_7
```

### Set Environment Variables

```bash
export STARKNET_RPC=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
export STARKNET_ACCOUNT=~/.starkli-wallets/deployer/account.json
export STARKNET_KEYSTORE=~/.starkli-wallets/deployer/keystore.json
```

### Declare (Upload Contract Class)

```bash
starkli declare target/dev/my_contract_Counter.contract_class.json

# Output:
# Sierra class hash: 0x01234...
# (You'll use this hash to deploy instances)
```

If the class is already declared, starkli returns the existing hash.

### Deploy (Create Contract Instance)

```bash
# Deploy with constructor argument (initial_count = 0)
starkli deploy 0x01234...CLASS_HASH 0x0

# Deploy with multiple constructor args
starkli deploy 0x01234...CLASS_HASH 0x1234 0x5678 0x0 0x100

# Output:
# Contract deployed at: 0xABCD...
```

### Verify on Explorer

After deployment, verify the contract on Voyager or Starkscan by navigating to the contract address. Both explorers can read the Sierra class and display the ABI.

## Deploy with sncast (Starknet Foundry)

### Configure snfoundry.toml

```toml
# snfoundry.toml
[sncast.sepolia]
account = "deployer"
url = "https://starknet-sepolia.public.blastapi.io/rpc/v0_7"

[sncast.sepolia.accounts.deployer]
address = "0x1234...YOUR_ACCOUNT"
private_key = "0xABCD...YOUR_KEY"
```

### Declare

```bash
sncast --profile sepolia declare --contract-name Counter

# Output:
# class_hash: 0x01234...
# transaction_hash: 0xABCD...
```

### Deploy

```bash
sncast --profile sepolia deploy \
  --class-hash 0x01234...CLASS_HASH \
  --constructor-calldata 0x0

# Output:
# contract_address: 0x5678...
# transaction_hash: 0xEFGH...
```

### Invoke and Call

```bash
# Invoke (state-changing)
sncast --profile sepolia invoke \
  --contract-address 0x5678... \
  --function increment

# Call (read-only)
sncast --profile sepolia call \
  --contract-address 0x5678... \
  --function get_count
```

## Deploy with starknet.js

```typescript
import { Account, RpcProvider, json, Contract } from "starknet";
import fs from "fs";

const provider = new RpcProvider({
  nodeUrl: process.env.STARKNET_RPC_URL!,
});

const account = new Account(
  provider,
  process.env.ACCOUNT_ADDRESS!,
  process.env.PRIVATE_KEY!,
);

// Step 1: Declare
const sierraContract = json.parse(
  fs.readFileSync("target/dev/my_contract_Counter.contract_class.json").toString("ascii"),
);
const casmContract = json.parse(
  fs.readFileSync("target/dev/my_contract_Counter.compiled_contract_class.json").toString("ascii"),
);

const declareResponse = await account.declare({
  contract: sierraContract,
  casm: casmContract,
});

console.log("Class hash:", declareResponse.class_hash);
await provider.waitForTransaction(declareResponse.transaction_hash);

// Step 2: Deploy
const deployResponse = await account.deployContract({
  classHash: declareResponse.class_hash,
  constructorCalldata: [0], // initial_count = 0
});

console.log("Contract address:", deployResponse.contract_address);
await provider.waitForTransaction(deployResponse.transaction_hash);

// Step 3: Interact
const abi = sierraContract.abi;
const contract = new Contract(abi, deployResponse.contract_address, provider);
contract.connect(account);

const tx = await contract.increment();
await provider.waitForTransaction(tx.transaction_hash);

const count = await contract.get_count();
console.log("Count:", count.toString());
```

## Account Deployment

Deploying a new account contract (for fresh wallets).

```typescript
import { Account, RpcProvider, ec, hash, stark } from "starknet";

const provider = new RpcProvider({
  nodeUrl: process.env.STARKNET_RPC_URL!,
});

// Generate key pair
const privateKey = stark.randomAddress();
const publicKey = ec.starkCurve.getStarkKey(privateKey);

// OZ account class hash (check for latest version)
const ozAccountClassHash = "0x061dac032f228abef9c6f3bc2e2e5943e09e62e89b0c04aa42a93fba7a788688";

// Compute future address
const constructorCalldata = [publicKey];
const contractAddress = hash.calculateContractAddressFromHash(
  publicKey, // salt
  ozAccountClassHash,
  constructorCalldata,
  0, // deployer address (0 = direct deploy)
);

console.log("Pre-computed address:", contractAddress);
console.log("Fund this address with STRK or ETH before deploying");

// After funding, deploy the account
const account = new Account(provider, contractAddress, privateKey);

const deployAccountPayload = {
  classHash: ozAccountClassHash,
  constructorCalldata,
  addressSalt: publicKey,
};

const { transaction_hash, contract_address } = await account.deployAccount(
  deployAccountPayload,
);

console.log("Account deployed at:", contract_address);
await provider.waitForTransaction(transaction_hash);
```

## Testnet Deployment Checklist

1. Install tools: Scarb, starkli or snforge/sncast
2. Fund account on Sepolia via faucet
3. `scarb build` — compile Cairo to Sierra
4. Declare the contract class
5. Deploy an instance with constructor args
6. Verify on Sepolia Voyager (`https://sepolia.voyager.online`)
7. Test interactions via CLI or starknet.js
