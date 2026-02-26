# MegaNames (.mega Naming Service)

MegaNames is the ENS-style naming service for MegaETH's `.mega` TLD with stable USDM pricing.

## Contract Addresses (Mainnet, Chain ID: 4326)

| Contract | Address |
|----------|---------|
| MegaNames | `0x5B424C6CCba77b32b9625a6fd5A30D409d20d997` |
| MegaNameRenderer | `0x8d206c277E709c8F4f8882fc0157bE76dA0C48C4` |
| SubdomainRouter | `0xdB5e5Ab907e62714D7d9Ffde209A4E770a0507Fe` |
| SubdomainLogic | `0xf09fB5cB77b570A30D68b1Aa1d944256171C5172` |
| USDM | `0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7` |
| Fee Recipient | `0x25925C0191E8195aFb9dFA35Cd04071FF11D2e38` |

Explorers:
- Blockscout: https://megaeth.blockscout.com/address/0x5B424C6CCba77b32b9625a6fd5A30D409d20d997
- Etherscan: https://mega.etherscan.io/address/0x5B424C6CCba77b32b9625a6fd5A30D409d20d997

Frontend: https://meganame.market

## Token ID Computation

Names use ENS-style namehashing with the `.mega` TLD node:

```solidity
bytes32 constant MEGA_NODE = keccak256(abi.encodePacked(bytes32(0), keccak256("mega")));
// = 0x892fab39f6d2ae901009febba7dbdd0fd85e8a1651be6b8901774cdef395852f

uint256 tokenId = uint256(keccak256(abi.encodePacked(MEGA_NODE, keccak256(bytes(label)))));
```

```typescript
import { keccak256, encodePacked, toBytes } from 'viem'

const MEGA_NODE = keccak256(encodePacked(['bytes32', 'bytes32'], [
  '0x0000000000000000000000000000000000000000000000000000000000000000',
  keccak256(toBytes('mega'))
]))

function getTokenId(label: string): bigint {
  const labelHash = keccak256(toBytes(label))
  return BigInt(keccak256(encodePacked(['bytes32', 'bytes32'], [MEGA_NODE, labelHash])))
}
```

## Registration

Names are ERC-721 NFTs. Registration requires USDM approval + register call.

### Fee Structure

| Label Length | Annual Fee (USDM) |
|-------------|-------------------|
| 1 character | $1,000 |
| 2 characters | $500 |
| 3 characters | $100 |
| 4 characters | $10 |
| 5+ characters | $1 |

### Multi-Year Discounts

| Duration | Discount |
|----------|----------|
| 2 years | 5% |
| 3 years | 10% |
| 5 years | 15% |
| 10 years | 25% |

### Register a Name

```solidity
// 1. Approve USDM
IERC20(0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7).approve(
    0x5B424C6CCba77b32b9625a6fd5A30D409d20d997,
    fee
);

// 2. Register (label, owner, numYears)
uint256 tokenId = megaNames.register("yourname", msg.sender, 1);
```

### Register with ERC-2612 Permit (Single Transaction)

```solidity
megaNames.registerWithPermit(
    "yourname",
    msg.sender,
    1,
    fee,
    deadline,
    v, r, s
);
```

### Calculate Fee

```solidity
uint256 yearlyFee = megaNames.registrationFee(labelLength);
uint256 totalFee = megaNames.calculateFee(labelLength, numYears);
```

## Name Resolution

### Forward Resolution (Name -> Address)

```solidity
address resolved = megaNames.addr(tokenId);
```

### Reverse Resolution (Address -> Name)

```solidity
string memory name = megaNames.getName(userAddress);
// Returns "bread.mega" or "" if no primary name set
```

### Set Address Resolution

```solidity
megaNames.setAddr(tokenId, targetAddress);
```

### Set Primary Name

```solidity
megaNames.setPrimaryName(tokenId);
```

## Text Records

Store arbitrary key-value metadata on names (avatar, social links, etc.).

```solidity
megaNames.setText(tokenId, "com.twitter", "@yourhandle");
megaNames.setText(tokenId, "url", "https://yoursite.com");
megaNames.setText(tokenId, "avatar", "https://example.com/avatar.png");

string memory twitter = megaNames.text(tokenId, "com.twitter");
```

### Common Text Record Keys

| Key | Description |
|-----|-------------|
| `avatar` | Profile image URL |
| `url` | Website URL |
| `com.twitter` | Twitter/X handle |
| `com.github` | GitHub username |
| `com.discord` | Discord username |
| `description` | Bio/description |

## Subdomains

Parent name owners can create free, unlimited subdomains.

```solidity
// Create subdomain: blog.yourname.mega
uint256 subId = megaNames.registerSubdomain(parentTokenId, "blog");

// Subdomains are full ERC-721 tokens with their own:
// - Address resolution (setAddr)
// - Text records (setText)
// - Transferability

// Parent owner can revoke subdomains
megaNames.revokeSubdomain(subdomainTokenId);

// Nested subdomains supported (up to 10 levels deep)
uint256 nestedSubId = megaNames.registerSubdomain(subId, "1");
```

### Subdomain Token ID

```solidity
// Subdomain tokenId uses parent tokenId as node (not MEGA_NODE)
uint256 subTokenId = uint256(keccak256(abi.encodePacked(bytes32(parentTokenId), keccak256(bytes(subLabel)))));
```

## Subdomain Marketplace

Name owners can sell subdomains through the SubdomainRouter. Buyers pay USDM; 97.5% goes to the name owner, 2.5% protocol fee.

### Selling Subdomains (Name Owner)

```solidity
// 1. Approve router to transfer your NFT (one-time)
megaNames.setApprovalForAll(0xdB5e5Ab907e62714D7d9Ffde209A4E770a0507Fe, true);

// 2. Set price (in USDM, 18 decimals)
ISubdomainLogic(0xf09fB5cB77b570A30D68b1Aa1d944256171C5172).setPrice(
    parentTokenId,
    0.01 ether // $0.01 USDM minimum
);

// 3. Enable sales
ISubdomainRouter(0xdB5e5Ab907e62714D7d9Ffde209A4E770a0507Fe).configure(
    parentTokenId,
    payoutAddress,
    true,   // enabled
    0       // mode: 0=open, 1=allowlist (token-gated)
);

// Disable sales
ISubdomainRouter(0xdB5e5Ab907e62714D7d9Ffde209A4E770a0507Fe).disable(parentTokenId);
```

### Token Gating (Optional)

```solidity
ISubdomainLogic(0xf09fB5cB77b570A30D68b1Aa1d944256171C5172).setTokenGate(
    parentTokenId,
    tokenContractAddress,
    1 // minimum balance required
);

// Use mode=1 when configuring to enable the gate
router.configure(parentTokenId, payoutAddress, true, 1);
```

### Buying a Subdomain

```solidity
// 1. Approve USDM for SubdomainRouter
IERC20(USDM).approve(0xdB5e5Ab907e62714D7d9Ffde209A4E770a0507Fe, price);

// 2. Get quote (checks eligibility + price)
(bool allowed, uint256 price, uint256 protocolFee, uint256 total) =
    ISubdomainRouter(0xdB5e5Ab907e62714D7d9Ffde209A4E770a0507Fe).quote(
        parentTokenId,
        "sublabel",
        buyerAddress
    );

// 3. Register (referrer=address(0) if none)
uint256 subTokenId = ISubdomainRouter(0xdB5e5Ab907e62714D7d9Ffde209A4E770a0507Fe).register(
    parentTokenId,
    "sublabel",
    address(0)
);
```

### Batch Registration

```solidity
// Register multiple subdomains in one tx (max 50)
string[] memory labels = new string[](3);
labels[0] = "alpha";
labels[1] = "beta";
labels[2] = "gamma";

uint256[] memory tokenIds = router.registerBatch(parentTokenId, labels, address(0));
```

### Reading Marketplace State

```solidity
(address payoutAddress, bool enabled, uint8 mode) = router.getConfig(parentTokenId);

uint256 price = ISubdomainLogic(logic).prices(parentTokenId);

(uint64 sold, uint64 active, uint128 volumeUsdm6) = router.getCounters(parentTokenId);

(address token, uint256 minBalance) = ISubdomainLogic(logic).tokenGates(parentTokenId);
```

### Key Design Notes

- **Flash-based**: parent NFT is temporarily pulled, subdomain registered, parent returned -- all atomic
- **No escrow**: USDM transfers directly from buyer to owner + protocol fee recipient
- **Transient storage** (EIP-1153) for reentrancy guard -- zero gas vs 2M+ SSTORE on MegaETH
- **Swappable logic**: router is permanent, logic contract can be upgraded without losing config
- **Minimum price**: $0.01 USDM enforced by router (not bypassable by logic)

## Warren Contenthash (On-Chain Websites)

Link a name to a Warren Protocol on-chain website.

```solidity
megaNames.setWarrenContenthash(tokenId, warrenTokenId, true);

bytes memory ch = megaNames.warren(tokenId);
// Format: 0xe9 + 01(master)/02(container) + 4-byte warrenTokenId
```

## Renewals

Anyone can renew a name (gift renewals are allowed).

```solidity
megaNames.renew(tokenId, numYears);
```

## Premium Decay (Expired Names)

Expired names enter a grace period (90 days) then become available with a Dutch auction premium that decays linearly from $10,000 to $0 over 21 days.

```solidity
uint256 premium = megaNames.currentPremium(tokenId);
```

## Cross-Chain Interop (ERC-7930)

```solidity
bytes memory interop = megaNames.interopAddress(tokenId);
// Format: Version(1) + ChainType(2, EVM) + ChainRef(4326) + Address(20)
```

## Enumeration

```solidity
uint256[] memory tokens = megaNames.tokensOfOwner(userAddress);
uint256 count = megaNames.tokensOfOwnerCount(userAddress);
```

## Contract Statistics

```solidity
uint256 registered = megaNames.totalRegistrations();
uint256 renewed = megaNames.totalRenewals();
uint256 subs = megaNames.totalSubdomains();
uint256 volume = megaNames.totalVolume();
```

## Label Validation

Labels must match `[a-z0-9-]` with no leading or trailing hyphens. Max 255 characters.

Valid: `bread`, `my-name`, `abc123`, `a`
Invalid: `-name`, `name-`, `My.Name`, `name space`

## Frontend Integration (wagmi/viem)

```typescript
import { useReadContract } from 'wagmi'

const MEGA_NAMES = '0x5B424C6CCba77b32b9625a6fd5A30D409d20d997'

const { data: addr } = useReadContract({
  address: MEGA_NAMES,
  abi: megaNamesAbi,
  functionName: 'addr',
  args: [getTokenId('bread')],
})

const { data: name } = useReadContract({
  address: MEGA_NAMES,
  abi: megaNamesAbi,
  functionName: 'getName',
  args: [userAddress],
})

const { data: tokenIds } = useReadContract({
  address: MEGA_NAMES,
  abi: megaNamesAbi,
  functionName: 'tokensOfOwner',
  args: [userAddress],
})
```

## Upgradeable TokenURI Renderer

The contract supports an external renderer for NFT metadata/SVG:

```solidity
megaNames.setTokenURIRenderer(newRendererAddress);

address renderer = megaNames.tokenURIRenderer();
// Returns address(0) if using built-in fallback SVG
```

The current renderer (`0x8d206c277E709c8F4f8882fc0157bE76dA0C48C4`) is fully stateless. Features:
- `.m` SVG path logo
- 5 rarity tiers based on root parent domain length (1-char=Legendary through 5+=Standard)
- Subdomain split display (sub chain top line, root parent below)
- Expiry dates, character count, tier-colored backgrounds

## Key Design Notes

- **No commit-reveal**: MegaETH is fast enough; registration is direct approve + register
- **USDM payments** (18 decimals): stable pricing, no ETH volatility
- **100% of fees** go to fee recipient address
- **Names are ERC-721**: fully transferable, tradeable on NFT marketplaces
- **Subdomains are revocable** by parent owner; parent name transfers are irreversible
- **Nested subdomains** up to 10 levels deep; tier inherits from root parent domain
- **Upgradeable renderer**: owner can swap NFT metadata renderer without proxy patterns
- **Registration can be gated**: `registrationOpen` flag controlled by contract owner
