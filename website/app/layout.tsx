import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "CryptoSkills — Agent Skills for All of Crypto",
    template: "%s | CryptoSkills",
  },
  description:
    "Open-source agent skills directory covering 93 protocols across Ethereum, Solana, L2s, DeFi, NFTs, and more. Production-ready code for AI coding agents.",
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
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
