# RedStone X Frontrunning Protection Setup

End-to-end setup for RedStone X: two-phase commit model that prevents oracle frontrunning. Users submit intents in phase 1, keepers execute with post-intent price data in phase 2.

## RedStone X Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {RedstoneConsumerNumericBase} from "@redstone-finance/evm-connector/contracts/data-services/RedstoneConsumerNumericBase.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title RedStone X Limit Order Book
/// @notice Demonstrates RedStone X two-phase execution for frontrunning-protected limit orders
contract RedStoneXLimitOrder is RedstoneConsumerNumericBase {
    struct Order {
        address maker;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minPrice;
        bytes32 priceFeedId;
        uint256 submittedBlock;
        uint256 submittedTimestamp;
        uint256 expiryTimestamp;
        bool executed;
        bool cancelled;
    }

    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId;

    // Minimum 1 block delay between submission and execution
    uint256 public constant MIN_EXECUTION_DELAY_BLOCKS = 1;
    // Orders expire after 1 hour
    uint256 public constant DEFAULT_ORDER_TTL = 3600;

    event OrderSubmitted(
        uint256 indexed orderId,
        address indexed maker,
        uint256 amountIn,
        uint256 minPrice
    );
    event OrderExecuted(
        uint256 indexed orderId,
        uint256 executionPrice,
        uint256 amountOut
    );
    event OrderCancelled(uint256 indexed orderId);

    error OrderNotFound();
    error OrderAlreadyExecuted();
    error OrderAlreadyCancelled();
    error OrderExpired();
    error ExecutionTooEarly();
    error PriceBelowMinimum(uint256 actual, uint256 minimum);
    error Unauthorized();
    error InvalidPrice();
    error TransferFailed();

    function getUniqueSignersThreshold() public pure override returns (uint8) {
        return 3;
    }

    // =========================================================================
    // Phase 1: Submit Intent
    // =========================================================================

    /// @notice Submit a limit order intent (Phase 1)
    /// @dev No price data needed at submission -- price is checked at execution
    /// @param tokenIn Address of the token being sold
    /// @param tokenOut Address of the token being bought
    /// @param amountIn Amount of tokenIn to sell
    /// @param minPrice Minimum acceptable price (8 decimals)
    /// @param priceFeedId RedStone feed ID for the price pair
    /// @return orderId Unique order identifier
    function submitOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minPrice,
        bytes32 priceFeedId
    ) external returns (uint256 orderId) {
        orderId = nextOrderId++;

        orders[orderId] = Order({
            maker: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minPrice: minPrice,
            priceFeedId: priceFeedId,
            submittedBlock: block.number,
            submittedTimestamp: block.timestamp,
            expiryTimestamp: block.timestamp + DEFAULT_ORDER_TTL,
            executed: false,
            cancelled: false
        });

        emit OrderSubmitted(orderId, msg.sender, amountIn, minPrice);

        // Transfer tokens to escrow at submission time
        bool success = IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        if (!success) revert TransferFailed();
    }

    // =========================================================================
    // Phase 2: Execute with Delayed Price
    // =========================================================================

    /// @notice Execute a limit order with post-submission price data (Phase 2)
    /// @dev Keeper calls this with RedStone calldata attached
    /// @dev Price data must be timestamped AFTER the order's submittedTimestamp
    /// @param orderId The order to execute
    function executeOrder(uint256 orderId) external {
        Order storage order = orders[orderId];

        if (order.maker == address(0)) revert OrderNotFound();
        if (order.executed) revert OrderAlreadyExecuted();
        if (order.cancelled) revert OrderAlreadyCancelled();
        if (block.timestamp > order.expiryTimestamp) revert OrderExpired();
        if (block.number <= order.submittedBlock + MIN_EXECUTION_DELAY_BLOCKS) {
            revert ExecutionTooEarly();
        }

        // Price from calldata -- must be from AFTER the order was submitted
        // RedStone X guarantee: user could not have known this price when submitting
        uint256 price = getOracleNumericValueFromTxMsg(order.priceFeedId);
        if (price == 0) revert InvalidPrice();
        if (price < order.minPrice) revert PriceBelowMinimum(price, order.minPrice);

        // Calculate output amount: amountIn * price / 10^8 (price has 8 decimals)
        uint256 amountOut = (order.amountIn * price) / 1e8;

        order.executed = true;

        emit OrderExecuted(orderId, price, amountOut);

        // Transfer output tokens to maker
        bool success = IERC20(order.tokenOut).transfer(order.maker, amountOut);
        if (!success) revert TransferFailed();
    }

    /// @notice Cancel an unexecuted order and return escrowed tokens
    /// @param orderId The order to cancel
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];

        if (order.maker != msg.sender) revert Unauthorized();
        if (order.executed) revert OrderAlreadyExecuted();
        if (order.cancelled) revert OrderAlreadyCancelled();

        order.cancelled = true;

        emit OrderCancelled(orderId);

        bool success = IERC20(order.tokenIn).transfer(order.maker, order.amountIn);
        if (!success) revert TransferFailed();
    }
}
```

## Keeper Bot (TypeScript)

```typescript
import { WrapperBuilder } from "@redstone-finance/evm-connector";
import { ethers } from "ethers";

const ORDER_BOOK_ABI = [
  "function executeOrder(uint256 orderId) external",
  "function orders(uint256) view returns (address maker, address tokenIn, address tokenOut, uint256 amountIn, uint256 minPrice, bytes32 priceFeedId, uint256 submittedBlock, uint256 submittedTimestamp, uint256 expiryTimestamp, bool executed, bool cancelled)",
  "function nextOrderId() view returns (uint256)",
];

const ORDER_BOOK_ADDRESS = "0xYourOrderBookAddress";

interface PendingOrder {
  orderId: bigint;
  feedId: string;
}

async function scanAndExecuteOrders() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.KEEPER_PRIVATE_KEY!, provider);
  const currentBlock = BigInt(await provider.getBlockNumber());
  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

  const orderBook = new ethers.Contract(
    ORDER_BOOK_ADDRESS,
    ORDER_BOOK_ABI,
    signer
  );

  const nextId = BigInt(await orderBook.nextOrderId());
  const pendingOrders: PendingOrder[] = [];

  // Scan for executable orders
  for (let i = 0n; i < nextId; i++) {
    const order = await orderBook.orders(i);

    if (order.executed || order.cancelled) continue;
    if (order.maker === ethers.ZeroAddress) continue;
    if (currentTimestamp > BigInt(order.expiryTimestamp)) continue;

    // Must be at least MIN_EXECUTION_DELAY_BLOCKS after submission
    if (currentBlock <= BigInt(order.submittedBlock) + 1n) continue;

    const feedId = ethers.decodeBytes32String(order.priceFeedId);
    pendingOrders.push({ orderId: i, feedId });
  }

  // Execute each pending order with appropriate price data
  for (const pending of pendingOrders) {
    const wrappedOrderBook = WrapperBuilder.wrap(orderBook).usingDataService({
      dataServiceId: "redstone-primary-prod",
      uniqueSignersCount: 3,
      dataPackagesIds: [pending.feedId],
    });

    try {
      const tx = await wrappedOrderBook.executeOrder(pending.orderId);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        console.error(`Order ${pending.orderId} execution reverted`);
        continue;
      }

      console.log(`Executed order ${pending.orderId}, tx: ${tx.hash}`);
    } catch (err) {
      if (err instanceof Error) {
        // PriceBelowMinimum means price doesn't meet the maker's limit
        // This is expected -- skip and retry on next block
        if (err.message.includes("PriceBelowMinimum")) {
          console.log(`Order ${pending.orderId}: price below limit, skipping`);
          continue;
        }
        console.error(`Order ${pending.orderId} failed: ${err.message}`);
      }
    }
  }
}

// Run keeper loop
async function keeperLoop() {
  const POLL_INTERVAL_MS = 12_000; // ~1 block on Ethereum

  while (true) {
    try {
      await scanAndExecuteOrders();
    } catch (err) {
      if (err instanceof Error) {
        console.error(`Keeper loop error: ${err.message}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
```

## User Submission (TypeScript)

```typescript
import { ethers } from "ethers";

const ORDER_BOOK_ABI = [
  "function submitOrder(address tokenIn, address tokenOut, uint256 amountIn, uint256 minPrice, bytes32 priceFeedId) external returns (uint256)",
];

async function submitLimitOrder(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  minPrice: bigint,
  feedId: string
) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const orderBook = new ethers.Contract(
    "0xYourOrderBookAddress",
    ORDER_BOOK_ABI,
    signer
  );

  // Phase 1: No RedStone wrapping needed for submission
  // Price data is only required at execution time (Phase 2)
  const feedIdBytes32 = ethers.encodeBytes32String(feedId);

  // Approve token transfer first
  const tokenContract = new ethers.Contract(
    tokenIn,
    ["function approve(address,uint256) external returns (bool)"],
    signer
  );
  const approveTx = await tokenContract.approve(
    "0xYourOrderBookAddress",
    amountIn
  );
  await approveTx.wait();

  const tx = await orderBook.submitOrder(
    tokenIn,
    tokenOut,
    amountIn,
    minPrice,
    feedIdBytes32
  );
  const receipt = await tx.wait();

  if (receipt.status !== 1) {
    throw new Error(`Order submission reverted: ${tx.hash}`);
  }

  console.log(`Order submitted, tx: ${tx.hash}`);
}
```

## Key Points

- Phase 1 (submit) does NOT require RedStone price data -- it only records the intent
- Phase 2 (execute) requires RedStone calldata with prices timestamped after the submission block
- `MIN_EXECUTION_DELAY_BLOCKS = 1` prevents same-block frontrunning
- Order expiry prevents stale intents from being executed with outdated parameters
- Keepers must supply price data that satisfies the maker's `minPrice` threshold
- The contract follows CEI pattern: checks, then state update, then external calls
- Cancelled orders return escrowed tokens to the maker
