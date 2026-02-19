"use client";

import { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";

export default function LocaleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-navy-950">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto px-6 py-8">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
