# Integrate RedStone Pull Oracle

End-to-end integration of the RedStone Pull model: smart contract inherits `RedstoneConsumerNumericBase`, frontend wraps transactions with `WrapperBuilder`.

## Smart Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {RedstoneConsumerNumericBase} from "@redstone-finance/evm-connector/contracts/data-services/RedstoneConsumerNumericBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title RedStone Pull Oracle Vault
/// @notice Deposits and withdrawals priced using RedStone Pull model
/// @dev All price reads happen from calldata, not on-chain storage
contract PullOracleVault is RedstoneConsumerNumericBase {
    IERC20 public immutable depositToken;
    bytes32 public immutable tokenFeedId;

    mapping(address => uint256) public deposits;
    uint256 public totalDeposits;

    event Deposited(address indexed user, uint256 amount, uint256 priceAtDeposit);
    event Withdrawn(address indexed user, uint256 amount, uint256 priceAtWithdrawal);

    error InvalidPrice();
    error InsufficientBalance();
    error TransferFailed();

    constructor(address _depositToken, bytes32 _tokenFeedId) {
        depositToken = IERC20(_depositToken);
        tokenFeedId = _tokenFeedId;
    }

    /// @notice 3 unique signers required for production safety
    function getUniqueSignersThreshold() public pure override returns (uint8) {
        return 3;
    }

    /// @notice Deposit tokens -- frontend must attach RedStone price data
    /// @param amount Token amount to deposit (in token decimals)
    function deposit(uint256 amount) external {
        // Price extracted from calldata (8 decimals)
        uint256 price = getOracleNumericValueFromTxMsg(tokenFeedId);
        if (price == 0) revert InvalidPrice();

        deposits[msg.sender] += amount;
        totalDeposits += amount;

        emit Deposited(msg.sender, amount, price);

        bool success = depositToken.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
    }

    /// @notice Withdraw tokens -- frontend must attach RedStone price data
    /// @param amount Token amount to withdraw (in token decimals)
    function withdraw(uint256 amount) external {
        if (deposits[msg.sender] < amount) revert InsufficientBalance();

        uint256 price = getOracleNumericValueFromTxMsg(tokenFeedId);
        if (price == 0) revert InvalidPrice();

        deposits[msg.sender] -= amount;
        totalDeposits -= amount;

        emit Withdrawn(msg.sender, amount, price);

        bool success = depositToken.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
    }

    /// @notice Read multiple prices from a single transaction
    /// @param feedIds Array of data feed identifiers
    /// @return prices Array of prices (8 decimals each)
    function getMultiplePrices(bytes32[] calldata feedIds)
        external
        view
        returns (uint256[] memory prices)
    {
        prices = getOracleNumericValuesFromTxMsg(feedIds);
    }
}
```

## Frontend Integration

```typescript
import { WrapperBuilder } from "@redstone-finance/evm-connector";
import { ethers } from "ethers";

const VAULT_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function deposits(address) view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
];

const VAULT_ADDRESS = "0xYourVaultAddress";

async function depositWithPriceData(amount: bigint) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

  // WrapperBuilder fetches signed price data from RedStone DDN
  // and appends it to every transaction's calldata
  const wrappedVault = WrapperBuilder.wrap(vault).usingDataService({
    dataServiceId: "redstone-primary-prod",
    uniqueSignersCount: 3,
    dataPackagesIds: ["ETH"],
  });

  const tx = await wrappedVault.deposit(amount);
  const receipt = await tx.wait();

  if (receipt.status !== 1) {
    throw new Error(`Deposit reverted: ${tx.hash}`);
  }

  console.log(`Deposited ${amount} tokens, tx: ${tx.hash}`);
  return tx.hash;
}

async function withdrawWithPriceData(amount: bigint) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

  const wrappedVault = WrapperBuilder.wrap(vault).usingDataService({
    dataServiceId: "redstone-primary-prod",
    uniqueSignersCount: 3,
    dataPackagesIds: ["ETH"],
  });

  const tx = await wrappedVault.withdraw(amount);
  const receipt = await tx.wait();

  if (receipt.status !== 1) {
    throw new Error(`Withdrawal reverted: ${tx.hash}`);
  }

  console.log(`Withdrew ${amount} tokens, tx: ${tx.hash}`);
  return tx.hash;
}
```

## Foundry Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PullOracleVault} from "../src/PullOracleVault.sol";

/// @dev Testing RedStone Pull contracts requires mocking calldata.
/// In Foundry, use vm.mockCalldata or the RedStone mock helpers.
/// For unit tests, override getOracleNumericValueFromTxMsg in a harness.
contract PullOracleVaultHarness is PullOracleVault {
    uint256 private _mockPrice;

    constructor(address _token, bytes32 _feedId) PullOracleVault(_token, _feedId) {}

    function setMockPrice(uint256 price) external {
        _mockPrice = price;
    }

    function getOracleNumericValueFromTxMsg(bytes32)
        internal
        view
        override
        returns (uint256)
    {
        return _mockPrice;
    }

    function getOracleNumericValuesFromTxMsg(bytes32[] memory feedIds)
        internal
        view
        override
        returns (uint256[] memory values)
    {
        values = new uint256[](feedIds.length);
        for (uint256 i; i < feedIds.length; ++i) {
            values[i] = _mockPrice;
        }
    }
}
```

## Key Points

- The contract has no price storage -- prices exist only in calldata during the transaction
- `WrapperBuilder.wrap()` is mandatory on the frontend for every price-reading transaction
- `getUniqueSignersThreshold()` of 3 means 3 independent data providers must agree on the price
- `getOracleNumericValueFromTxMsg` returns `uint256` with 8 decimals
- For Foundry tests, create a harness contract that overrides the oracle read function
- `dataServiceId: "redstone-primary-prod"` is the production data service with the most feeds
