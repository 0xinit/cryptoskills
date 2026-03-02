# dApp Accessibility Requirements

Accessibility requirements specific to dApp frontends. Standard WCAG 2.1 AA rules apply, but dApps have unique challenges around wallet modals, transaction states, and dynamic content.

## Keyboard Navigation

All interactive elements must be reachable and operable via keyboard.

| Element | Required Behavior |
|---------|-------------------|
| Connect button | Focusable, activates with Enter/Space |
| Wallet modal | Traps focus inside modal, Escape closes it |
| Chain switcher | Arrow keys navigate options, Enter selects |
| Transaction button | Focusable, disabled state prevents activation |
| Explorer links | Focusable, opens in new tab with Shift+Enter or native behavior |
| Form inputs | Standard tab order, labels linked via `htmlFor` |

```tsx
// Focus trap for wallet modal
function useFocusTrap(ref: React.RefObject<HTMLDivElement>, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || !ref.current) return;

    const focusableElements = ref.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusableElements[0] as HTMLElement;
    const last = focusableElements[focusableElements.length - 1] as HTMLElement;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    first?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, ref]);
}
```

## Screen Reader Support for Transaction States

Transaction state changes must be announced to assistive technology.

```tsx
// Use role="alert" for error states (assertive)
// Use aria-live="polite" for status updates (non-urgent)

function TransactionStatus({ state }: { state: string }) {
  return (
    <>
      {state === "pending" && (
        <p aria-live="polite">
          Transaction submitted. Waiting for confirmation.
        </p>
      )}
      {state === "confirmed" && (
        <p aria-live="polite">Transaction confirmed successfully.</p>
      )}
      {state === "failed" && (
        <p role="alert">Transaction failed. Please try again.</p>
      )}
    </>
  );
}

// Buttons should communicate their state
<button
  aria-busy={isPending}
  aria-disabled={isDisabled}
  disabled={isDisabled}
>
  {isPending ? "Processing..." : "Submit"}
</button>
```

## Color Contrast for Status Indicators

Status must not rely on color alone. Always pair with text or icons.

| State | Color (example) | Required Companion |
|-------|----------------|-------------------|
| Success | Green (#16a34a) | Checkmark icon + "Confirmed" text |
| Pending | Yellow (#ca8a04) | Spinner icon + "Pending" text |
| Error | Red (#dc2626) | Warning icon + error message text |
| Info | Blue (#2563eb) | Info icon + descriptive text |

Minimum contrast ratios (WCAG 2.1 AA):
- Normal text (under 18px): 4.5:1 against background
- Large text (18px+ bold or 24px+ regular): 3:1 against background
- UI components and graphical objects: 3:1 against adjacent colors

## Focus Management During Modals

```tsx
// When opening a modal:
// 1. Store the element that triggered the modal
// 2. Move focus to the first focusable element in the modal
// 3. Trap focus inside the modal
// 4. On close, restore focus to the trigger element

function useModalFocus(isOpen: boolean) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
    } else {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  return triggerRef;
}
```

## ARIA Patterns for Common dApp Components

### Address Display

```tsx
<span aria-label={`Ethereum address ${address}`}>
  {address.slice(0, 6)}...{address.slice(-4)}
</span>
```

### Chain Switcher

```tsx
<div role="listbox" aria-label="Select network">
  {chains.map((chain) => (
    <button
      key={chain.id}
      role="option"
      aria-selected={chain.id === currentChainId}
      onClick={() => switchChain({ chainId: chain.id })}
    >
      {chain.name}
    </button>
  ))}
</div>
```

## References

- WCAG 2.1 AA: https://www.w3.org/WAI/WCAG21/quickref/
- WAI-ARIA Practices: https://www.w3.org/WAI/ARIA/apg/
- Touch Target Size (WCAG 2.5.5): https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
