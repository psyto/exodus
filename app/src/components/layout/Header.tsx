"use client";

import { FC, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/providers/I18nProvider";
import { WalletButton } from "./WalletButton";

const navItems = [
  { key: "overview", path: "dashboard" },
  { key: "deposit", path: "dashboard/deposit" },
  { key: "withdraw", path: "dashboard/withdraw" },
  { key: "yield", path: "dashboard/yield" },
  { key: "history", path: "dashboard/history" },
] as const;

export const Header: FC = () => {
  const { t, locale, setLocale } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hrefFor = (path: string) => `/${locale}/${path}`;

  const toggleLocale = () => {
    setLocale(locale === "ja" ? "en" : "ja");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gold-500/20 bg-navy-900/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-wider text-gold-400">
            {t("common.appName")}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={hrefFor(item.path)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-navy-800 hover:text-gold-400"
            >
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>

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
          <div className="hidden sm:block">
            <WalletButton />
          </div>

          {/* Mobile Hamburger Menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-300 hover:bg-navy-800 hover:text-gold-400 md:hidden"
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
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
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-navy-700 bg-navy-900 md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={hrefFor(item.path)}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-navy-800 hover:text-gold-400"
              >
                {t(`nav.${item.key}`)}
              </Link>
            ))}
            <div className="mt-2 border-t border-navy-700 pt-3 sm:hidden">
              <WalletButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
