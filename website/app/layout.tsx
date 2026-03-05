import type { Metadata } from "next";
import { Unbounded, JetBrains_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const unbounded = Unbounded({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CryptoSkills — Agent Skills for All of Crypto",
    template: "%s | CryptoSkills",
  },
  description:
    "Open-source agent skills directory covering 96 protocols across Ethereum, Solana, L2s, DeFi, NFTs, and more. Production-ready code for AI coding agents.",
  metadataBase: new URL("https://cryptoskills.sh"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "CryptoSkills",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${unbounded.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
