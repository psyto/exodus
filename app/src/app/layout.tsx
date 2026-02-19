import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/WalletProvider";
import { ExodusProvider } from "@/providers/ExodusProvider";
import { I18nProvider } from "@/providers/I18nProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EXODUS Protocol — Digital Dollar Yield for Japan",
  description:
    "Compliant JPY→USDC conversion with T-Bill yield. Access U.S. Treasury Bill yields from Japan's regulated stablecoin rails.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body className={inter.className}>
        <WalletProvider>
          <ExodusProvider>
            <I18nProvider>{children}</I18nProvider>
          </ExodusProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
