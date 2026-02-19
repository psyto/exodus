"use client";

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";

const footerLinks = [
  { label: "Docs", href: "https://docs.exodus.protocol" },
  { label: "GitHub", href: "https://github.com/exodus-protocol" },
  { label: "Support", href: "https://support.exodus.protocol" },
] as const;

export const Footer: FC = () => {
  const { t } = useI18n();

  return (
    <footer className="border-t border-gold-500/20 bg-navy-900">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
        {/* Left - Brand and copyright */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-wider text-gold-400">
            {t("common.appName")} Protocol
          </span>
          <span className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()}
          </span>
        </div>

        {/* Center - Links */}
        <nav className="flex items-center gap-6">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 transition-colors hover:text-gold-400"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right - Built on Solana badge */}
        <div className="flex items-center gap-2 rounded-full border border-navy-700 bg-navy-800/50 px-3 py-1">
          <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-green-400" />
          <span className="text-xs font-medium text-gray-400">
            Built on Solana
          </span>
        </div>
      </div>
    </footer>
  );
};
