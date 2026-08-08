"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Send, Bell, Trash2, CheckCircle, Users, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUsers } from "@/actions/admin-actions";

interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface UserData {
  user_id: string;
  email: string;
  full_name: string | null;
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [target, setTarget] = useState<"all" | "user">("all");
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadNotifications = async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
    getUsers().then((data) => {
      setUsers((data || []).map((u: any) => ({
        user_id: u.user_id,
        email: u.email,
        full_name: u.full_name,
      })));
    });
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      setFeedback("Le titre et le message sont requis.");
      return;
    }

    setSending(true);
    setFeedback(null);

    try {
      const supabase = createClient();
      if (!supabase) {
        setFeedback("Supabase non configuré.");
        setSending(false);
        return;
      }

      // Ajouter le lien au message avec un marqueur pour l'affichage cliquable
      const finalMessage = link.trim()
        ? `${message.trim()}\n[LINK]${link.trim()}[/LINK]`
        : message.trim();

      if (target === "all") {
        // Notifications globales (user_id = null)
        const { error } = await supabase.from("notifications").insert({
          user_id: null,
          title: title.trim(),
          message: finalMessage,
          type: "admin",
          is_read: false,
        });
        if (error) throw error;
      } else {
        // Envoyer à un utilisateur spécifique
        if (!selectedUser) {
          setFeedback("Veuillez sélectionner un utilisateur.");
          setSending(false);
          return;
        }
        const { error } = await supabase.from("notifications").insert({
          user_id: selectedUser,
          title: title.trim(),
          message: finalMessage,
          type: "admin",
          is_read: false,
        });
        if (error) throw error;
      }

      setFeedback("Notification envoyée avec succès !");
      setTitle("");
      setMessage("");
      setLink("");
      setTarget("all");
      setSelectedUser("");
      loadNotifications();
    } catch (e: any) {
      setFeedback(`Erreur: ${e.message || "Erreur inconnue"}`);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette notification ?")) return;
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("notifications").delete().eq("id", id);
    loadNotifications();
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909]">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Notifications</h1>
            <p className="text-[#8A8A8A] text-sm">{notifications.length} notifications</p>
          </div>
        </div>

        {feedback && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.includes("Erreur") ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
            {feedback}
          </div>
        )}

        {/* Send Notification */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Send className="w-4 h-4" /> Envoyer une notification</h2>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cible</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTarget("all")}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${target === "all" ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-gray-200 dark:border-gray-700"}`}
                >
                  <div className="flex items-center gap-2"><Users className="w-4 h-4" /><span className="text-sm font-medium">Tous les utilisateurs</span></div>
                </button>
                <button
                  onClick={() => setTarget("user")}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${target === "user" ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-gray-200 dark:border-gray-700"}`}
                >
                  <div className="flex items-center gap-2"><User className="w-4 h-4" /><span className="text-sm font-medium">Utilisateur spécifique</span></div>
                </button>
              </div>
            </div>

            {target === "user" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Sélectionner un utilisateur</label>
                <select
                  className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">Choisir un utilisateur</option>
                  {users.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Titre</label>
              <Input placeholder="Ex: Nouvelle tâche disponible" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <textarea
                className="w-full min-h-[80px] rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                placeholder="Votre message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                Lien <span className="text-xs text-[#8A8A8A] font-normal">(optionnel)</span>
              </label>
              <Input
                placeholder="Ex: https://whatsapp.com/channel/..., https://mon-site.com/... "
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
              <p className="text-xs text-[#8A8A8A]">
                Les utilisateurs verront un bouton cliquable vers ce lien dans leur notification.
              </p>
            </div>

            <Button onClick={handleSend} disabled={sending}>
              <Send className="w-4 h-4 mr-2" />
              {sending ? "Envoi..." : "Envoyer la notification"}
            </Button>
          </CardContent>
        </Card>

        {/* Notification History */}
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Bell className="w-4 h-4" /> Historique des notifications</h2>

            {loading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-[#8A8A8A]">Aucune notification envoyée</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{n.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${n.user_id === null ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {n.user_id === null ? "Global" : "Spécifique"}
                        </span>
                      </div>
                      <p className="text-sm text-[#8A8A8A] mt-1">
                        {n.message.replace(/\[LINK\][^\]]*\[\/LINK\]/g, "").trim()}
                      </p>
                      <p className="text-xs text-[#8A8A8A] mt-1">{formatDate(n.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <CheckCircle className={`w-4 h-4 ${n.is_read ? "text-green-500" : "text-yellow-500"}`} />
                      <button onClick={() => handleDelete(n.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}