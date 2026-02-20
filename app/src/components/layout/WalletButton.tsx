"use client";

import { FC, useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import with ssr:false — WalletMultiButton detects browser
// wallets on the client, which causes a hydration mismatch if server-rendered.
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export const WalletButton: FC = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Placeholder with matching dimensions to avoid layout shift
    return (
      <button
        className="rounded-lg border border-gold-500/30 bg-navy-800 px-4 py-2 text-sm font-medium text-gold-400"
        disabled
      >
        ...
      </button>
    );
  }

  return (
    <WalletMultiButton
      className="!rounded-lg !border !border-gold-500/30 !bg-navy-800 !px-4 !py-2 !text-sm !font-medium !text-gold-400 !shadow-none !transition-all !duration-200 hover:!border-gold-500/60 hover:!bg-navy-700"
    />
  );
};
