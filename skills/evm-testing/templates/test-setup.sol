// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @notice Base test contract with common helpers for DeFi testing.
/// Extend this in your test files: `contract MyTest is BaseTest { ... }`
abstract contract BaseTest is Test {
    // -----------------------------------------------------------------------
    // Common addresses
    // -----------------------------------------------------------------------

    address internal deployer;
    address internal alice;
    address internal bob;
    address internal carol;

    // Well-known mainnet addresses (Ethereum)
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

    // -----------------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------------

    function setUp() public virtual {
        deployer = makeAddr("deployer");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        carol = makeAddr("carol");

        vm.label(deployer, "deployer");
        vm.label(alice, "alice");
        vm.label(bob, "bob");
        vm.label(carol, "carol");

        _labelKnownAddresses();
    }

    function _labelKnownAddresses() internal {
        vm.label(WETH, "WETH");
        vm.label(USDC, "USDC");
        vm.label(USDT, "USDT");
        vm.label(DAI, "DAI");
        vm.label(WBTC, "WBTC");
    }

    // -----------------------------------------------------------------------
    // Fork helpers
    // -----------------------------------------------------------------------

    uint256 internal mainnetForkId;
    uint256 internal arbitrumForkId;
    uint256 internal optimismForkId;
    uint256 internal baseForkId;

    function createMainnetFork(uint256 blockNumber) internal {
        mainnetForkId = vm.createSelectFork("mainnet", blockNumber);
        _labelKnownAddresses();
    }

    function createMainnetFork() internal {
        mainnetForkId = vm.createSelectFork("mainnet");
        _labelKnownAddresses();
    }

    function createArbitrumFork(uint256 blockNumber) internal {
        arbitrumForkId = vm.createSelectFork("arbitrum", blockNumber);
    }

    function createOptimismFork(uint256 blockNumber) internal {
        optimismForkId = vm.createSelectFork("optimism", blockNumber);
    }

    function createBaseFork(uint256 blockNumber) internal {
        baseForkId = vm.createSelectFork("base", blockNumber);
    }

    // -----------------------------------------------------------------------
    // Token balance helpers
    // -----------------------------------------------------------------------

    function dealETH(address to, uint256 amount) internal {
        vm.deal(to, amount);
    }

    function dealERC20(address token, address to, uint256 amount) internal {
        deal(token, to, amount);
    }

    /// @notice Deal ERC20 and approve a spender in one call.
    function dealAndApprove(address token, address owner, address spender, uint256 amount) internal {
        deal(token, owner, amount);
        vm.prank(owner);
        IERC20(token).approve(spender, amount);
    }

    // -----------------------------------------------------------------------
    // Assertion helpers
    // -----------------------------------------------------------------------

    /// @notice Assert two values are equal within an absolute tolerance.
    function assertApproxEq(uint256 actual, uint256 expected, uint256 maxDelta, string memory label) internal pure {
        assertApproxEqAbs(actual, expected, maxDelta, label);
    }

    /// @notice Assert a value is within [lower, upper] inclusive.
    function assertBounded(uint256 value, uint256 lower, uint256 upper, string memory label) internal pure {
        assertGe(value, lower, string.concat(label, ": below lower bound"));
        assertLe(value, upper, string.concat(label, ": above upper bound"));
    }

    /// @notice Assert two values are equal within a basis-point tolerance.
    /// @param toleranceBps Tolerance in basis points (1 bps = 0.01%).
    function assertWithinBps(
        uint256 actual,
        uint256 expected,
        uint256 toleranceBps,
        string memory label
    ) internal pure {
        if (expected == 0) {
            assertEq(actual, 0, label);
            return;
        }
        uint256 diff = actual > expected ? actual - expected : expected - actual;
        assertLe(
            diff * 10_000 / expected,
            toleranceBps,
            string.concat(label, ": exceeds bps tolerance")
        );
    }

    // -----------------------------------------------------------------------
    // Event helpers
    // -----------------------------------------------------------------------

    /// @notice Shorthand: expect an event with all topics and data checked from a specific emitter.
    function expectEmitFrom(address emitter) internal {
        vm.expectEmit(true, true, true, true, emitter);
    }

    // -----------------------------------------------------------------------
    // Time helpers
    // -----------------------------------------------------------------------

    function advanceTime(uint256 seconds_) internal {
        vm.warp(block.timestamp + seconds_);
    }

    function advanceBlocks(uint256 blocks) internal {
        vm.roll(block.number + blocks);
    }

    /// @notice Advance both time and blocks proportionally (12s per block).
    function advanceTimeAndBlocks(uint256 seconds_) internal {
        vm.warp(block.timestamp + seconds_);
        vm.roll(block.number + (seconds_ / 12));
    }

    // -----------------------------------------------------------------------
    // Utility
    // -----------------------------------------------------------------------

    /// @notice Create N labeled addresses for use as actors in invariant/fuzz tests.
    function createActors(uint256 count) internal returns (address[] memory actors) {
        actors = new address[](count);
        for (uint256 i; i < count; i++) {
            string memory label = string(abi.encodePacked("actor-", vm.toString(i)));
            actors[i] = makeAddr(label);
            vm.label(actors[i], label);
        }
    }

    /// @notice Compute deterministic address without deploying (for CREATE predictions).
    function predictAddress(address deployer_, uint256 nonce) internal pure returns (address) {
        if (nonce == 0) {
            return address(
                uint160(
                    uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer_, bytes1(0x80))))
                )
            );
        }
        if (nonce <= 0x7f) {
            return address(
                uint160(
                    uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer_, uint8(nonce))))
                )
            );
        }
        revert("predictAddress: nonce > 127 not supported");
    }
}
