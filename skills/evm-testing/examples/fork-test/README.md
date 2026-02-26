# Fork Testing Against Live Networks

Fork tests pull real mainnet (or testnet) state into your local test environment. You can interact with deployed Uniswap pools, Aave lending markets, whale wallets, and any on-chain contract as if you were on mainnet.

## Creating a Fork

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract ForkTest is Test {
    // Pin block number to prevent flaky tests from state changes
    uint256 constant FORK_BLOCK = 19_500_000;

    function setUp() public {
        // Reads ETH_RPC_URL from environment, forks at specific block
        vm.createSelectFork("mainnet", FORK_BLOCK);
    }
}
```

`vm.createSelectFork` creates a fork AND selects it. `vm.createFork` only creates it (you must `vm.selectFork` separately). Always pin a block number -- without it, tests break whenever on-chain state changes.

## Fork at Specific Block Number

```solidity
function setUp() public {
    // Option 1: RPC alias from foundry.toml
    vm.createSelectFork("mainnet", 19_500_000);

    // Option 2: Direct URL (avoid committing API keys)
    vm.createSelectFork(vm.envString("ETH_RPC_URL"), 19_500_000);
}
```

Configure RPC aliases in `foundry.toml`:

```toml
[rpc_endpoints]
mainnet = "${ETH_RPC_URL}"
arbitrum = "${ARBITRUM_RPC_URL}"
optimism = "${OPTIMISM_RPC_URL}"
base = "${BASE_RPC_URL}"
```

## Impersonating Whale Accounts

`vm.prank` lets you execute the next call as any address, including whales holding large token balances.

```solidity
address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
address constant USDC_WHALE = 0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503;

function test_transferFromWhale() public {
    address recipient = makeAddr("recipient");

    vm.prank(USDC_WHALE);
    IERC20(USDC).transfer(recipient, 1_000_000e6);

    assertEq(IERC20(USDC).balanceOf(recipient), 1_000_000e6);
}
```

## Setting Token Balances with `deal()`

`deal` writes directly to a token's balance storage slot. Works for standard ERC20s. For rebasing tokens, fee-on-transfer tokens, or tokens with non-standard storage, impersonate a whale instead.

```solidity
function test_dealTokenBalance() public {
    address user = makeAddr("user");

    // deal for ETH
    vm.deal(user, 100 ether);
    assertEq(user.balance, 100 ether);

    // deal for ERC20 (stdcheats helper)
    deal(USDC, user, 1_000_000e6);
    assertEq(IERC20(USDC).balanceOf(user), 1_000_000e6);

    // deal with totalSupply update
    deal(USDC, user, 1_000_000e6, true);
}
```

## Testing Against Deployed Uniswap

```solidity
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

address constant SWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

function test_swapOnUniswap() public {
    address trader = makeAddr("trader");
    deal(USDC, trader, 10_000e6);

    vm.startPrank(trader);
    IERC20(USDC).approve(SWAP_ROUTER, 10_000e6);

    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
        tokenIn: USDC,
        tokenOut: WETH,
        fee: 3000,
        recipient: trader,
        deadline: block.timestamp,
        amountIn: 10_000e6,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
    });

    uint256 amountOut = ISwapRouter(SWAP_ROUTER).exactInputSingle(params);
    vm.stopPrank();

    assertGt(amountOut, 0, "should receive WETH");
    assertGt(IERC20(WETH).balanceOf(trader), 0);
}
```

## Testing Against Deployed Aave

```solidity
import {IPool} from "@aave/v3-core/contracts/interfaces/IPool.sol";

address constant AAVE_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

function test_supplyToAave() public {
    address supplier = makeAddr("supplier");
    deal(WETH, supplier, 10 ether);

    vm.startPrank(supplier);
    IERC20(WETH).approve(AAVE_POOL, 10 ether);
    IPool(AAVE_POOL).supply(WETH, 10 ether, supplier, 0);
    vm.stopPrank();

    // aWETH address from Aave pool
    address aWETH = IPool(AAVE_POOL).getReserveData(WETH).aTokenAddress;
    assertGe(IERC20(aWETH).balanceOf(supplier), 10 ether);
}
```

## Multi-Fork Testing (L1 + L2)

Test cross-chain state by creating multiple forks and switching between them.

```solidity
function test_crossChainBalances() public {
    uint256 mainnetFork = vm.createFork("mainnet", 19_500_000);
    uint256 arbitrumFork = vm.createFork("arbitrum", 200_000_000);

    // Query mainnet state
    vm.selectFork(mainnetFork);
    address USDC_MAINNET = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    uint256 mainnetSupply = IERC20(USDC_MAINNET).totalSupply();

    // Query Arbitrum state
    vm.selectFork(arbitrumFork);
    address USDC_ARBITRUM = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    uint256 arbSupply = IERC20(USDC_ARBITRUM).totalSupply();

    assertGt(mainnetSupply, arbSupply, "mainnet USDC supply should exceed Arbitrum");

    // Verify which fork is active
    assertEq(vm.activeFork(), arbitrumFork);
}
```

## Block and Time Manipulation

```solidity
function test_timeDependent() public {
    uint256 startTimestamp = block.timestamp;
    uint256 startBlock = block.number;

    // Advance block.timestamp by 1 day
    vm.warp(block.timestamp + 1 days);
    assertEq(block.timestamp, startTimestamp + 1 days);

    // Advance block.number by 7200 blocks (~1 day at 12s blocks)
    vm.roll(block.number + 7200);
    assertEq(block.number, startBlock + 7200);

    // Set base fee
    vm.fee(25 gwei);
    assertEq(block.basefee, 25 gwei);

    // Change chain ID (useful for testing chain-specific logic)
    vm.chainId(42161);
    assertEq(block.chainid, 42161);
}
```

## Forking Configuration

```toml
# foundry.toml

[rpc_endpoints]
mainnet = "${ETH_RPC_URL}"
arbitrum = "${ARBITRUM_RPC_URL}"
optimism = "${OPTIMISM_RPC_URL}"
base = "${BASE_RPC_URL}"

# Cache RPC responses to speed up repeated runs
[rpc_storage_caching]
chains = "all"
endpoints = "all"
```

```bash
# Run only fork tests
forge test --match-contract ForkTest --fork-url $ETH_RPC_URL --fork-block-number 19500000

# Run with RPC caching (default directory: ~/.foundry/cache/rpc)
forge test --match-contract ForkTest
```

## References

- [Foundry Book - Fork Testing](https://book.getfoundry.sh/forge/fork-testing)
- [Foundry Book - Forking Cheatcodes](https://book.getfoundry.sh/cheatcodes/forking)
