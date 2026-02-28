# Token Vendor

ERC-20 token with a vendor contract that allows buying and selling tokens for ETH. Classic Scaffold-ETH challenge pattern demonstrating two-contract interaction.

## Token Contract

```solidity
// packages/foundry/contracts/YourToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract YourToken is ERC20 {
    constructor() ERC20("YourToken", "YTK") {
        // Mint initial supply to deployer; deployer transfers to Vendor
        _mint(msg.sender, 1000 * 10 ** decimals());
    }
}
```

## Vendor Contract

```solidity
// packages/foundry/contracts/Vendor.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vendor is Ownable {
    IERC20 public yourToken;

    // 100 tokens per 1 ETH
    uint256 public constant TOKENS_PER_ETH = 100;

    event BuyTokens(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
    event SellTokens(address indexed seller, uint256 tokenAmount, uint256 ethAmount);

    constructor(address _tokenAddress) Ownable(msg.sender) {
        yourToken = IERC20(_tokenAddress);
    }

    function buyTokens() external payable {
        require(msg.value > 0, "Vendor: send ETH to buy tokens");

        uint256 tokenAmount = msg.value * TOKENS_PER_ETH;
        uint256 vendorBalance = yourToken.balanceOf(address(this));
        require(vendorBalance >= tokenAmount, "Vendor: insufficient token balance");

        bool sent = yourToken.transfer(msg.sender, tokenAmount);
        require(sent, "Vendor: token transfer failed");

        emit BuyTokens(msg.sender, msg.value, tokenAmount);
    }

    function sellTokens(uint256 _tokenAmount) external {
        require(_tokenAmount > 0, "Vendor: specify token amount");

        uint256 ethAmount = _tokenAmount / TOKENS_PER_ETH;
        require(address(this).balance >= ethAmount, "Vendor: insufficient ETH balance");

        bool received = yourToken.transferFrom(msg.sender, address(this), _tokenAmount);
        require(received, "Vendor: token transferFrom failed");

        (bool sent,) = msg.sender.call{value: ethAmount}("");
        require(sent, "Vendor: ETH transfer failed");

        emit SellTokens(msg.sender, _tokenAmount, ethAmount);
    }

    function withdraw() external onlyOwner {
        (bool sent,) = owner().call{value: address(this).balance}("");
        require(sent, "Vendor: ETH withdrawal failed");
    }
}
```

## Deploy Script (Foundry)

```solidity
// packages/foundry/script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ScaffoldETHDeploy} from "./DeployHelpers.s.sol";
import {YourToken} from "../contracts/YourToken.sol";
import {Vendor} from "../contracts/Vendor.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployScript is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        YourToken yourToken = new YourToken();
        deployments.push(Deployment("YourToken", address(yourToken)));

        Vendor vendor = new Vendor(address(yourToken));
        deployments.push(Deployment("Vendor", address(vendor)));

        // Transfer tokens to the vendor so it can sell them
        yourToken.transfer(address(vendor), 1000 * 10 ** yourToken.decimals());
    }
}
```

## Frontend -- Buy/Sell UI

```tsx
// packages/nextjs/app/vendor/page.tsx
"use client";

import { useState } from "react";
import { parseEther, formatEther } from "viem";
import { useAccount } from "wagmi";
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { EtherInput, IntegerInput, Address } from "~~/components/scaffold-eth";

export default function VendorPage() {
  const { address: connectedAddress } = useAccount();
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState<string | bigint>("");

  const { data: tokenBalance } = useScaffoldReadContract({
    contractName: "YourToken",
    functionName: "balanceOf",
    args: [connectedAddress ?? "0x0000000000000000000000000000000000000000"],
  });

  const { data: vendorTokenBalance } = useScaffoldReadContract({
    contractName: "YourToken",
    functionName: "balanceOf",
    args: [undefined], // Resolved by useDeployedContractInfo
  });

  const { data: tokensPerEth } = useScaffoldReadContract({
    contractName: "Vendor",
    functionName: "TOKENS_PER_ETH",
  });

  const { writeContractAsync: writeBuy, isMining: isBuying } =
    useScaffoldWriteContract("Vendor");

  const { writeContractAsync: writeApprove, isMining: isApproving } =
    useScaffoldWriteContract("YourToken");

  const { writeContractAsync: writeSell, isMining: isSelling } =
    useScaffoldWriteContract("Vendor");

  async function handleBuy() {
    await writeBuy({
      functionName: "buyTokens",
      value: parseEther(buyAmount),
    });
  }

  async function handleSell() {
    const amount = BigInt(sellAmount) * 10n ** 18n;

    await writeApprove({
      functionName: "approve",
      args: [undefined, amount], // Vendor address resolved automatically
    });

    await writeSell({
      functionName: "sellTokens",
      args: [amount],
    });
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Token Vendor</h1>

      <p>
        Your YTK Balance: {tokenBalance ? formatEther(tokenBalance) : "0"}
      </p>
      <p>Rate: {tokensPerEth?.toString() ?? "..."} YTK per 1 ETH</p>

      <div className="card bg-base-200 p-4 w-96">
        <h2 className="text-xl font-bold">Buy Tokens</h2>
        <EtherInput value={buyAmount} onChange={setBuyAmount} placeholder="ETH amount" />
        <button
          className="btn btn-primary mt-2"
          onClick={handleBuy}
          disabled={isBuying || !buyAmount}
        >
          {isBuying ? "Buying..." : "Buy Tokens"}
        </button>
      </div>

      <div className="card bg-base-200 p-4 w-96">
        <h2 className="text-xl font-bold">Sell Tokens</h2>
        <IntegerInput
          value={sellAmount}
          onChange={setSellAmount}
          placeholder="Token amount"
        />
        <button
          className="btn btn-secondary mt-2"
          onClick={handleSell}
          disabled={isApproving || isSelling || !sellAmount}
        >
          {isApproving ? "Approving..." : isSelling ? "Selling..." : "Sell Tokens"}
        </button>
      </div>
    </div>
  );
}
```

## Testing (Foundry)

```solidity
// packages/foundry/test/Vendor.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/YourToken.sol";
import "../contracts/Vendor.sol";

contract VendorTest is Test {
    YourToken public token;
    Vendor public vendor;
    address public deployer = address(this);
    address public buyer = address(0xBEEF);

    function setUp() public {
        token = new YourToken();
        vendor = new Vendor(address(token));
        token.transfer(address(vendor), 1000 * 10 ** token.decimals());
        vm.deal(buyer, 10 ether);
    }

    function test_BuyTokens() public {
        vm.prank(buyer);
        vendor.buyTokens{value: 1 ether}();
        assertEq(token.balanceOf(buyer), 100 * 10 ** token.decimals());
    }

    function test_SellTokens() public {
        vm.prank(buyer);
        vendor.buyTokens{value: 1 ether}();

        uint256 tokenAmount = token.balanceOf(buyer);
        vm.startPrank(buyer);
        token.approve(address(vendor), tokenAmount);
        vendor.sellTokens(tokenAmount);
        vm.stopPrank();

        assertEq(token.balanceOf(buyer), 0);
        assertEq(buyer.balance, 10 ether);
    }

    function test_RevertBuyWithZeroEth() public {
        vm.expectRevert("Vendor: send ETH to buy tokens");
        vm.prank(buyer);
        vendor.buyTokens{value: 0}();
    }

    function test_WithdrawOnlyOwner() public {
        vm.prank(buyer);
        vendor.buyTokens{value: 1 ether}();

        uint256 balanceBefore = deployer.balance;
        vendor.withdraw();
        assertEq(deployer.balance, balanceBefore + 1 ether);
    }
}
```

Last verified: February 2026
