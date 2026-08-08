"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Bell, Menu, Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function TopNav() {
  const { profile, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq("is_read", false);
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // Subscribe to real-time notifications
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchUnreadCount()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-[#F7F7F8]/80 dark:bg-[#090909]/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Menu button */}
        <button className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] shadow-sm flex items-center justify-center hover:shadow-md transition-shadow">
          <Menu className="w-5 h-5 text-[#8A8A8A]" />
        </button>

        {/* Center: Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">R</span>
          </div>
          <span className="font-bold text-base">Rewardly</span>
        </div>

        {/* Right: Theme toggle + Notifications + Profile */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] shadow-sm flex items-center justify-center hover:shadow-md transition-shadow"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-yellow-500" />
            ) : (
              <Moon className="w-4 h-4 text-purple-500" />
            )}
          </button>
          <button
            onClick={() => router.push("/notifications")}
            className="relative w-10 h-10 rounded-full bg-white dark:bg-[#161616] shadow-sm flex items-center justify-center hover:shadow-md transition-shadow"
          >
            <Bell className="w-5 h-5 text-[#8A8A8A]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => router.push("/profile")}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm hover:shadow-md transition-shadow"
          >
            {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </button>
        </div>
      </div>
    </div>
  );
}