"use client";

import Link from "next/link";
import { useI18n } from "@/providers/I18nProvider";
import { useConversionRate } from "@/hooks/useConversionRate";
import { WalletButton } from "@/components/layout/WalletButton";
import { formatRate, formatAPY } from "@/lib/format";

export default function LandingPage() {
  const { t, locale, setLocale } = useI18n();
  const { rate } = useConversionRate();

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Header */}
      <header className="border-b border-navy-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-2xl font-bold text-gold-400">EXODUS</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              {locale === "ja" ? "EN" : "JP"}
            </button>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-24 text-center">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-5xl font-bold leading-tight">
            <span className="text-gold-400">{t("landing.hero")}</span>
          </h2>
          <p className="mb-8 text-xl text-navy-300">{t("landing.subtitle")}</p>

          {/* Live Stats */}
          <div className="mb-12 flex justify-center gap-8">
            <div className="card px-8 py-4">
              <div className="stat-label">{t("landing.exchangeRate")}</div>
              <div className="stat-value text-white">
                {rate ? formatRate(rate.jpyPerUsd * 1_000_000) : "---"}
              </div>
            </div>
            <div className="card px-8 py-4">
              <div className="stat-label">{t("landing.currentApy")}</div>
              <div className="stat-value text-accent-green">
                {formatAPY(450)}
              </div>
            </div>
          </div>

          <Link href={`/${locale}/dashboard`}>
            <button className="btn-primary px-10 py-4 text-lg">
              {t("common.getStarted")}
            </button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-navy-900/50 px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          {[
            {
              title: t("landing.feature1Title"),
              desc: t("landing.feature1Desc"),
              icon: "shield",
            },
            {
              title: t("landing.feature2Title"),
              desc: t("landing.feature2Desc"),
              icon: "chart",
            },
            {
              title: t("landing.feature3Title"),
              desc: t("landing.feature3Desc"),
              icon: "lock",
            },
          ].map((feature) => (
            <div key={feature.icon} className="card-hover text-center">
              <div className="mb-4 text-4xl">
                {feature.icon === "shield"
                  ? "\u{1F6E1}"
                  : feature.icon === "chart"
                    ? "\u{1F4C8}"
                    : "\u{1F512}"}
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gold-400">
                {feature.title}
              </h3>
              <p className="text-navy-300">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h3 className="mb-12 text-center text-3xl font-bold text-white">
            {t("landing.howItWorks")}
          </h3>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: "01", label: t("landing.step1"), color: "text-accent-blue" },
              { step: "02", label: t("landing.step2"), color: "text-gold-400" },
              { step: "03", label: t("landing.step3"), color: "text-accent-green" },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div
                  className={`mb-4 text-5xl font-bold font-mono ${s.color}`}
                >
                  {s.step}
                </div>
                <p className="text-lg text-navy-200">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-navy-800 px-6 py-8 text-center text-navy-400">
        <p>EXODUS Protocol &copy; {new Date().getFullYear()}</p>
        <p className="mt-1 text-sm">Built on Solana</p>
      </footer>
    </div>
  );
}
