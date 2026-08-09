"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import WelcomePopup from "@/components/features/WelcomePopup";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909] pb-32 overflow-guard">
      {children}
      <BottomNav />
      <WelcomePopup />
    </div>
  );
}
