"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { mainnet, base, arbitrum, optimism, polygon } from "viem/chains";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
          // logo: "https://your-app.com/logo.png",
        },
        loginMethods: ["email", "google", "passkey", "wallet"],
        embeddedWallets: {
          // 'all-users' creates embedded wallet for every user including those
          // who connect with an external wallet. Use 'users-without-wallets'
          // to skip wallet creation for MetaMask/Coinbase users.
          // IMPORTANT: if supporting Farcaster login, use 'all-users' --
          // Farcaster custody wallets are not usable in-browser.
          createOnLogin: "all-users",
          requireUserPasswordOnCreate: false,
        },
        // Safe-based smart wallet with gas sponsorship
        // Configure gas policies in the Privy dashboard
        smartWallets: {
          enabled: true,
        },
        defaultChain: base,
        supportedChains: [mainnet, base, arbitrum, optimism, polygon],
        // WalletConnect support for external mobile wallets
        // Get a project ID from cloud.walletconnect.com
        // externalWallets: {
        //   walletConnect: {
        //     projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
        //   },
        // },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
