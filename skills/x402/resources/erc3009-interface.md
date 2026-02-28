# ERC-3009 Interface Reference

EIP-3009 defines `transferWithAuthorization` and `receiveWithAuthorization` for gasless token transfers. x402 uses `transferWithAuthorization` exclusively.

Last verified: February 2026

## Function Signatures

### transferWithAuthorization

```solidity
function transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    bytes   signature
) external;
```

### receiveWithAuthorization

```solidity
function receiveWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    bytes   signature
) external;
```

Difference: `receiveWithAuthorization` requires `msg.sender == to`, adding a constraint that only the intended recipient can submit the transaction. x402 facilitators use `transferWithAuthorization` because the facilitator (a third party) submits the transaction on behalf of both parties.

### cancelAuthorization

```solidity
function cancelAuthorization(
    address authorizer,
    bytes32 nonce,
    bytes   signature
) external;
```

Allows the authorizer to void an unused nonce before it is settled.

### authorizationState

```solidity
function authorizationState(
    address authorizer,
    bytes32 nonce
) external view returns (bool);
```

Returns `true` if the nonce has been used or canceled. Use this to check replay safety.

## Events

```solidity
event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);
```

## EIP-712 Type Hash

```solidity
bytes32 constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
    "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
);
```

## EIP-712 Domain Separator (USDC)

```solidity
EIP712Domain({
    name: "USDC",             // or "USD Coin" on some chains
    version: "2",             // USDC v2
    chainId: <chain_id>,
    verifyingContract: <usdc_address>
})
```

The domain `name` and `version` vary by chain. x402 servers include these in the `extra` field of the 402 response so clients can construct the correct domain.

## Parameter Descriptions

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | `address` | Token holder and signer of the authorization |
| `to` | `address` | Recipient of the transfer (seller's `payTo` address) |
| `value` | `uint256` | Amount in smallest unit (USDC: 6 decimals, so `10000` = $0.01) |
| `validAfter` | `uint256` | Unix timestamp after which the authorization is valid. Use `0` for immediate validity |
| `validBefore` | `uint256` | Unix timestamp before which the authorization must be settled. After this, it expires |
| `nonce` | `bytes32` | Random 32-byte value. Each `(from, nonce)` pair can only be used once |
| `signature` | `bytes` | EIP-712 signature (65 bytes: r + s + v) |

## Nonce Behavior

- Nonces are NOT sequential. Each authorization uses a random 32-byte value.
- The contract tracks `mapping(address => mapping(bytes32 => bool))` for used nonces.
- A nonce can be pre-emptively canceled via `cancelAuthorization` before settlement.
- Reusing a settled or canceled nonce reverts with `authorization is used or canceled`.

## Tokens Implementing EIP-3009

| Token | Networks |
|-------|----------|
| USDC (Circle) | Ethereum, Base, Arbitrum, Optimism, Polygon |
| EURC (Circle) | Ethereum, Base |

Not all stablecoins implement EIP-3009. USDT and DAI do not. For non-EIP-3009 tokens, x402 falls back to Permit2.

## Spec Reference

- EIP-3009: https://eips.ethereum.org/EIPS/eip-3009
- USDC v2 implementation: https://github.com/circlefin/stablecoin-evm
