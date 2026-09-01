"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bell, CheckCheck, Gift, Wallet, TrendingUp, Shield, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { NotificationsAuth } from "@/components/features/AuthRequiredPages";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, any> = {
  deposit: Wallet,
  withdrawal: TrendingUp,
  task: CheckCheck,
  reward: Gift,
  investment: TrendingUp,
  promotion: Bell,
  admin: Shield,
  referral: MessageCircle,
};

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !user) {
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications(data || []);
      setLoading(false);
    };

    fetchNotifications();

    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = async () => {
    const supabase = createClient();
    if (!supabase || !user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Extraire un éventuel lien [LINK]url[/LINK] présent dans le message
  const parseLink = (message: string): { text: string; url: string | null } => {
    const match = message.match(/\[LINK\]([^\]]*)\[\/LINK\]/);
    if (match) {
      return {
        text: message.replace(/\[LINK\][^\]]*\[\/LINK\]/g, "").trim(),
        url: match[1].trim(),
      };
    }
    return { text: message, url: null };
  };

  const normalizeUrl = (url: string): string => {
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Notifications</h1>
            <p className="text-[#8A8A8A] text-sm">{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            <CheckCheck className="w-3 h-3 mr-1" /> Tout marquer lu
          </Button>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-[#8A8A8A] text-sm">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification, index) => {
            const Icon = typeIcons[notification.type] || Bell;
            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <button
                  onClick={() => markRead(notification.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    notification.is_read
                      ? "bg-white dark:bg-[#161616] border-gray-100 dark:border-gray-800"
                      : "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      notification.is_read
                        ? "bg-gray-100 dark:bg-gray-800"
                        : "bg-purple-100 dark:bg-purple-500/20"
                    }`}>
                      <Icon className={`w-4 h-4 ${notification.is_read ? "text-[#8A8A8A]" : "text-purple-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`text-sm font-medium truncate-2 ${notification.is_read ? "text-[#8A8A8A]" : ""}`}>
                          {notification.title}
                        </h3>
                        <span className="text-xs text-[#8A8A8A] whitespace-nowrap flex-shrink-0">
                          {formatDate(notification.created_at, "relative")}
                        </span>
                      </div>
                      <p className={`text-sm mt-0.5 text-safe break-words ${notification.is_read ? "text-[#8A8A8A]" : "text-[#111111] dark:text-white"}`}>
                        {parseLink(notification.message).text}
                      </p>
                      {parseLink(notification.message).url && (
                        <a
                          href={normalizeUrl(parseLink(notification.message).url!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => markRead(notification.id)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700"
                        >
                          Voir le lien <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}