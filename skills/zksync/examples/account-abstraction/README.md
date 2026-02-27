# Native Account Abstraction on zkSync Era

On zkSync Era, every account is a smart account. EOAs use a default built-in implementation. Custom accounts implement the `IAccount` interface and are deployed through the `ContractDeployer` system contract.

This differs fundamentally from Ethereum's ERC-4337, which requires a separate EntryPoint contract, bundlers, and UserOperations. On zkSync, AA is built into the protocol — regular transactions trigger account validation/execution hooks directly.

## IAccount Interface

Every custom account must implement five functions:

| Function | Called By | Purpose |
|----------|-----------|---------|
| `validateTransaction` | Bootloader | Verify signature/authorization |
| `executeTransaction` | Bootloader | Execute the transaction logic |
| `executeTransactionFromOutside` | Anyone | Allow relay-style execution |
| `payForTransaction` | Bootloader | Pay gas (when no paymaster) |
| `prepareForPaymaster` | Bootloader | Set up ERC-20 approval for paymaster |

## Multi-Signature Account

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@matterlabs/zk-contracts/l2/system-contracts/interfaces/IAccount.sol";
import "@matterlabs/zk-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import "@matterlabs/zk-contracts/l2/system-contracts/Constants.sol";
import "@matterlabs/zk-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// 2-of-2 multi-sig account
contract MultiSigAccount is IAccount {
    using TransactionHelper for Transaction;

    address public owner1;
    address public owner2;

    // bytes4(keccak256("isValidSignature(bytes32,bytes)")
    bytes4 constant EIP1271_SUCCESS = 0x1626ba7e;

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader");
        _;
    }

    constructor(address _owner1, address _owner2) {
        owner1 = _owner1;
        owner2 = _owner2;
    }

    function validateTransaction(
        bytes32,
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) external payable override onlyBootloader returns (bytes4 magic) {
        magic = _validateTransaction(_suggestedSignedHash, _transaction);
    }

    function _validateTransaction(
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) internal view returns (bytes4 magic) {
        // Use suggested hash or compute from transaction
        bytes32 txHash = _suggestedSignedHash != bytes32(0)
            ? _suggestedSignedHash
            : _transaction.encodeHash();

        // Signature must be 130 bytes: 65 bytes per signer
        require(_transaction.signature.length == 130, "Invalid sig length");

        bytes memory sig1 = _transaction.signature[0:65];
        bytes memory sig2 = _transaction.signature[65:130];

        address signer1 = ECDSA.recover(txHash, sig1);
        address signer2 = ECDSA.recover(txHash, sig2);

        require(signer1 == owner1 && signer2 == owner2, "Invalid signers");

        magic = ACCOUNT_VALIDATION_SUCCESS_MAGIC;
    }

    function executeTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _executeTransaction(_transaction);
    }

    function _executeTransaction(Transaction calldata _transaction) internal {
        address to = address(uint160(_transaction.to));
        uint128 value = Utils.safeCastToU128(_transaction.value);
        bytes memory data = _transaction.data;

        if (to == address(DEPLOYER_SYSTEM_CONTRACT)) {
            // Contract deployment — must use system call
            SystemContractsCaller.systemCallWithPropagatedRevert(
                uint32(gasleft()),
                to,
                value,
                data
            );
        } else {
            bool success;
            assembly {
                success := call(gas(), to, value, add(data, 0x20), mload(data), 0, 0)
            }
            require(success, "Execution failed");
        }
    }

    function executeTransactionFromOutside(
        Transaction calldata _transaction
    ) external payable override {
        bytes4 magic = _validateTransaction(bytes32(0), _transaction);
        require(magic == ACCOUNT_VALIDATION_SUCCESS_MAGIC, "Invalid tx");
        _executeTransaction(_transaction);
    }

    function payForTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        bool success = _transaction.payToTheBootloader();
        require(success, "Payment to bootloader failed");
    }

    function prepareForPaymaster(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _transaction.processPaymasterInput();
    }

    fallback() external payable {}
    receive() external payable {}
}
```

## Deploying a Smart Account

Smart accounts must be deployed via `ContractDeployer` using the `createAccount` deployment type. Using standard `deploy` will deploy a regular contract, not an account.

```typescript
// deploy/deploy-multisig.ts
import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet, Provider, utils, EIP712Signer, types } from "zksync-ethers";
import { ethers } from "ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(process.env.PRIVATE_KEY!, provider);
  const deployer = new Deployer(hre, wallet);

  // Two owners for the multi-sig
  const owner1 = Wallet.createRandom();
  const owner2 = Wallet.createRandom();

  const artifact = await deployer.loadArtifact("MultiSigAccount");

  // Deploy as account (not regular contract)
  const account = await deployer.deploy(
    artifact,
    [owner1.address, owner2.address],
    "createAccount" // this tells ContractDeployer this is an account
  );
  await account.waitForDeployment();

  const accountAddress = await account.getAddress();
  console.log(`MultiSig account deployed to: ${accountAddress}`);

  // Fund the account so it can pay for gas
  await wallet.sendTransaction({
    to: accountAddress,
    value: ethers.parseEther("0.01"),
  });

  console.log("Account funded with 0.01 ETH");
}
```

## Sending Transactions from a Smart Account

```typescript
import { Provider, Wallet, EIP712Signer, types, utils } from "zksync-ethers";
import { ethers } from "ethers";

async function sendFromMultiSig(
  provider: Provider,
  accountAddress: string,
  owner1: Wallet,
  owner2: Wallet,
  to: string,
  data: string,
  value: bigint = 0n
) {
  // Build the transaction
  let tx = {
    from: accountAddress,
    to,
    chainId: (await provider.getNetwork()).chainId,
    nonce: await provider.getTransactionCount(accountAddress),
    type: 113, // EIP-712 transaction type for zkSync
    value,
    data,
    gasLimit: 0n, // will be estimated
    gasPrice: await provider.getGasPrice(),
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    } as types.Eip712Meta,
  };

  // Estimate gas
  tx.gasLimit = await provider.estimateGas(tx);

  // Get the EIP-712 hash for signing
  const signedTxHash = EIP712Signer.getSignedDigest(tx);

  // Both owners sign
  const sig1 = ethers.Signature.from(
    owner1.signingKey.sign(signedTxHash)
  ).serialized;
  const sig2 = ethers.Signature.from(
    owner2.signingKey.sign(signedTxHash)
  ).serialized;

  // Concatenate signatures (remove 0x prefix from second)
  tx.customData = {
    ...tx.customData,
    customSignature: ethers.concat([sig1, sig2]),
  };

  // Serialize and send
  const serialized = utils.serialize(tx);
  const txResponse = await provider.broadcastTransaction(serialized);
  const receipt = await txResponse.wait();

  console.log(`Transaction executed: ${receipt.hash}`);
  return receipt;
}
```

## AA Transaction Flow

1. User constructs a type-113 (EIP-712) transaction with `from` set to the smart account address
2. Operator receives the transaction and passes it to the bootloader
3. Bootloader calls `validateTransaction` on the `from` account
4. If validation returns `ACCOUNT_VALIDATION_SUCCESS_MAGIC`:
   - If no paymaster: bootloader calls `payForTransaction`
   - If paymaster: bootloader calls `prepareForPaymaster` on the account, then `validateAndPayForPaymasterTransaction` on the paymaster
5. Bootloader calls `executeTransaction`
6. If a paymaster was used, `postTransaction` is called on the paymaster

## Key Considerations

- The `customSignature` field in `customData` carries the account's signature (instead of `v`, `r`, `s` fields)
- Transaction type must be `113` (EIP-712) for custom account transactions
- `executeTransactionFromOutside` allows anyone to submit pre-signed transactions for the account (relay pattern)
- Contract deployments from the account must use `SystemContractsCaller` to call the `ContractDeployer`
- The account must have sufficient ETH for gas unless a paymaster is used
- `enableEraVMExtensions: true` in `zksolc` settings is required when using system contract calls
