// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Base security test contract. Extend this for protocol-specific security tests.
/// Provides common setup, helpers, and test patterns for reentrancy, access control,
/// overflow, and flash loan attack testing.
abstract contract SecurityTestSuite is Test {
    // ---------------------------------------------------------------
    // Common addresses -- override in setUp() with actual deployments
    // ---------------------------------------------------------------
    address internal target;
    address internal attacker;
    address internal victim;
    address internal admin;

    // Mainnet token addresses for fork testing
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;

    // Chainlink ETH/USD feed (mainnet)
    address constant CHAINLINK_ETH_USD = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

    // Aave V3 pool (mainnet)
    address constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;

    function setUp() public virtual {
        attacker = makeAddr("attacker");
        victim = makeAddr("victim");
        admin = makeAddr("admin");
    }

    // ---------------------------------------------------------------
    // Fork helpers
    // ---------------------------------------------------------------

    /// @notice Create a mainnet fork at a specific block
    function _forkMainnet(uint256 blockNumber) internal {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"), blockNumber);
    }

    /// @notice Create a mainnet fork at latest block
    function _forkMainnet() internal {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"));
    }

    /// @notice Deal ETH and common tokens to an address
    function _fundAccount(address account, uint256 ethAmount) internal {
        deal(account, ethAmount);
    }

    function _fundAccountWithToken(address token, address account, uint256 amount) internal {
        deal(token, account, amount);
    }

    // ---------------------------------------------------------------
    // Reentrancy test pattern
    // ---------------------------------------------------------------

    /// @notice Test that a function reverts when called reentrantly.
    /// Deploy a ReentrancyTester that calls `targetFunction` in its receive().
    /// If the second call succeeds, the test should fail.
    ///
    /// Usage:
    /// 1. Deploy your contract
    /// 2. Deploy ReentrancyTester (below) pointed at your contract
    /// 3. Fund and trigger the attack
    /// 4. Assert the attack was blocked (balance unchanged, revert caught)

    // ---------------------------------------------------------------
    // Access control test pattern
    // ---------------------------------------------------------------

    /// @notice Verify that a function reverts when called by an unauthorized address
    function _expectUnauthorizedRevert(address caller, address contractAddr, bytes memory callData) internal {
        vm.prank(caller);
        (bool success, ) = contractAddr.call(callData);
        assertFalse(success, "Call should have reverted for unauthorized caller");
    }

    /// @notice Verify that a function succeeds when called by an authorized address
    function _expectAuthorizedSuccess(address caller, address contractAddr, bytes memory callData) internal {
        vm.prank(caller);
        (bool success, ) = contractAddr.call(callData);
        assertTrue(success, "Call should have succeeded for authorized caller");
    }

    // ---------------------------------------------------------------
    // Overflow/underflow test pattern (unchecked blocks)
    // ---------------------------------------------------------------

    /// @notice Fuzz test helper: bound to realistic token amounts
    function _boundTokenAmount(uint256 amount) internal pure returns (uint256) {
        return bound(amount, 1, type(uint128).max);
    }

    /// @notice Fuzz test helper: bound to basis points range
    function _boundBps(uint256 bps) internal pure returns (uint256) {
        return bound(bps, 0, 10_000);
    }

    // ---------------------------------------------------------------
    // Oracle mock helpers
    // ---------------------------------------------------------------

    /// @notice Mock a Chainlink feed response
    function _mockChainlinkPrice(address feed, int256 price, uint256 updatedAt) internal {
        vm.mockCall(
            feed,
            abi.encodeWithSignature("latestRoundData()"),
            abi.encode(uint80(1), price, uint256(0), updatedAt, uint80(1))
        );
    }

    /// @notice Mock a stale Chainlink feed
    function _mockStaleChainlinkFeed(address feed, int256 price, uint256 stalenessSeconds) internal {
        vm.mockCall(
            feed,
            abi.encodeWithSignature("latestRoundData()"),
            abi.encode(uint80(1), price, uint256(0), block.timestamp - stalenessSeconds, uint80(1))
        );
    }

    /// @notice Mock a failed Chainlink feed
    function _mockFailedChainlinkFeed(address feed) internal {
        vm.mockCallRevert(
            feed,
            abi.encodeWithSignature("latestRoundData()"),
            "Feed offline"
        );
    }

    // ---------------------------------------------------------------
    // Flash loan test pattern
    // ---------------------------------------------------------------

    /// @notice Simulate a flash loan by dealing tokens, executing callback, then verifying repayment.
    /// For real flash loan testing, use Aave V3 on a mainnet fork.
    function _simulateFlashLoan(
        address token,
        address receiver,
        uint256 amount,
        bytes memory callbackData
    ) internal {
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        deal(token, receiver, amount);

        (bool ok, ) = receiver.call(callbackData);
        require(ok, "Flash loan callback failed");

        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        assertGe(balanceAfter, balanceBefore, "Flash loan not repaid");
    }
}

// ---------------------------------------------------------------
// Reusable attacker contract for reentrancy testing
// ---------------------------------------------------------------

contract ReentrancyTester {
    address public targetContract;
    bytes public attackCalldata;
    uint256 public reentrancyCount;
    uint256 public maxReentries;

    constructor(address _target, uint256 _maxReentries) {
        targetContract = _target;
        maxReentries = _maxReentries;
    }

    function setAttackCalldata(bytes memory _calldata) external {
        attackCalldata = _calldata;
    }

    receive() external payable {
        if (reentrancyCount < maxReentries) {
            reentrancyCount++;
            (bool ok, ) = targetContract.call(attackCalldata);
            // If this succeeds, the target is vulnerable to reentrancy
            if (!ok) {
                // Reentrancy was blocked -- this is the expected behavior
            }
        }
    }

    fallback() external payable {
        if (reentrancyCount < maxReentries) {
            reentrancyCount++;
            (bool ok, ) = targetContract.call(attackCalldata);
            if (!ok) {}
        }
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
