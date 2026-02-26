# Module Setup Examples

Enabling, disabling, and using Safe Modules and Guards.

## Setup

```typescript
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";

const RPC_URL = process.env.RPC_URL!;
const SAFE_ADDRESS = "0xYourSafeAddress";
const CHAIN_ID = 1n;
```

## Enable a Module

Enabling a module requires a Safe transaction signed by the threshold number of owners. Once enabled, the module can execute transactions on the Safe without any further owner signatures.

```typescript
async function enableModule(
  signerKey: string,
  moduleAddress: string
): Promise<string> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const enableModuleTx = await protocolKit.createEnableModuleTx(moduleAddress);
  const signedTx = await protocolKit.signTransaction(enableModuleTx);
  const result = await protocolKit.executeTransaction(signedTx);

  const isEnabled = await protocolKit.isModuleEnabled(moduleAddress);
  console.log(`Module ${moduleAddress} enabled:`, isEnabled);

  return result.hash;
}
```

## Disable a Module

```typescript
async function disableModule(
  signerKey: string,
  moduleAddress: string
): Promise<string> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const disableModuleTx = await protocolKit.createDisableModuleTx(moduleAddress);
  const signedTx = await protocolKit.signTransaction(disableModuleTx);
  const result = await protocolKit.executeTransaction(signedTx);

  const isEnabled = await protocolKit.isModuleEnabled(moduleAddress);
  console.log(`Module ${moduleAddress} enabled:`, isEnabled); // false

  return result.hash;
}
```

## List Active Modules

```typescript
async function listModules(signerKey: string): Promise<string[]> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const modules = await protocolKit.getModules();
  console.log("Active modules:", modules);

  if (modules.length === 0) {
    console.log("No modules enabled");
  }

  for (const moduleAddr of modules) {
    console.log(`  - ${moduleAddr}`);
  }

  return modules;
}
```

## Allowance Module (Spending Limits)

The Allowance Module lets individual owners spend tokens up to a recurring limit without requiring threshold signatures. Useful for operational expenses.

```typescript
import { encodeFunctionData } from "viem";

// Allowance Module (deployed by Safe team)
// https://github.com/safe-global/safe-modules/tree/main/modules/allowances
const ALLOWANCE_MODULE = "0xCFbFaC74C26F8647cBDb8c5caf80BB5b32E43134";

const ALLOWANCE_MODULE_ABI = [
  {
    name: "setAllowance",
    type: "function",
    inputs: [
      { name: "delegate", type: "address" },
      { name: "token", type: "address" },
      { name: "allowanceAmount", type: "uint96" },
      { name: "resetTimeMin", type: "uint16" },
      { name: "resetBaseMin", type: "uint32" },
    ],
    outputs: [],
  },
  {
    name: "executeAllowanceTransfer",
    type: "function",
    inputs: [
      { name: "safe", type: "address" },
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint96" },
      { name: "paymentToken", type: "address" },
      { name: "payment", type: "uint96" },
      { name: "delegate", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "addDelegate",
    type: "function",
    inputs: [{ name: "delegate", type: "address" }],
    outputs: [],
  },
] as const;

async function setupSpendingLimit(
  signerKey: string,
  delegateAddress: string,
  tokenAddress: string,
  // Max amount per period (USDC example: 1000 * 10^6)
  allowanceAmount: bigint,
  // Reset period in minutes (1440 = daily)
  resetTimeMinutes: number
) {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  // Step 1: Enable the allowance module (if not already enabled)
  const isEnabled = await protocolKit.isModuleEnabled(ALLOWANCE_MODULE);
  if (!isEnabled) {
    const enableTx = await protocolKit.createEnableModuleTx(ALLOWANCE_MODULE);
    const signedEnable = await protocolKit.signTransaction(enableTx);
    await protocolKit.executeTransaction(signedEnable);
    console.log("Allowance module enabled");
  }

  // Step 2: Add delegate
  const addDelegateTx = await protocolKit.createTransaction({
    transactions: [
      {
        to: ALLOWANCE_MODULE,
        value: "0",
        data: encodeFunctionData({
          abi: ALLOWANCE_MODULE_ABI,
          functionName: "addDelegate",
          args: [delegateAddress as `0x${string}`],
        }),
      },
    ],
  });
  const signedDelegate = await protocolKit.signTransaction(addDelegateTx);
  await protocolKit.executeTransaction(signedDelegate);

  // Step 3: Set allowance
  const setAllowanceTx = await protocolKit.createTransaction({
    transactions: [
      {
        to: ALLOWANCE_MODULE,
        value: "0",
        data: encodeFunctionData({
          abi: ALLOWANCE_MODULE_ABI,
          functionName: "setAllowance",
          args: [
            delegateAddress as `0x${string}`,
            tokenAddress as `0x${string}`,
            allowanceAmount,
            resetTimeMinutes,
            0, // resetBaseMin: 0 means reset period starts now
          ],
        }),
      },
    ],
  });
  const signedAllowance = await protocolKit.signTransaction(setAllowanceTx);
  await protocolKit.executeTransaction(signedAllowance);

  console.log(
    `Spending limit set: ${delegateAddress} can spend ${allowanceAmount} of ${tokenAddress} every ${resetTimeMinutes} minutes`
  );
}
```

## Set a Transaction Guard

Guards run pre- and post-execution checks on every Safe transaction. Unlike modules, guards cannot initiate transactions -- they enforce policies.

```typescript
async function setGuard(
  signerKey: string,
  guardAddress: string
): Promise<string> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const setGuardTx = await protocolKit.createEnableGuardTx(guardAddress);
  const signedTx = await protocolKit.signTransaction(setGuardTx);
  const result = await protocolKit.executeTransaction(signedTx);

  console.log("Guard set to:", guardAddress);
  return result.hash;
}
```

## Remove a Guard

```typescript
async function removeGuard(signerKey: string): Promise<string> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  // Passing no address (or zero address) removes the guard
  const removeGuardTx = await protocolKit.createDisableGuardTx();
  const signedTx = await protocolKit.signTransaction(removeGuardTx);
  const result = await protocolKit.executeTransaction(signedTx);

  console.log("Guard removed");
  return result.hash;
}
```

## Recovery Module Pattern

A recovery module allows designated guardians to change Safe owners if keys are lost. The Delay Module is typically combined to add a cooldown period so the original owners can veto a malicious recovery attempt.

```typescript
// The Social Recovery Module and Delay Module are part of the Zodiac collection:
// https://github.com/gnosis/zodiac
//
// Typical setup:
// 1. Deploy a Delay Module with a 48-hour cooldown
// 2. Deploy a Recovery Module with guardian addresses
// 3. Connect the Recovery Module through the Delay Module
// 4. Enable the Delay Module on the Safe
//
// Flow:
// - Guardian initiates recovery -> Delay Module queues it -> 48h cooldown
// - Original owners can veto during cooldown
// - After cooldown, anyone can finalize the recovery

async function enableRecoveryWithDelay(
  signerKey: string,
  delayModuleAddress: string
): Promise<void> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  // Enable the Delay Module (which has the Recovery Module connected to it)
  const enableTx = await protocolKit.createEnableModuleTx(delayModuleAddress);
  const signedTx = await protocolKit.signTransaction(enableTx);
  await protocolKit.executeTransaction(signedTx);

  console.log("Recovery + Delay module enabled");
}
```

## Module Security Audit Checklist

Before enabling any module on a production Safe:

1. **Verify the contract source is verified on Etherscan/Blockscout**
2. **Check if the module has been audited** -- Safe's own modules are audited, third-party modules may not be
3. **Understand the module's permissions** -- what transactions can it execute without owner approval?
4. **Test on a fork first** -- deploy a test Safe on a local fork and run through all module operations
5. **Use the Delay Module as a safety net** -- any module routed through a Delay Module gives owners a veto window

```typescript
async function auditModuleSetup(signerKey: string): Promise<void> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerKey,
    safeAddress: SAFE_ADDRESS,
  });

  const modules = await protocolKit.getModules();
  const owners = await protocolKit.getOwners();
  const threshold = await protocolKit.getThreshold();

  console.log("=== Safe Module Audit ===");
  console.log(`Safe: ${SAFE_ADDRESS}`);
  console.log(`Owners: ${owners.length} (threshold: ${threshold})`);
  console.log(`Active modules: ${modules.length}`);

  for (const mod of modules) {
    console.log(`  Module: ${mod}`);
    // Verify each module address on-chain
    // cast code <moduleAddress> --rpc-url $RPC_URL
  }

  if (modules.length === 0) {
    console.log("  No modules enabled (safest configuration)");
  }
}
```
