# Paymaster Implementation on zkSync Era

Paymasters are contracts that can sponsor gas for users. zkSync supports two built-in flows: **General** (paymaster pays all gas) and **Approval-Based** (user pays in ERC-20, paymaster converts to ETH).

## General Flow Paymaster

Sponsors all gas costs. Useful for onboarding, promotional transactions, or whitelisted users.

### Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@matterlabs/zk-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import "@matterlabs/zk-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import "@matterlabs/zk-contracts/l2/system-contracts/Constants.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GeneralPaymaster is IPaymaster, Ownable {
    // Restrict usage to specific contract calls
    mapping(address => bool) public allowedTargets;

    event TargetAllowed(address indexed target, bool allowed);
    event GasSponsored(address indexed user, uint256 gasUsed);

    constructor() Ownable(msg.sender) {}

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader");
        _;
    }

    function setAllowedTarget(address target, bool allowed) external onlyOwner {
        allowedTargets[target] = allowed;
        emit TargetAllowed(target, allowed);
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        onlyBootloader
        returns (bytes4 magic, bytes memory context)
    {
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;

        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);
        require(
            paymasterInputSelector == IPaymasterFlow.general.selector,
            "Unsupported flow"
        );

        // Only sponsor transactions to allowed targets
        address target = address(uint160(_transaction.to));
        require(allowedTargets[target], "Target not allowed");

        uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{value: requiredETH}("");
        require(success, "Bootloader payment failed");

        context = abi.encode(_transaction.from);
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata,
        bytes32,
        bytes32,
        ExecutionResult,
        uint256 _maxRefundedGas
    ) external payable onlyBootloader {
        address user = abi.decode(_context, (address));
        emit GasSponsored(user, _maxRefundedGas);
    }

    // Fund the paymaster with ETH to cover gas
    receive() external payable {}

    function withdraw(address payable to) external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = to.call{value: balance}("");
        require(success, "Withdraw failed");
    }
}
```

## Approval-Based Paymaster

Users pay gas fees in an ERC-20 token. The paymaster swaps/holds the token and pays the bootloader in ETH.

### Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@matterlabs/zk-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import "@matterlabs/zk-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import "@matterlabs/zk-contracts/l2/system-contracts/Constants.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ApprovalPaymaster is IPaymaster, Ownable {
    address public immutable allowedToken;

    // 1 ETH = how many tokens (simplified fixed-rate oracle)
    // In production, use Chainlink or another oracle
    uint256 public tokenPricePerETH;

    event GasPaidInToken(address indexed user, uint256 tokenAmount, uint256 ethAmount);

    constructor(address _token, uint256 _tokenPricePerETH) Ownable(msg.sender) {
        allowedToken = _token;
        tokenPricePerETH = _tokenPricePerETH;
    }

    modifier onlyBootloader() {
        require(msg.sender == BOOTLOADER_FORMAL_ADDRESS, "Only bootloader");
        _;
    }

    function setTokenPrice(uint256 _newPrice) external onlyOwner {
        tokenPricePerETH = _newPrice;
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        onlyBootloader
        returns (bytes4 magic, bytes memory context)
    {
        require(
            _transaction.paymasterInput.length >= 68,
            "Invalid paymaster input"
        );

        bytes4 selector = bytes4(_transaction.paymasterInput[0:4]);
        require(
            selector == IPaymasterFlow.approvalBased.selector,
            "Must use approval flow"
        );

        (address token, uint256 amount, ) = abi.decode(
            _transaction.paymasterInput[4:],
            (address, uint256, bytes)
        );
        require(token == allowedToken, "Wrong token");

        uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;

        // Calculate required token amount based on exchange rate
        uint256 requiredTokens = (requiredETH * tokenPricePerETH) / 1 ether;
        require(amount >= requiredTokens, "Insufficient token allowance");

        address userAddress = address(uint160(_transaction.from));

        // Pull tokens from user
        IERC20(token).transferFrom(userAddress, address(this), requiredTokens);

        // Pay bootloader in ETH
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{value: requiredETH}("");
        require(success, "Bootloader payment failed");

        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        context = abi.encode(userAddress, requiredTokens, requiredETH);
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata,
        bytes32,
        bytes32,
        ExecutionResult,
        uint256
    ) external payable onlyBootloader {
        (address user, uint256 tokenAmount, uint256 ethAmount) = abi.decode(
            _context,
            (address, uint256, uint256)
        );
        emit GasPaidInToken(user, tokenAmount, ethAmount);
    }

    receive() external payable {}

    function withdraw(address payable to) external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = to.call{value: balance}("");
        require(success, "Withdraw failed");
    }

    function withdrawTokens(address to) external onlyOwner {
        uint256 balance = IERC20(allowedToken).balanceOf(address(this));
        IERC20(allowedToken).transfer(to, balance);
    }
}
```

## Frontend Integration

### Sending Transactions with General Paymaster

```typescript
import { Provider, Wallet, utils } from "zksync-ethers";
import { ethers } from "ethers";

const provider = new Provider("https://sepolia.era.zksync.dev");
const wallet = new Wallet(process.env.PRIVATE_KEY!, provider);

const PAYMASTER_ADDRESS = "0xYourPaymasterAddress";

async function sendSponsoredTransaction(
  contractAddress: string,
  abi: ethers.InterfaceAbi,
  functionName: string,
  args: unknown[]
) {
  const contract = new ethers.Contract(contractAddress, abi, wallet);

  const paymasterParams = utils.getPaymasterParams(PAYMASTER_ADDRESS, {
    type: "General",
    innerInput: new Uint8Array(),
  });

  const tx = await contract[functionName](...args, {
    customData: {
      paymasterParams,
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  });

  const receipt = await tx.wait();
  console.log(`Sponsored tx: ${receipt.hash}`);
  return receipt;
}
```

### Sending Transactions with Approval-Based Paymaster

```typescript
import { Provider, Wallet, utils } from "zksync-ethers";
import { ethers } from "ethers";

const provider = new Provider("https://sepolia.era.zksync.dev");
const wallet = new Wallet(process.env.PRIVATE_KEY!, provider);

const PAYMASTER_ADDRESS = "0xYourPaymasterAddress";
const TOKEN_ADDRESS = "0xYourERC20Token";

async function sendERC20GasTransaction(
  contractAddress: string,
  abi: ethers.InterfaceAbi,
  functionName: string,
  args: unknown[]
) {
  const paymasterParams = utils.getPaymasterParams(PAYMASTER_ADDRESS, {
    type: "ApprovalBased",
    token: TOKEN_ADDRESS,
    minimalAllowance: ethers.parseEther("1"), // max tokens to spend
    innerInput: new Uint8Array(),
  });

  const contract = new ethers.Contract(contractAddress, abi, wallet);

  const tx = await contract[functionName](...args, {
    customData: {
      paymasterParams,
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  });

  const receipt = await tx.wait();
  console.log(`ERC20-gas tx: ${receipt.hash}`);
  return receipt;
}
```

## Testing Paymasters Locally

```typescript
import { Deployer } from "@matterlabs/hardhat-zksync";
import { Wallet, Provider, utils } from "zksync-ethers";
import hre from "hardhat";
import { expect } from "chai";

describe("GeneralPaymaster", function () {
  it("should sponsor gas for allowed targets", async function () {
    const provider = new Provider(hre.network.config.url);
    const wallet = new Wallet(
      "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110",
      provider
    );

    const deployer = new Deployer(hre, wallet);

    // Deploy target contract
    const greeterArtifact = await deployer.loadArtifact("Greeter");
    const greeter = await deployer.deploy(greeterArtifact, ["Hello"]);
    const greeterAddress = await greeter.getAddress();

    // Deploy paymaster
    const paymasterArtifact = await deployer.loadArtifact("GeneralPaymaster");
    const paymaster = await deployer.deploy(paymasterArtifact, []);
    const paymasterAddress = await paymaster.getAddress();

    // Fund paymaster with ETH
    await wallet.sendTransaction({
      to: paymasterAddress,
      value: hre.ethers.parseEther("0.1"),
    });

    // Allow target
    await paymaster.setAllowedTarget(greeterAddress, true);

    // Send sponsored transaction
    const paymasterParams = utils.getPaymasterParams(paymasterAddress, {
      type: "General",
      innerInput: new Uint8Array(),
    });

    await greeter.setGreeting("Sponsored!", {
      customData: {
        paymasterParams,
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      },
    });

    expect(await greeter.greeting()).to.equal("Sponsored!");
  });
});
```

## Paymaster Validation Rules

1. `validateAndPayForPaymasterTransaction` must return `PAYMASTER_VALIDATION_SUCCESS_MAGIC` to approve
2. The paymaster must transfer enough ETH to the bootloader (`BOOTLOADER_FORMAL_ADDRESS`) to cover gas
3. `postTransaction` is called after execution regardless of success/failure — use it for cleanup or logging
4. The paymaster must have sufficient ETH balance to cover the `gasLimit * maxFeePerGas`
5. If validation reverts or returns wrong magic, the transaction is rejected before execution
