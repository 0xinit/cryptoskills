# ERC20 Token Examples

Production-ready ERC20 token implementations using OpenZeppelin v5.

## Basic ERC20

Fixed-supply token with no admin functions.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BasicToken is ERC20 {
    constructor(address recipient) ERC20("BasicToken", "BASIC") {
        _mint(recipient, 1_000_000 * 10 ** decimals());
    }
}
```

## Mintable + Burnable + Pausable

Admin-controlled token with emergency pause. Suitable for protocol reward tokens.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ManagedToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable {
    constructor(address initialOwner)
        ERC20("ManagedToken", "MGD")
        Ownable(initialOwner)
    {
        _mint(initialOwner, 5_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // v5: override _update instead of _beforeTokenTransfer
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
```

## ERC20Permit (Gasless Approvals)

EIP-2612 permit allows users to approve via off-chain signature, eliminating the separate `approve` transaction.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract PermitToken is ERC20, ERC20Permit {
    constructor(address recipient)
        ERC20("PermitToken", "PMTK")
        ERC20Permit("PermitToken")
    {
        _mint(recipient, 10_000_000 * 10 ** decimals());
    }
}
```

Off-chain usage with viem:

```typescript
import { parseEther, getContract } from "viem";

const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

const signature = await walletClient.signTypedData({
  domain: {
    name: "PermitToken",
    version: "1",
    chainId: 1n,
    verifyingContract: tokenAddress,
  },
  types: {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Permit",
  message: {
    owner: ownerAddress,
    spender: spenderAddress,
    value: parseEther("100"),
    nonce: await token.read.nonces([ownerAddress]),
    deadline,
  },
});
```

## ERC20Votes (Governance Token)

Token with vote delegation for use with Governor contracts. Implements EIP-5805 (checkpoint-based voting power).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract VoteToken is ERC20, ERC20Permit, ERC20Votes {
    constructor(address recipient)
        ERC20("VoteToken", "VOTE")
        ERC20Permit("VoteToken")
    {
        _mint(recipient, 50_000_000 * 10 ** decimals());
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    // ERC20Permit and ERC20Votes both inherit Nonces -- resolve the diamond
    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
```

Holders must delegate to activate voting power (self-delegation counts):

```solidity
// Self-delegate to activate own voting power
voteToken.delegate(msg.sender);

// Delegate to another address
voteToken.delegate(delegateAddress);
```

## Capped Supply

Hard cap enforced at the contract level. Useful for deflationary tokenomics.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract CappedToken is ERC20Capped, Ownable {
    /// @dev 100M token hard cap
    constructor(address initialOwner)
        ERC20("CappedToken", "CPTK")
        ERC20Capped(100_000_000 * 10 ** 18)
        Ownable(initialOwner)
    {
        _mint(initialOwner, 10_000_000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount); // reverts with ERC20ExceededCap if cap is breached
    }

    // ERC20Capped overrides _update to enforce the cap
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}
```

## Import Path Reference

All ERC20 imports use the `@openzeppelin/contracts/token/ERC20/` prefix:

| Contract | Import Path |
|----------|-------------|
| ERC20 | `@openzeppelin/contracts/token/ERC20/ERC20.sol` |
| ERC20Burnable | `@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol` |
| ERC20Capped | `@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol` |
| ERC20Pausable | `@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol` |
| ERC20Permit | `@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol` |
| ERC20Votes | `@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol` |
| ERC20Wrapper | `@openzeppelin/contracts/token/ERC20/extensions/ERC20Wrapper.sol` |
| IERC20 | `@openzeppelin/contracts/token/ERC20/IERC20.sol` |
| SafeERC20 | `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol` |
