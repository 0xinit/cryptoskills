# OFT Rate Limiter Examples

Implement rate limiting on cross-chain OFT token transfers to prevent bridge exploits and control token flow.

## Overview

Rate limiting caps how many tokens can be transferred through an OFT in a given time window. This is a critical security layer — if a DVN is compromised, rate limits bound the damage. LayerZero V2 provides a `RateLimiter` mix-in for this purpose.

## Solidity: OFT with Rate Limiting

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {OFT} from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice OFT with per-chain inbound/outbound rate limiting using a sliding window
contract RateLimitedOFT is OFT {
    struct RateLimit {
        uint256 limit;      // max tokens per window
        uint256 window;     // window duration in seconds
        uint256 spent;      // tokens spent in current window
        uint256 lastRefill; // timestamp of last window reset
    }

    /// @dev eid -> outbound rate limit
    mapping(uint32 => RateLimit) public outboundLimits;
    /// @dev eid -> inbound rate limit
    mapping(uint32 => RateLimit) public inboundLimits;

    event OutboundRateLimitSet(uint32 indexed eid, uint256 limit, uint256 window);
    event InboundRateLimitSet(uint32 indexed eid, uint256 limit, uint256 window);

    error RateLimitExceeded(uint32 eid, uint256 amount, uint256 available);

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {}

    /// @notice Sets outbound rate limit for a destination chain
    /// @param _eid Destination endpoint ID
    /// @param _limit Maximum tokens per window (in local decimals)
    /// @param _window Time window in seconds
    function setOutboundRateLimit(
        uint32 _eid,
        uint256 _limit,
        uint256 _window
    ) external onlyOwner {
        outboundLimits[_eid] = RateLimit({
            limit: _limit,
            window: _window,
            spent: 0,
            lastRefill: block.timestamp
        });
        emit OutboundRateLimitSet(_eid, _limit, _window);
    }

    /// @notice Sets inbound rate limit from a source chain
    /// @param _eid Source endpoint ID
    /// @param _limit Maximum tokens per window (in local decimals)
    /// @param _window Time window in seconds
    function setInboundRateLimit(
        uint32 _eid,
        uint256 _limit,
        uint256 _window
    ) external onlyOwner {
        inboundLimits[_eid] = RateLimit({
            limit: _limit,
            window: _window,
            spent: 0,
            lastRefill: block.timestamp
        });
        emit InboundRateLimitSet(_eid, _limit, _window);
    }

    /// @notice Returns available outbound capacity for a destination
    /// @param _eid Destination endpoint ID
    /// @return available Tokens that can still be sent in the current window
    function outboundAvailable(uint32 _eid) external view returns (uint256 available) {
        RateLimit memory rl = outboundLimits[_eid];
        if (rl.limit == 0) return type(uint256).max;
        if (block.timestamp >= rl.lastRefill + rl.window) return rl.limit;
        return rl.limit > rl.spent ? rl.limit - rl.spent : 0;
    }

    /// @dev Override _debit to enforce outbound rate limit
    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal virtual override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        _checkOutboundRateLimit(_dstEid, _amountLD);
        return super._debit(_from, _amountLD, _minAmountLD, _dstEid);
    }

    /// @dev Override _credit to enforce inbound rate limit
    function _credit(
        address _to,
        uint256 _amountLD,
        uint32 _srcEid
    ) internal virtual override returns (uint256 amountReceivedLD) {
        _checkInboundRateLimit(_srcEid, _amountLD);
        return super._credit(_to, _amountLD, _srcEid);
    }

    function _checkOutboundRateLimit(uint32 _eid, uint256 _amount) internal {
        RateLimit storage rl = outboundLimits[_eid];
        if (rl.limit == 0) return; // no limit set

        _refreshWindow(rl);

        uint256 available = rl.limit - rl.spent;
        if (_amount > available) revert RateLimitExceeded(_eid, _amount, available);

        rl.spent += _amount;
    }

    function _checkInboundRateLimit(uint32 _eid, uint256 _amount) internal {
        RateLimit storage rl = inboundLimits[_eid];
        if (rl.limit == 0) return;

        _refreshWindow(rl);

        uint256 available = rl.limit - rl.spent;
        if (_amount > available) revert RateLimitExceeded(_eid, _amount, available);

        rl.spent += _amount;
    }

    function _refreshWindow(RateLimit storage rl) internal {
        if (block.timestamp >= rl.lastRefill + rl.window) {
            rl.spent = 0;
            rl.lastRefill = block.timestamp;
        }
    }
}
```

## TypeScript: Set Rate Limits

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const rateLimitAbi = parseAbi([
  "function setOutboundRateLimit(uint32 eid, uint256 limit, uint256 window) external",
  "function setInboundRateLimit(uint32 eid, uint256 limit, uint256 window) external",
  "function outboundAvailable(uint32 eid) view returns (uint256 available)",
]);

const OFT_ADDRESS: Address = "0xYourRateLimitedOFT" as Address;
const ARBITRUM_EID = 30110;
const ONE_HOUR = 3600n;
const ONE_DAY = 86400n;
```

### Set Outbound Limit

```typescript
async function setOutboundLimit(
  eid: number,
  limit: bigint,
  window: bigint
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: OFT_ADDRESS,
    abi: rateLimitAbi,
    functionName: "setOutboundRateLimit",
    args: [eid, limit, window],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("setOutboundRateLimit reverted");
  return hash;
}

// 100,000 tokens per hour to Arbitrum (18 decimals)
await setOutboundLimit(ARBITRUM_EID, parseEther("100000"), ONE_HOUR);
```

### Set Inbound Limit

```typescript
async function setInboundLimit(
  eid: number,
  limit: bigint,
  window: bigint
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
    address: OFT_ADDRESS,
    abi: rateLimitAbi,
    functionName: "setInboundRateLimit",
    args: [eid, limit, window],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("setInboundRateLimit reverted");
  return hash;
}

// 500,000 tokens per day from Arbitrum
await setInboundLimit(ARBITRUM_EID, parseEther("500000"), ONE_DAY);
```

### Check Available Capacity

```typescript
async function checkCapacity(eid: number): Promise<bigint> {
  const available = await publicClient.readContract({
    address: OFT_ADDRESS,
    abi: rateLimitAbi,
    functionName: "outboundAvailable",
    args: [eid],
  });

  return available;
}

const available = await checkCapacity(ARBITRUM_EID);
console.log(`Available outbound to Arbitrum: ${available} tokens (raw)`);
```

## Recommended Rate Limits by Protocol Size

| Total Supply | Outbound per Hour | Inbound per Day | Window |
|-------------|-------------------|-----------------|--------|
| < 10M tokens | 1% of supply | 5% of supply | 1 hour / 24 hours |
| 10M - 100M | 0.5% of supply | 2% of supply | 1 hour / 24 hours |
| > 100M | 0.1% of supply | 1% of supply | 1 hour / 24 hours |

## Important Notes

- Rate limits operate in local decimals (`amountLD`), not shared decimals.
- Inbound rate limit failures cause `lzReceive` to revert. The message is stored and can be retried after the window resets.
- Set rate limits on BOTH the home chain (OFTAdapter) and remote chains (OFT) for full protection.
- Rate limits do not prevent individual large transfers — they cap aggregate volume per window. For per-transfer caps, add an additional `maxTransferAmount` check.
- The window is a fixed window, not a sliding window. Capacity resets fully when the window expires.
