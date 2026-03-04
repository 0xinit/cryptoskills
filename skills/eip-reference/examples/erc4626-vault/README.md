# ERC-4626 Tokenized Vault — Build and Interact

Yield-bearing vault with OpenZeppelin v5, first-depositor protection, and viem interaction.

## Solidity — Vault Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title SimpleVault
/// @notice ERC-4626 vault accepting a single ERC-20 asset.
/// @dev OpenZeppelin v5 ERC4626 includes virtual shares/assets offset
///      to mitigate first-depositor inflation attacks by default.
contract SimpleVault is ERC4626 {
    using Math for uint256;

    error DepositTooSmall(uint256 deposited, uint256 minimum);

    uint256 public constant MIN_DEPOSIT = 1000; // Minimum first deposit in asset units

    constructor(IERC20 asset_)
        ERC4626(asset_)
        ERC20("Simple Vault Shares", "svSHARE")
    {}

    /// @notice Deposit assets, receive vault shares.
    /// @dev Overrides to enforce minimum deposit on first deposit.
    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        if (totalSupply() == 0 && assets < MIN_DEPOSIT) {
            revert DepositTooSmall(assets, MIN_DEPOSIT);
        }
        return super.deposit(assets, receiver);
    }

    /// @notice View the underlying asset balance held by the vault.
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }
}
```

## Solidity — Vault with Custom Yield Source

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title YieldVault
/// @notice ERC-4626 vault that deploys assets to an external yield source.
contract YieldVault is ERC4626 {
    using SafeERC20 for IERC20;

    address public immutable yieldSource;
    uint256 private _totalDeposited;

    constructor(IERC20 asset_, address yieldSource_)
        ERC4626(asset_)
        ERC20("Yield Vault Shares", "yvSHARE")
    {
        yieldSource = yieldSource_;
    }

    function totalAssets() public view override returns (uint256) {
        // Assets in vault + assets deployed to yield source
        return IERC20(asset()).balanceOf(address(this)) + _deployedAssets();
    }

    function _deployedAssets() internal view returns (uint256) {
        // Query the external yield source for deposited balance
        return IYieldSource(yieldSource).balanceOf(address(this));
    }

    function _afterDeposit(uint256 assets) internal {
        // Deploy received assets to yield source
        IERC20(asset()).forceApprove(yieldSource, assets);
        IYieldSource(yieldSource).deposit(assets);
    }
}

interface IYieldSource {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}
```

## TypeScript — Deposit and Withdraw with viem

```typescript
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { erc20Abi, erc4626Abi } from 'viem';

const VAULT = '0xDeployedVaultAddress...' as const;
const ASSET = '0xUnderlyingAssetAddress...' as const;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.RPC_URL) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(process.env.RPC_URL) });

// Step 1: Approve vault to spend assets
const depositAmount = parseUnits('1000', 18);

await walletClient.writeContract({
  address: ASSET,
  abi: erc20Abi,
  functionName: 'approve',
  args: [VAULT, depositAmount],
});

// Step 2: Deposit assets, receive shares
const depositHash = await walletClient.writeContract({
  address: VAULT,
  abi: erc4626Abi,
  functionName: 'deposit',
  args: [depositAmount, account.address],
});

const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
if (depositReceipt.status !== 'success') throw new Error('Deposit failed');
```

## TypeScript — Preview and Redeem

```typescript
// Preview: how many assets will I get for my shares?
const myShares = await publicClient.readContract({
  address: VAULT,
  abi: erc4626Abi,
  functionName: 'balanceOf',
  args: [account.address],
});

const assetsOut = await publicClient.readContract({
  address: VAULT,
  abi: erc4626Abi,
  functionName: 'previewRedeem',
  args: [myShares],
});
console.log('Shares:', formatUnits(myShares, 18));
console.log('Assets on redeem:', formatUnits(assetsOut, 18));

// Redeem all shares for assets
const redeemHash = await walletClient.writeContract({
  address: VAULT,
  abi: erc4626Abi,
  functionName: 'redeem',
  args: [myShares, account.address, account.address],
});

const redeemReceipt = await publicClient.waitForTransactionReceipt({ hash: redeemHash });
if (redeemReceipt.status !== 'success') throw new Error('Redeem failed');
```

## TypeScript — Check Exchange Rate

```typescript
const oneShare = parseUnits('1', 18);
const assetsPerShare = await publicClient.readContract({
  address: VAULT,
  abi: erc4626Abi,
  functionName: 'convertToAssets',
  args: [oneShare],
});
console.log('1 share =', formatUnits(assetsPerShare, 18), 'assets');

const oneAsset = parseUnits('1', 18);
const sharesPerAsset = await publicClient.readContract({
  address: VAULT,
  abi: erc4626Abi,
  functionName: 'convertToShares',
  args: [oneAsset],
});
console.log('1 asset =', formatUnits(sharesPerAsset, 18), 'shares');
```

## Key Points

- **Rounding**: `convertToShares` rounds DOWN (depositor gets fewer shares). `previewMint` and `previewWithdraw` round UP (caller pays more). This protects the vault.
- **First-depositor attack**: OpenZeppelin v5 includes a virtual offset (`_decimalsOffset()`) by default. This makes the attack economically infeasible.
- **deposit vs mint**: `deposit(assets, receiver)` specifies assets in, returns shares received. `mint(shares, receiver)` specifies shares wanted, returns assets spent. Same for `withdraw` vs `redeem`.
- **preview vs convert**: `preview*` returns exact amounts for the corresponding operation. `convert*` returns a theoretical rate without accounting for fees or limits.
- The vault itself is an ERC-20 token — shares can be transferred, approved, and used in other DeFi protocols.

Last verified: March 2026
