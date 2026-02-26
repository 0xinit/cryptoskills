# ERC-20 Complete Interface Reference

Full interface specification for ERC-20 fungible tokens, including metadata and permit extensions.

## IERC20 — Core Interface

```solidity
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
```

## IERC20Metadata — Name, Symbol, Decimals

Optional extension defined in EIP-20. Nearly all tokens implement this.

```solidity
interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}
```

**Decimals are not guaranteed to be 18.** Common exceptions:
| Token | Decimals |
|-------|----------|
| USDC  | 6        |
| USDT  | 6        |
| WBTC  | 8        |
| GUSD  | 2        |

## IERC20Permit (ERC-2612) — Gasless Approvals

```solidity
interface IERC20Permit {
    function permit(
        address owner, address spender, uint256 value,
        uint256 deadline, uint8 v, bytes32 r, bytes32 s
    ) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
```

DAI uses a non-standard permit: `permit(address holder, address spender, uint256 nonce, uint256 expiry, bool allowed, uint8 v, bytes32 r, bytes32 s)` — the `allowed` bool replaces `value`.

## Function Selectors

Computed as `bytes4(keccak256("functionSignature"))`.

| Function | Selector |
|----------|----------|
| `totalSupply()` | `0x18160ddd` |
| `balanceOf(address)` | `0x70a08231` |
| `transfer(address,uint256)` | `0xa9059cbb` |
| `allowance(address,address)` | `0xdd62ed3e` |
| `approve(address,uint256)` | `0x095ea7b3` |
| `transferFrom(address,address,uint256)` | `0x23b872dd` |
| `name()` | `0x06fdde03` |
| `symbol()` | `0x95d89b41` |
| `decimals()` | `0x313ce567` |
| `permit(address,address,uint256,uint256,uint8,bytes32,bytes32)` | `0xd505accf` |
| `nonces(address)` | `0x7ecebe00` |
| `DOMAIN_SEPARATOR()` | `0x3644e515` |

## ERC-165 Interface ID

ERC-20 predates ERC-165, so most ERC-20 tokens do NOT implement `supportsInterface`. Do not rely on ERC-165 to detect ERC-20 support. Instead, use a try/catch call to `balanceOf` or check `totalSupply`.

## Implementation Notes

- **Return values**: The spec requires `transfer` and `transferFrom` to return `bool`. Some tokens (USDT on mainnet) do not return a value. Always use OpenZeppelin `SafeERC20` wrappers to handle both.
- **Approve race condition**: If a user changes an allowance from N to M, the spender can front-run and spend N, then spend M. Mitigate by setting to 0 first, or use `increaseAllowance`/`decreaseAllowance`.
- **USDT requires zero-first approve**: USDT reverts if you call `approve` with a nonzero value when the current allowance is already nonzero. Always reset to 0 before setting a new allowance.
- **Fee-on-transfer tokens**: Some tokens deduct a fee on every transfer. The received amount is less than the sent amount. Always measure `balanceOf` before and after to determine actual received amount.
- **Rebasing tokens**: Tokens like stETH change balances automatically. Protocols that cache `balanceOf` can desync. Use the wrapped variant (wstETH) instead.
- **Minting and burning**: Minting emits `Transfer(address(0), to, amount)`. Burning emits `Transfer(from, address(0), amount)`.

## References

- [EIP-20](https://eips.ethereum.org/EIPS/eip-20) — Token Standard
- [ERC-2612](https://eips.ethereum.org/EIPS/eip-2612) — Permit Extension
- [OpenZeppelin ERC20](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20) — Reference implementation
