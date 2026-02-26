# Flash Loan Examples

Aave V3 flash loan patterns: single-asset, multi-asset, arbitrage, and the `executeOperation` callback.

## Flash Loan Fee

V3 default premium is **0.05%** (5 basis points), down from 0.09% in V2. The exact fee is configurable per market via governance. Read the on-chain value:

```typescript
const poolDataProviderAbi = [
  {
    name: "FLASHLOAN_PREMIUM_TOTAL",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
  },
] as const;

// Ethereum mainnet PoolDataProvider
const POOL_DATA_PROVIDER = "0x7B4EB56E7CD4b454BA8ff71E4518426c9e3634AE" as const;

const premiumBps = await publicClient.readContract({
  address: POOL_DATA_PROVIDER,
  abi: poolDataProviderAbi,
  functionName: "FLASHLOAN_PREMIUM_TOTAL",
});

// premiumBps = 5n means 0.05%
console.log(`Flash loan fee: ${Number(premiumBps) / 100}%`);
```

### Fee Calculation

```typescript
function calculateFlashLoanFee(amount: bigint, premiumBps: bigint): bigint {
  // fee = amount * premium / 10000
  return (amount * premiumBps) / 10000n;
}

const borrowAmount = 1_000_000n * 10n ** 6n; // 1M USDC
const fee = calculateFlashLoanFee(borrowAmount, 5n);
// fee = 500_000000n = 500 USDC (0.05% of 1M)
```

## Simple Flash Loan Receiver (Solidity)

The receiver contract must implement `executeOperation`. Aave transfers the borrowed tokens to this contract, calls `executeOperation`, then pulls back `amount + premium`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPool} from "@aave/aave-v3-core/contracts/interfaces/IPool.sol";
import {IFlashLoanSimpleReceiver} from
    "@aave/aave-v3-core/contracts/flashloan/base/FlashLoanSimpleReceiver.sol";
import {IPoolAddressesProvider} from
    "@aave/aave-v3-core/contracts/interfaces/IPoolAddressesProvider.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleFlashLoan is IFlashLoanSimpleReceiver {
    IPoolAddressesProvider public immutable override ADDRESSES_PROVIDER;
    IPool public immutable override POOL;
    address public immutable owner;

    error OnlyPool();
    error OnlyOwner();
    error OnlySelf();

    constructor(address provider) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(IPoolAddressesProvider(provider).getPool());
        owner = msg.sender;
    }

    /// @notice Called by Aave Pool after funds are transferred to this contract
    /// @dev Must approve Pool to pull (amount + premium) before returning true
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        if (msg.sender != address(POOL)) revert OnlyPool();
        if (initiator != address(this)) revert OnlySelf();

        // --- Your arbitrage / liquidation / collateral swap logic here ---
        // At this point, this contract holds `amount` of `asset`.
        // You must end with at least `amount + premium` of `asset` in this contract.

        uint256 amountOwed = amount + premium;
        IERC20(asset).approve(address(POOL), amountOwed);

        return true;
    }

    /// @notice Trigger a single-asset flash loan
    function requestFlashLoan(address asset, uint256 amount) external {
        if (msg.sender != owner) revert OnlyOwner();
        POOL.flashLoanSimple(address(this), asset, amount, "", 0);
    }
}
```

## Flash Loan with Swap Arbitrage Pattern

A contract that flash borrows a token, swaps on one DEX, swaps back on another, and repays the loan with profit.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPool} from "@aave/aave-v3-core/contracts/interfaces/IPool.sol";
import {IFlashLoanSimpleReceiver} from
    "@aave/aave-v3-core/contracts/flashloan/base/FlashLoanSimpleReceiver.sol";
import {IPoolAddressesProvider} from
    "@aave/aave-v3-core/contracts/interfaces/IPoolAddressesProvider.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISwapRouter {
    function exactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut);
}

contract FlashArbBot is IFlashLoanSimpleReceiver {
    IPoolAddressesProvider public immutable override ADDRESSES_PROVIDER;
    IPool public immutable override POOL;
    address public immutable owner;

    error OnlyPool();
    error OnlyOwner();
    error OnlySelf();
    error NoProfitAfterFees();

    constructor(address provider) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(IPoolAddressesProvider(provider).getPool());
        owner = msg.sender;
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        if (msg.sender != address(POOL)) revert OnlyPool();
        if (initiator != address(this)) revert OnlySelf();

        (address routerA, address routerB, address tokenB, uint24 feeA, uint24 feeB) =
            abi.decode(params, (address, address, address, uint24, uint24));

        // Swap asset -> tokenB on routerA
        IERC20(asset).approve(routerA, amount);
        uint256 amountB = ISwapRouter(routerA).exactInputSingle(
            asset, tokenB, feeA, address(this), amount, 0, 0
        );

        // Swap tokenB -> asset on routerB
        IERC20(tokenB).approve(routerB, amountB);
        uint256 amountBack = ISwapRouter(routerB).exactInputSingle(
            tokenB, asset, feeB, address(this), amountB, 0, 0
        );

        uint256 amountOwed = amount + premium;
        if (amountBack < amountOwed) revert NoProfitAfterFees();

        IERC20(asset).approve(address(POOL), amountOwed);

        // Profit stays in this contract
        return true;
    }

    function executeArb(
        address asset,
        uint256 amount,
        address routerA,
        address routerB,
        address tokenB,
        uint24 feeA,
        uint24 feeB
    ) external {
        if (msg.sender != owner) revert OnlyOwner();
        bytes memory params = abi.encode(routerA, routerB, tokenB, feeA, feeB);
        POOL.flashLoanSimple(address(this), asset, amount, params, 0);
    }

    function withdrawProfit(address token) external {
        if (msg.sender != owner) revert OnlyOwner();
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, balance);
    }
}
```

## Multi-Asset Flash Loan

Use `flashLoan` (not `flashLoanSimple`) to borrow multiple assets in one call. The receiver must implement `IFlashLoanReceiver`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPool} from "@aave/aave-v3-core/contracts/interfaces/IPool.sol";
import {IFlashLoanReceiver} from
    "@aave/aave-v3-core/contracts/flashloan/base/FlashLoanReceiver.sol";
import {IPoolAddressesProvider} from
    "@aave/aave-v3-core/contracts/interfaces/IPoolAddressesProvider.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MultiAssetFlashLoan is IFlashLoanReceiver {
    IPoolAddressesProvider public immutable override ADDRESSES_PROVIDER;
    IPool public immutable override POOL;
    address public immutable owner;

    error OnlyPool();
    error OnlyOwner();
    error OnlySelf();

    constructor(address provider) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(IPoolAddressesProvider(provider).getPool());
        owner = msg.sender;
    }

    /// @notice Callback for multi-asset flash loan
    /// @param assets Array of borrowed token addresses
    /// @param amounts Array of borrowed amounts
    /// @param premiums Array of fees owed per asset
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata /* params */
    ) external override returns (bool) {
        if (msg.sender != address(POOL)) revert OnlyPool();
        if (initiator != address(this)) revert OnlySelf();

        for (uint256 i = 0; i < assets.length; i++) {
            // Custom logic per asset here

            uint256 amountOwed = amounts[i] + premiums[i];
            IERC20(assets[i]).approve(address(POOL), amountOwed);
        }

        return true;
    }

    /// @notice Borrow USDC + DAI in a single flash loan
    function requestMultiFlashLoan(
        address[] calldata assets,
        uint256[] calldata amounts
    ) external {
        if (msg.sender != owner) revert OnlyOwner();

        // modes: 0 = no debt (full repay), 1 = stable, 2 = variable
        uint256[] memory modes = new uint256[](assets.length);
        // All zeros = must fully repay within the same transaction

        POOL.flashLoan(address(this), assets, amounts, modes, address(this), "", 0);
    }
}
```

## Trigger Flash Loan from TypeScript

```typescript
import { createPublicClient, createWalletClient, http, parseUnits, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const USDC: Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const flashLoanContractAbi = [
  {
    name: "requestFlashLoan",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const FLASH_LOAN_CONTRACT: Address = "0x...YOUR_DEPLOYED_CONTRACT...";

async function triggerFlashLoan(asset: Address, amount: bigint) {
  // Simulate first to catch reverts
  await publicClient.simulateContract({
    address: FLASH_LOAN_CONTRACT,
    abi: flashLoanContractAbi,
    functionName: "requestFlashLoan",
    args: [asset, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract({
    address: FLASH_LOAN_CONTRACT,
    abi: flashLoanContractAbi,
    functionName: "requestFlashLoan",
    args: [asset, amount],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Flash loan transaction reverted");
  }

  return receipt;
}

// Flash borrow 1M USDC
await triggerFlashLoan(USDC, parseUnits("1000000", 6));
```
