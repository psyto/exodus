"use client";

import { FC, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useI18n } from "@/providers/I18nProvider";
import { shortenAddress } from "@/lib/format";

export const WalletButton: FC = () => {
  const { t } = useI18n();
  const { publicKey, connected } = useWallet();

  const displayAddress = useMemo(() => {
    if (!publicKey) return null;
    return shortenAddress(publicKey.toBase58());
  }, [publicKey]);

  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton
        className={`
          !rounded-lg !border !border-gold-500/30 !bg-navy-800 !px-4 !py-2
          !text-sm !font-medium !text-gold-400 !shadow-none
          !transition-all !duration-200
          hover:!border-gold-500/60 hover:!bg-navy-700
          ${connected ? "!pr-4" : ""}
        `}
      >
        {connected && displayAddress ? (
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            <span>{displayAddress}</span>
          </span>
        ) : (
          <span>{t("common.connect")}</span>
        )}
      </WalletMultiButton>

      {/* Override default wallet-adapter styles */}
      <style jsx global>{`
        .wallet-button-wrapper .wallet-adapter-button {
          background-color: transparent !important;
          font-family: inherit !important;
          height: auto !important;
          line-height: normal !important;
        }
        .wallet-button-wrapper .wallet-adapter-button:hover {
          background-color: transparent !important;
        }
        .wallet-button-wrapper .wallet-adapter-button-start-icon {
          display: none !important;
        }
      `}</style>
    </div>
  );
};
