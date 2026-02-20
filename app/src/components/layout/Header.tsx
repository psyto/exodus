"use client";

import { FC, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/providers/I18nProvider";
import { WalletButton } from "./WalletButton";

export const Header: FC = () => {
  const { t, locale, setLocale } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleLocale = () => {
    setLocale(locale === "ja" ? "en" : "ja");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gold-500/20 bg-navy-900/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="inline-flex items-center justify-center rounded-lg p-2 text-gray-300 hover:bg-navy-800 hover:text-gold-400 lg:hidden"
          aria-label="Toggle sidebar"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-wider text-gold-400">
            {t("common.appName")}
          </span>
        </Link>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {/* Locale Switcher */}
          <button
            onClick={toggleLocale}
            className="rounded-lg border border-navy-700 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-gold-500/50 hover:text-gold-400"
            aria-label="Toggle language"
          >
            {locale === "ja" ? "EN" : "JP"}
          </button>

          {/* Wallet Button */}
          <WalletButton />
        </div>
      </div>
    </header>
  );
};
