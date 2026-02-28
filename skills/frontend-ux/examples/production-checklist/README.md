# Production Checklist

Complete QA checklist for shipping a dApp frontend. Every unchecked item is a broken user experience.

## Pre-Launch QA Checklist

### Wallet Connection (6 items)

- [ ] **Disconnected**: Connect button visible and functional
- [ ] **Connecting**: Spinner or loading state shown while wallet responds
- [ ] **Connected**: Truncated address and chain name displayed
- [ ] **Wrong network**: Switch prompt appears with correct chain name
- [ ] **Auto-reconnect**: Page reload preserves connection without flash of disconnected state
- [ ] **Disconnect**: Clears all state, no stale address or balance shown

### Transaction Lifecycle (7 items)

- [ ] **Idle**: Action button enabled, form inputs editable
- [ ] **Awaiting signature**: Button disabled, shows "Confirm in wallet..."
- [ ] **Pending**: Shows "Waiting for confirmation..." with block explorer link
- [ ] **Confirmed**: Success message with explorer link and "Send another" option
- [ ] **Failed (revert)**: Shows decoded revert reason, not raw hex
- [ ] **Failed (dropped)**: Shows timeout message with retry option
- [ ] **User rejection (4001)**: Silent reset to idle, NO error toast

### Error Handling (5 items)

- [ ] **Insufficient funds**: Shows user balance alongside required amount
- [ ] **Contract revert**: Decoded custom error name displayed
- [ ] **Network failure**: Retry button with fallback RPC suggestion
- [ ] **RPC rate limit**: Toast with "Try again in a moment"
- [ ] **All errors**: Human-readable, no raw hex or stack traces

### Token Display (4 items)

- [ ] **Decimals**: USDC shows 6 decimals, ETH shows 18 decimals
- [ ] **Formatting**: Large numbers use commas or abbreviations (1.5M)
- [ ] **USD value**: Dollar equivalent shown where available
- [ ] **Type safety**: All amounts use `bigint`, never JavaScript `number`

### Mobile (6 items)

- [ ] **MetaMask Mobile**: Full flow works in MetaMask in-app browser
- [ ] **Coinbase Wallet**: Full flow works in Coinbase Wallet in-app browser
- [ ] **WalletConnect**: QR code scan connects successfully
- [ ] **Touch targets**: All buttons at least 44x44px
- [ ] **No overflow**: No horizontal scroll on 320px viewport
- [ ] **Transaction states**: All states readable on small screens

### Accessibility (5 items)

- [ ] **Keyboard navigation**: All interactive elements reachable via Tab
- [ ] **Screen readers**: Transaction state changes use `aria-live` or `role="alert"`
- [ ] **Color independence**: Status indicated by text/icons, not just color
- [ ] **Focus management**: Modal traps focus, restores on close
- [ ] **Contrast**: Text meets 4.5:1 ratio, large text meets 3:1

### Network Switching (3 items)

- [ ] **Wrong chain detection**: Auto-prompt when connected to unsupported chain
- [ ] **Chain add**: Unknown networks added to wallet automatically
- [ ] **Multi-chain display**: Correct explorer URLs for each chain

### Performance (4 items)

- [ ] **Bundle size**: RainbowKit + wagmi under 150KB gzipped
- [ ] **RPC calls**: Multicall batching for multiple reads
- [ ] **Polling**: Reasonable refetch intervals (not every block for non-critical data)
- [ ] **SSR hydration**: No flash of incorrect state on page load

## Testing Procedures

### Manual Wallet State Testing

```
1. Fresh browser (no wallet extension)
   - Verify: Connect button shown, clicking opens install prompt

2. Wallet installed, not connected
   - Verify: Connect shows wallet list, clicking opens wallet popup

3. Connect then reject in wallet
   - Verify: Returns to disconnected, no error toast

4. Connect successfully
   - Verify: Address and chain displayed

5. Switch to unsupported chain in wallet
   - Verify: "Wrong Network" prompt appears

6. Disconnect
   - Verify: All state cleared, back to step 2

7. Reload page while connected
   - Verify: Auto-reconnects without flicker
```

### Transaction State Testing

```
1. Submit transaction, reject in wallet
   - Verify: Silent reset, no error shown

2. Submit transaction, approve in wallet
   - Verify: "Waiting for confirmation..." with explorer link

3. Wait for confirmation
   - Verify: Success message with block number and explorer link

4. Submit transaction that will revert (e.g., transfer more than balance)
   - Verify: Error message shows decoded revert reason

5. Submit with insufficient gas
   - Verify: Error message mentions insufficient funds
```

### Mobile Testing Checklist

```
1. Open dApp in MetaMask Mobile browser
   - Navigate to your dApp URL
   - Verify: Connect flow works natively (no QR needed)
   - Verify: Transaction signing opens MetaMask confirmation

2. Open dApp in regular mobile browser (Safari/Chrome)
   - Verify: WalletConnect QR modal appears on connect
   - Verify: Scanning QR with mobile wallet connects
   - Verify: Transaction signing opens wallet app via deep link

3. Screen size testing
   - Test on 320px, 375px, 414px viewport widths
   - Verify: No overflow, all buttons tappable, text readable
```
