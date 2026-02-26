# Fork Testing

Test against live mainnet state. Foundry forks a chain at a specific block, giving you read/write access to all deployed contracts.

## Setup

Configure RPC endpoints in `foundry.toml`:

```toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
sepolia = "${SEPOLIA_RPC_URL}"
arbitrum = "${ARBITRUM_RPC_URL}"
```

## Basic Fork Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
}

contract ForkTest is Test {
    // Well-known Ethereum mainnet addresses
    IERC20 constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 constant WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    address constant USDC_WHALE = 0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503;

    address alice = makeAddr("alice");

    function setUp() public {
        // Fork mainnet using the named endpoint from foundry.toml
        vm.createSelectFork("mainnet");
    }

    function testReadMainnetState() public view {
        uint8 decimals = USDC.decimals();
        assertEq(decimals, 6);

        uint256 totalSupply = USDC.totalSupply();
        assertGt(totalSupply, 0, "USDC should have non-zero supply");
    }
}
```

Run:

```bash
forge test --match-contract ForkTest -vvv
```

## Fork at a Specific Block

Pin the block number for deterministic, reproducible tests. Without it, tests can break when on-chain state changes.

```solidity
function setUp() public {
    // Pin to block 19000000 for deterministic state
    vm.createSelectFork("mainnet", 19_000_000);
}

function testWhaleBalanceAtBlock() public view {
    uint256 balance = USDC.balanceOf(USDC_WHALE);
    // Balance is fixed at this block — test is deterministic
    assertGt(balance, 1_000_000e6, "Whale should hold >1M USDC at block 19M");
}
```

## Impersonating Accounts with vm.prank

```solidity
function testImpersonateWhale() public {
    uint256 transferAmount = 10_000e6; // 10k USDC

    uint256 whaleBefore = USDC.balanceOf(USDC_WHALE);
    uint256 aliceBefore = USDC.balanceOf(alice);

    // Impersonate the whale for the next call
    vm.prank(USDC_WHALE);
    USDC.transfer(alice, transferAmount);

    assertEq(USDC.balanceOf(alice), aliceBefore + transferAmount);
    assertEq(USDC.balanceOf(USDC_WHALE), whaleBefore - transferAmount);
}

function testImpersonateMultipleCalls() public {
    // startPrank persists until stopPrank
    vm.startPrank(USDC_WHALE);
    USDC.transfer(alice, 5_000e6);
    USDC.approve(alice, 10_000e6);
    vm.stopPrank();
}
```

## Deal Tokens to Test Addresses

```solidity
function testDealERC20() public {
    // deal() from forge-std sets any ERC20 balance directly
    // Works by writing to the token's storage slot
    deal(address(USDC), alice, 1_000_000e6);
    assertEq(USDC.balanceOf(alice), 1_000_000e6);

    // Deal ETH
    vm.deal(alice, 100 ether);
    assertEq(alice.balance, 100 ether);
}

function testDealPreserveTotalSupply() public {
    // By default, deal() does NOT update totalSupply.
    // Pass true as 4th arg to adjust totalSupply.
    uint256 supplyBefore = USDC.totalSupply();
    deal(address(USDC), alice, 1_000_000e6, true);
    assertEq(USDC.totalSupply(), supplyBefore + 1_000_000e6);
}
```

## Testing Against Deployed Contracts

```solidity
interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

function testSwapOnUniswapV2() public {
    IUniswapV2Router router = IUniswapV2Router(
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D // Uniswap V2 Router
    );

    uint256 amountIn = 1 ether;
    vm.deal(alice, amountIn);

    // Wrap ETH to WETH first (deposit to WETH contract)
    vm.prank(alice);
    (bool success,) = address(WETH).call{value: amountIn}("");
    assertTrue(success);

    // Approve router
    vm.prank(alice);
    WETH.approve(address(router), amountIn);

    // Swap WETH -> USDC
    address[] memory path = new address[](2);
    path[0] = address(WETH);
    path[1] = address(USDC);

    vm.prank(alice);
    uint256[] memory amounts = router.swapExactTokensForTokens(
        amountIn,
        0, // amountOutMin — 0 for testing, never 0 in production
        path,
        alice,
        block.timestamp + 1
    );

    assertGt(amounts[1], 0, "Should receive USDC");
    assertGt(USDC.balanceOf(alice), 0);
}
```

## Rolling Blocks and Warping Time

```solidity
function testTimeDependentLogic() public {
    // Warp to a specific timestamp
    vm.warp(block.timestamp + 7 days);

    // Roll to a specific block number
    vm.roll(block.number + 50400); // ~7 days of blocks at 12s/block

    // Use skip/rewind for relative changes
    skip(1 hours);
    rewind(30 minutes);
}

function testTimelockAfterFork() public {
    // Scenario: test a timelock that unlocks after 48 hours
    address timelock = 0x1234567890AbcdEF1234567890aBcdef12345678; // example

    // Fast-forward past the timelock delay
    vm.warp(block.timestamp + 48 hours + 1);
    vm.roll(block.number + 14400);

    // Now execute the timelocked action
    // vm.prank(timelockAdmin);
    // timelock.execute(proposalId);
}
```

## Multi-Fork Testing

Test cross-chain interactions by creating multiple forks:

```solidity
function testMultiFork() public {
    // Create two forks
    uint256 mainnetFork = vm.createFork("mainnet");
    uint256 arbitrumFork = vm.createFork("arbitrum");

    // Start on mainnet
    vm.selectFork(mainnetFork);
    assertEq(USDC.decimals(), 6);

    // Switch to Arbitrum
    vm.selectFork(arbitrumFork);
    IERC20 arbUSDC = IERC20(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
    assertEq(arbUSDC.decimals(), 6);

    // Switch back to mainnet
    vm.selectFork(mainnetFork);
    assertGt(USDC.totalSupply(), 0);
}

function testActiveFork() public {
    uint256 mainnetFork = vm.createFork("mainnet");
    vm.selectFork(mainnetFork);

    // Verify which fork is active
    assertEq(vm.activeFork(), mainnetFork);
}
```

## Persistent Storage Across Forks

```solidity
function testPersistentState() public {
    uint256 mainnetFork = vm.createFork("mainnet");
    uint256 arbitrumFork = vm.createFork("arbitrum");

    // Deploy a contract on mainnet fork
    vm.selectFork(mainnetFork);
    address myContract = address(new MyContract());

    // Mark as persistent — survives fork switches
    vm.makePersistent(myContract);

    // Contract is accessible on Arbitrum fork too
    vm.selectFork(arbitrumFork);
    assertTrue(myContract.code.length > 0);
}
```

## Performance Tips

1. **Pin block numbers** to enable Foundry's fork cache (`~/.foundry/cache/rpc/`)
2. **Use a dedicated RPC** (Alchemy, Infura, QuickNode) to avoid rate limits
3. **Separate fork tests** from unit tests so CI can run them in parallel:
   ```bash
   forge test --no-match-test testFork   # unit tests only
   forge test --match-test testFork      # fork tests only
   ```
4. **Minimize fork test count** — each fork test is an RPC-heavy operation

## References

- [Foundry Book — Fork Testing](https://book.getfoundry.sh/forge/fork-testing)
- [Foundry Book — Forking Cheatcodes](https://book.getfoundry.sh/cheatcodes/forking)
