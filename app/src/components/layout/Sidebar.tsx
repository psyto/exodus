"use client";

import { FC } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/providers/I18nProvider";

interface NavItem {
  key: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { key: "overview", href: "/dashboard", icon: "[=]" },
  { key: "deposit", href: "/dashboard/deposit", icon: "[+]" },
  { key: "withdraw", href: "/dashboard/withdraw", icon: "[-]" },
  { key: "yield", href: "/dashboard/yield", icon: "[%]" },
  { key: "history", href: "/dashboard/history", icon: "[#]" },
  { key: "admin", href: "/dashboard/admin", icon: "[*]" },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export const Sidebar: FC<SidebarProps> = ({ collapsed = false, onToggle }) => {
  const { t } = useI18n();
  const pathname = usePathname();

  const isActive = (href: string): boolean => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/dashboard/";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-64 flex-col
          border-r border-gold-500/20 bg-navy-900 transition-transform duration-300
          lg:static lg:z-auto lg:translate-x-0
          ${collapsed ? "-translate-x-full" : "translate-x-0"}
        `}
      >
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={onToggle}
                    className={`
                      relative flex items-center gap-3 rounded-lg px-3 py-2.5
                      text-sm font-medium transition-colors
                      ${
                        active
                          ? "bg-gold-500/10 text-gold-400"
                          : "text-gray-400 hover:bg-navy-800 hover:text-gray-200"
                      }
                    `}
                  >
                    {/* Active indicator - gold left border */}
                    {active && (
                      <span className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-0.5 rounded-r bg-gold-400" />
                    )}

                    {/* Icon */}
                    <span
                      className={`
                        flex h-8 w-8 items-center justify-center rounded-md text-xs font-mono
                        ${
                          active
                            ? "bg-gold-500/20 text-gold-400"
                            : "bg-navy-800 text-gray-500"
                        }
                      `}
                    >
                      {item.icon}
                    </span>

                    {/* Label */}
                    <span>{t(`nav.${item.key}`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-navy-700 px-4 py-4">
          <div className="rounded-lg bg-navy-800/50 px-3 py-2.5">
            <p className="text-xs font-medium text-gray-500">
              {t("common.tagline")}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
