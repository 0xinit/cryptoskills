# Social Login with Privy

Working TypeScript/React example for a Next.js app with Google and email login, displaying authenticated user state and embedded wallet address.

## Dependencies

```bash
npm install @privy-io/react-auth next react react-dom
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id  # From dashboard.privy.io
```

## Provider Setup

```tsx
// app/providers.tsx
"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { mainnet, base } from "viem/chains";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
          logo: "https://your-app.com/logo.png",
        },
        loginMethods: ["email", "google"],
        embeddedWallets: {
          createOnLogin: "all-users",
          requireUserPasswordOnCreate: false,
        },
        defaultChain: base,
        supportedChains: [mainnet, base],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

## Layout

```tsx
// app/layout.tsx
import { Providers } from "./providers";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Login Page

```tsx
// app/page.tsx
"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";

export default function Home() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();

  if (!ready) {
    return <div>Loading Privy...</div>;
  }

  if (!authenticated) {
    return (
      <div>
        <h1>Welcome</h1>
        <p>Sign in with your email or Google account.</p>
        <button onClick={login}>Log In</button>
      </div>
    );
  }

  const embeddedWallet = wallets.find(
    (w) => w.walletClientType === "privy"
  );

  const displayEmail = user?.email?.address;
  const displayGoogle = user?.google?.email;

  return (
    <div>
      <h1>Dashboard</h1>

      <section>
        <h2>Account</h2>
        <dl>
          <dt>User ID</dt>
          <dd>{user?.id}</dd>

          {displayEmail && (
            <>
              <dt>Email</dt>
              <dd>{displayEmail}</dd>
            </>
          )}

          {displayGoogle && (
            <>
              <dt>Google</dt>
              <dd>{displayGoogle}</dd>
            </>
          )}

          <dt>Linked accounts</dt>
          <dd>{user?.linkedAccounts.length ?? 0}</dd>
        </dl>
      </section>

      <section>
        <h2>Embedded Wallet</h2>
        {!walletsReady ? (
          <p>Loading wallet...</p>
        ) : embeddedWallet ? (
          <dl>
            <dt>Address</dt>
            <dd><code>{embeddedWallet.address}</code></dd>
            <dt>Chain ID</dt>
            <dd>{embeddedWallet.chainId}</dd>
          </dl>
        ) : (
          <p>No embedded wallet found.</p>
        )}
      </section>

      <button onClick={logout}>Log Out</button>
    </div>
  );
}
```

## Notes

- The `PrivyProvider` must be in a Client Component (`"use client"`) for Next.js App Router.
- `createOnLogin: 'all-users'` creates an embedded wallet for every user, including those who logged in with an external wallet. Use `'users-without-wallets'` to skip wallet creation for users connecting MetaMask, etc.
- The login modal appearance (theme, accent color, logo) is configured in the `appearance` object. You can also configure this in the Privy dashboard.
- Always check `ready` from both `usePrivy()` and `useWallets()` before rendering wallet-dependent UI.
- HTTPS is required in production. `localhost` works for local development.
