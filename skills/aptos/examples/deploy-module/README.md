# Deploy a Move Module to Aptos

End-to-end guide: write a Move module, compile, test, and deploy to Aptos testnet using both the CLI and the TypeScript SDK.

## Move Module

A simple vault that accepts APT deposits per user.

```move
module vault_addr::vault {
    use std::signer;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;

    struct VaultConfig has key {
        total_deposited: u64,
        is_paused: bool,
        admin: address,
    }

    struct UserVault has key {
        deposited: u64,
    }

    #[event]
    struct DepositEvent has drop, store {
        user: address,
        amount: u64,
    }

    #[event]
    struct WithdrawEvent has drop, store {
        user: address,
        amount: u64,
    }

    const E_NOT_ADMIN: u64 = 1;
    const E_PAUSED: u64 = 2;
    const E_INSUFFICIENT_BALANCE: u64 = 3;
    const E_ZERO_AMOUNT: u64 = 4;

    public entry fun initialize(admin: &signer) {
        move_to(admin, VaultConfig {
            total_deposited: 0,
            is_paused: false,
            admin: signer::address_of(admin),
        });
    }

    public entry fun deposit(
        user: &signer,
        config_addr: address,
        amount: u64,
    ) acquires VaultConfig, UserVault {
        assert!(amount > 0, E_ZERO_AMOUNT);
        let config = borrow_global_mut<VaultConfig>(config_addr);
        assert!(!config.is_paused, E_PAUSED);

        let user_addr = signer::address_of(user);
        let coins = coin::withdraw<AptosCoin>(user, amount);
        coin::deposit(config_addr, coins);

        config.total_deposited = config.total_deposited + amount;

        if (exists<UserVault>(user_addr)) {
            let vault = borrow_global_mut<UserVault>(user_addr);
            vault.deposited = vault.deposited + amount;
        } else {
            move_to(user, UserVault { deposited: amount });
        };

        event::emit(DepositEvent { user: user_addr, amount });
    }

    public entry fun pause(admin: &signer, config_addr: address) acquires VaultConfig {
        let config = borrow_global_mut<VaultConfig>(config_addr);
        assert!(signer::address_of(admin) == config.admin, E_NOT_ADMIN);
        config.is_paused = true;
    }

    #[view]
    public fun get_user_balance(user: address): u64 acquires UserVault {
        if (exists<UserVault>(user)) {
            borrow_global<UserVault>(user).deposited
        } else {
            0
        }
    }

    #[view]
    public fun get_total_deposited(config_addr: address): u64 acquires VaultConfig {
        borrow_global<VaultConfig>(config_addr).total_deposited
    }
}
```

## Move.toml

```toml
[package]
name = "vault"
version = "0.1.0"

[addresses]
vault_addr = "_"

[dependencies]
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework", rev = "mainnet" }
```

## Compile and Test (CLI)

```bash
# Compile (replace with your testnet address or use 'default' profile)
aptos move compile --named-addresses vault_addr=default

# Run unit tests
aptos move test --named-addresses vault_addr=default

# Publish to testnet
aptos move publish \
  --named-addresses vault_addr=default \
  --profile testnet \
  --assume-yes
```

## Unit Tests

```move
#[test_only]
module vault_addr::vault_tests {
    use std::signer;
    use vault_addr::vault;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::{Self, AptosCoin};

    fun setup_test(aptos_framework: &signer, admin: &signer, user: &signer) {
        account::create_account_for_test(signer::address_of(admin));
        account::create_account_for_test(signer::address_of(user));

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);

        coin::register<AptosCoin>(admin);
        coin::register<AptosCoin>(user);

        let coins = coin::mint(1_000_000_000, &mint_cap);
        coin::deposit(signer::address_of(user), coins);

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(aptos_framework = @0x1, admin = @0x100, user = @0x200)]
    fun test_deposit(
        aptos_framework: &signer,
        admin: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, admin, user);

        vault::initialize(admin);
        vault::deposit(user, signer::address_of(admin), 500_000_000);

        assert!(vault::get_user_balance(signer::address_of(user)) == 500_000_000, 0);
        assert!(vault::get_total_deposited(signer::address_of(admin)) == 500_000_000, 1);
    }

    #[test(aptos_framework = @0x1, admin = @0x100, user = @0x200)]
    #[expected_failure(abort_code = 4)]
    fun test_zero_deposit_fails(
        aptos_framework: &signer,
        admin: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, admin, user);
        vault::initialize(admin);
        vault::deposit(user, signer::address_of(admin), 0);
    }
}
```

## Deploy with TypeScript SDK

```typescript
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
} from "@aptos-labs/ts-sdk";
import * as fs from "fs";
import * as path from "path";

async function deployModule() {
  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);

  const privateKey = new Ed25519PrivateKey(process.env.APTOS_PRIVATE_KEY ?? "");
  const deployer = Account.fromPrivateKey({ privateKey });

  console.log("Deployer:", deployer.accountAddress.toString());

  const buildDir = path.join("build", "vault");
  const packageMetadata = fs.readFileSync(
    path.join(buildDir, "package-metadata.bcs")
  );
  const moduleData = fs.readFileSync(
    path.join(buildDir, "bytecode_modules", "vault.mv")
  );

  const transaction = await aptos.publishPackageTransaction({
    account: deployer.accountAddress,
    metadataBytes: packageMetadata,
    moduleBytecode: [moduleData],
  });

  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: deployer,
    transaction,
  });

  const result = await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  if (!result.success) {
    throw new Error(`Module deployment failed: ${result.vm_status}`);
  }

  console.log("Deployed:", result.hash);
  return result;
}

deployModule().catch(console.error);
```

## Interact After Deployment

```typescript
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  AccountAddress,
} from "@aptos-labs/ts-sdk";

async function interactWithVault() {
  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);

  const privateKey = new Ed25519PrivateKey(process.env.APTOS_PRIVATE_KEY ?? "");
  const user = Account.fromPrivateKey({ privateKey });

  const vaultAddr = process.env.VAULT_ADDRESS ?? "";

  const depositTx = await aptos.transaction.build.simple({
    sender: user.accountAddress,
    data: {
      function: `${vaultAddr}::vault::deposit`,
      functionArguments: [
        AccountAddress.from(vaultAddr),
        50_000_000, // 0.5 APT
      ],
    },
  });

  const pending = await aptos.signAndSubmitTransaction({
    signer: user,
    transaction: depositTx,
  });

  const result = await aptos.waitForTransaction({
    transactionHash: pending.hash,
  });

  if (!result.success) {
    throw new Error(`Deposit failed: ${result.vm_status}`);
  }

  console.log("Deposit tx:", result.hash);

  const balance = await aptos.view({
    payload: {
      function: `${vaultAddr}::vault::get_user_balance`,
      typeArguments: [],
      functionArguments: [user.accountAddress],
    },
  });

  console.log("User vault balance:", balance[0], "octas");
}

interactWithVault().catch(console.error);
```

## Verify Deployment

```bash
# Check the module exists on-chain
aptos move view \
  --function-id '<vault_address>::vault::get_total_deposited' \
  --args 'address:<vault_address>' \
  --profile testnet
```

## Common Deployment Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `EMODULE_ALREADY_EXISTS` | Module already published at this address | Use `aptos move publish --upgrade-policy compatible` for upgrades |
| `INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE` | Account needs more APT | Fund from faucet: `aptos account fund-with-faucet --profile testnet` |
| `EPACKAGE_DEP_MISSING` | Missing framework dependency | Ensure `AptosFramework` is in `Move.toml` dependencies |
| Named address not set | `_` placeholder not resolved | Pass `--named-addresses vault_addr=0x...` with actual address |
