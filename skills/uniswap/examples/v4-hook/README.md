# Uniswap V4 Hook Development

Examples for building, deploying, and testing Uniswap V4 hooks. V4 hooks are smart contracts attached to pools at creation time that execute custom logic at specific lifecycle points.

## Project Setup

```bash
# Initialize a new V4 hook project with Foundry
forge init my-v4-hook
cd my-v4-hook

# Install V4 dependencies
forge install uniswap/v4-core
forge install uniswap/v4-periphery

# Add remappings
cat > remappings.txt << 'EOF'
v4-core/=lib/v4-core/
v4-periphery/=lib/v4-periphery/
forge-std/=lib/forge-std/src/
@openzeppelin/=lib/v4-periphery/lib/openzeppelin-contracts/
EOF
```

## Hook Contract Skeleton

Every hook extends `BaseHook` and declares which callbacks it implements via `getHookPermissions`. The hook address must encode these permissions in its leading bytes.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";

contract VolumeTracker is BaseHook {
    using PoolIdLibrary for PoolKey;

    mapping(PoolId => uint256) public totalVolume;

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta,
        bytes calldata
    ) external override returns (bytes4, int128) {
        PoolId poolId = key.toId();
        // Track absolute swap volume
        int256 amount = params.amountSpecified;
        uint256 absAmount = amount > 0 ? uint256(amount) : uint256(-amount);
        totalVolume[poolId] += absAmount;

        return (BaseHook.afterSwap.selector, 0);
    }
}
```

## beforeSwap / afterSwap Hook Pattern

A dynamic fee hook that adjusts fees based on volatility or any custom metric.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";

/// @notice Overrides the pool's LP fee based on custom logic
/// @dev Pool must be created with the DYNAMIC_FEE_FLAG set in the fee field
contract DynamicFeeHook is BaseHook {
    uint24 public baseFee = 3000; // 0.3%
    uint24 public highVolatilityFee = 10000; // 1%
    uint256 public volatilityThreshold;

    constructor(
        IPoolManager _poolManager,
        uint256 _volatilityThreshold
    ) BaseHook(_poolManager) {
        volatilityThreshold = _volatilityThreshold;
    }

    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function beforeSwap(
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // Dynamic fee: return the override fee in the uint24 return value
        // The OVERRIDE_FEE_FLAG tells the PoolManager to use this fee
        uint24 fee = _isHighVolatility() ? highVolatilityFee : baseFee;

        return (
            BaseHook.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            fee | LPFeeLibrary.OVERRIDE_FEE_FLAG
        );
    }

    function _isHighVolatility() internal view returns (bool) {
        // Implement volatility oracle logic here
        // Example: check an external oracle, TWAP deviation, etc.
        return false;
    }
}
```

## Hook Permissions Bitmap

The hook contract address must have specific bits set in its leading bytes that match the declared permissions. V4 validates this at pool initialization.

```solidity
import {Hooks} from "v4-core/libraries/Hooks.sol";

// Flag positions (bit index from the leading address byte):
// BEFORE_INITIALIZE_FLAG  = 1 << 159
// AFTER_INITIALIZE_FLAG   = 1 << 158
// BEFORE_ADD_LIQUIDITY_FLAG = 1 << 157
// AFTER_ADD_LIQUIDITY_FLAG  = 1 << 156
// BEFORE_REMOVE_LIQUIDITY_FLAG = 1 << 155
// AFTER_REMOVE_LIQUIDITY_FLAG  = 1 << 154
// BEFORE_SWAP_FLAG        = 1 << 153
// AFTER_SWAP_FLAG         = 1 << 152
// BEFORE_DONATE_FLAG      = 1 << 151
// AFTER_DONATE_FLAG       = 1 << 150
// BEFORE_SWAP_RETURNS_DELTA_FLAG = 1 << 149
// AFTER_SWAP_RETURNS_DELTA_FLAG  = 1 << 148
// AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG = 1 << 147
// AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG = 1 << 146

// For a hook that uses afterSwap only:
uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG);
```

## Hook Address Mining with CREATE2

```solidity
import {HookMiner} from "v4-periphery/test/utils/HookMiner.sol";

// Mine a CREATE2 salt that produces an address with correct flag bits
(address hookAddress, bytes32 salt) = HookMiner.find(
    CREATE2_DEPLOYER,         // Deployer address (your factory or CREATE2 proxy)
    uint160(Hooks.AFTER_SWAP_FLAG), // Required flag bits
    type(VolumeTracker).creationCode,
    abi.encode(address(poolManager)) // Constructor args
);
```

## Pool Initialization with Hook

```solidity
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

// currency0 must be numerically less than currency1
// address(0) represents native ETH
PoolKey memory key = PoolKey({
    currency0: Currency.wrap(address(0)),
    currency1: Currency.wrap(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48),
    fee: 3000,
    tickSpacing: 60,
    hooks: IHooks(hookAddress) // Your deployed hook
});

// 1:1 starting price
uint160 startingPrice = TickMath.getSqrtPriceAtTick(0);
poolManager.initialize(key, startingPrice);
```

## Testing a Hook with Forge

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {VolumeTracker} from "../src/VolumeTracker.sol";
import {HookMiner} from "v4-periphery/test/utils/HookMiner.sol";

contract VolumeTrackerTest is Test, Deployers {
    using PoolIdLibrary for PoolKey;

    VolumeTracker hook;
    PoolKey poolKey;
    PoolId poolId;

    function setUp() public {
        // Deploy fresh PoolManager
        deployFreshManagerAndRouters();

        // Mine hook address with correct flags
        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG);
        (address hookAddress, bytes32 salt) = HookMiner.find(
            address(this),
            flags,
            type(VolumeTracker).creationCode,
            abi.encode(address(manager))
        );

        // Deploy hook at mined address using CREATE2
        hook = new VolumeTracker{salt: salt}(manager);
        require(address(hook) == hookAddress, "Hook address mismatch");

        // Deploy test tokens and mint
        deployMintAndApprove2Currencies();

        // Create pool with hook
        (poolKey, poolId) = initPool(
            currency0,
            currency1,
            hook,
            3000,  // 0.3% fee
            SQRT_PRICE_1_1 // 1:1 starting price
        );

        // Add liquidity for testing
        modifyLiquidityRouter.modifyLiquidity(
            poolKey,
            IPoolManager.ModifyLiquidityParams({
                tickLower: -60,
                tickUpper: 60,
                liquidityDelta: 10 ether,
                salt: bytes32(0)
            }),
            ZERO_BYTES
        );
    }

    function test_tracksVolume() public {
        // Execute a swap
        bool zeroForOne = true;
        int256 amountSpecified = -1 ether; // exact input
        swap(poolKey, zeroForOne, amountSpecified, ZERO_BYTES);

        // Verify volume was tracked
        uint256 volume = hook.totalVolume(poolId);
        assertGt(volume, 0, "Volume should be tracked");
    }

    function test_multipleSwapsAccumulate() public {
        swap(poolKey, true, -1 ether, ZERO_BYTES);
        uint256 volumeAfterFirst = hook.totalVolume(poolId);

        swap(poolKey, false, -1 ether, ZERO_BYTES);
        uint256 volumeAfterSecond = hook.totalVolume(poolId);

        assertGt(volumeAfterSecond, volumeAfterFirst, "Volume should accumulate");
    }
}
```

## Running Tests

```bash
forge test -vvv --match-contract VolumeTrackerTest
```

## Common V4 Hook Patterns

| Pattern | Hooks Used | Use Case |
|---------|-----------|----------|
| Dynamic fees | `beforeSwap` | Adjust LP fees based on volatility, time, or oracle data |
| TWAMM | `beforeSwap`, `afterSwap` | Time-weighted average market maker for large orders |
| Limit orders | `afterSwap` | Execute limit orders when price crosses a threshold |
| KYC/Access control | `beforeSwap`, `beforeAddLiquidity` | Restrict pool access to verified addresses |
| Oracle | `afterSwap` | Update custom oracle state on every trade |
| Fee distribution | `afterSwap` | Route swap fees to custom recipients |
| MEV protection | `beforeSwap` | Detect and mitigate sandwich attacks |
