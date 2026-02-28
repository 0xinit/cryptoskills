# EVM DEX Trading on Sei

Sei's native DEX module is deprecated. All DEX trading on Sei happens through standard EVM DEX contracts (Uniswap V2/V3 forks). This example shows swapping tokens on DragonSwap (Uniswap V2 fork) and interacting with a Uniswap V3-style DEX on Sei.

## Uniswap V2-Style Swap (DragonSwap)

### Solidity: Swap Router Interaction

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SeiDexTrader {
    IUniswapV2Router public immutable router;
    address public immutable wsei;

    constructor(address _router, address _wsei) {
        router = IUniswapV2Router(_router);
        wsei = _wsei;
    }

    /// @notice Swap exact SEI for tokens. Follows CEI pattern.
    function swapSeiForToken(
        address tokenOut,
        uint256 amountOutMin,
        uint256 deadline
    ) external payable {
        require(msg.value > 0, "No SEI sent");
        require(deadline > block.timestamp, "Deadline expired");

        address[] memory path = new address[](2);
        path[0] = wsei;
        path[1] = tokenOut;

        router.swapExactETHForTokens{value: msg.value}(
            amountOutMin,
            path,
            msg.sender,
            deadline
        );
    }

    /// @notice Swap exact ERC20 tokens for another ERC20. Follows CEI pattern.
    /// @dev Caller must approve this contract for amountIn of tokenIn first.
    function swapTokenForToken(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 deadline
    ) external {
        require(amountIn > 0, "Zero amount");
        require(deadline > block.timestamp, "Deadline expired");

        IERC20(tokenIn).approve(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );
    }

    /// @notice Get expected output amount for a swap path.
    function getQuote(
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) external view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = router.getAmountsOut(amountIn, path);
        return amounts[1];
    }
}
```

### TypeScript: Execute Swap with viem

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseUnits,
  encodeFunctionData,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sei } from "./chains";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: sei,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: sei,
  transport: http(),
});

const ROUTER: Address = "0x..." as const; // DragonSwap router
const WSEI: Address = "0x..." as const;
const USDC: Address = "0x..." as const;

const routerAbi = [
  {
    name: "swapExactETHForTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

async function swapSeiForUsdc(amountInSei: string): Promise<`0x${string}`> {
  const amountIn = parseEther(amountInSei);
  const path: Address[] = [WSEI, USDC];

  // Get quote first
  const amounts = await publicClient.readContract({
    address: ROUTER,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: [amountIn, path],
  });

  // 1% slippage tolerance
  const amountOutMin = (amounts[1] * 99n) / 100n;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

  const hash = await walletClient.writeContract({
    address: ROUTER,
    abi: routerAbi,
    functionName: "swapExactETHForTokens",
    args: [amountOutMin, path, account.address, deadline],
    value: amountIn,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error(`Swap reverted: ${hash}`);
  }

  return hash;
}
```

## Providing Liquidity

```typescript
const addLiquidityAbi = [
  {
    name: "addLiquidityETH",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountTokenDesired", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountToken", type: "uint256" },
      { name: "amountETH", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
] as const;

async function addLiquidity(
  tokenAddress: Address,
  tokenAmount: bigint,
  seiAmount: bigint
): Promise<`0x${string}`> {
  // 2% slippage tolerance
  const tokenMin = (tokenAmount * 98n) / 100n;
  const seiMin = (seiAmount * 98n) / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  // Approve token spend first
  const erc20Abi = [
    {
      name: "approve",
      type: "function",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
    },
  ] as const;

  const approveHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [ROUTER, tokenAmount],
  });

  const approveReceipt = await publicClient.waitForTransactionReceipt({
    hash: approveHash,
  });
  if (approveReceipt.status === "reverted") {
    throw new Error(`Approval reverted: ${approveHash}`);
  }

  const hash = await walletClient.writeContract({
    address: ROUTER,
    abi: addLiquidityAbi,
    functionName: "addLiquidityETH",
    args: [
      tokenAddress,
      tokenAmount,
      tokenMin,
      seiMin,
      account.address,
      deadline,
    ],
    value: seiAmount,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error(`Add liquidity reverted: ${hash}`);
  }

  return hash;
}
```

## Key Notes

- Sei's native DEX module (`x/dex`) is deprecated -- do NOT use it
- All EVM DEXes on Sei work identically to Uniswap V2/V3 on Ethereum
- WSEI (Wrapped SEI) is the ERC20-wrapped native token used as the base pair
- Gas is very cheap on Sei (~390ms block time), so slippage windows can be tighter
- Always check `receipt.status` after every transaction
- Use `bigint` for all token amounts -- never `number`
- Sei's parallel execution means multiple swaps on different pairs execute concurrently
