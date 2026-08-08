"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Bot, User, Mail, Headphones, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

interface Message {
  role: "user" | "bot";
  content: string;
}

// Base de connaissances de l'assistant IA
const knowledgeBase: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["bonjour", "salut", "hello", "bonsoir"],
    answer: "Bonjour ! 👋 Je suis l'assistant Rewardly. Comment puis-je vous aider ? Vous pouvez me poser des questions sur les tâches, les dépôts, les retraits, les packs, le parrainage, etc.",
  },
  {
    keywords: ["tache", "tâche", "mission", "gagner", "argent"],
    answer: "💰 Pour gagner de l'argent sur Rewardly :\n1. Activez un pack (Bronze, Silver ou Gold)\n2. Allez dans l'onglet 'Tâches'\n3. Accomplissez les missions (visites, sondages, tests)\n4. Chaque tâche vous crédite le montant indiqué\n\nLes gains proviennent des entreprises qui paient pour leur publicité !",
  },
  {
    keywords: ["depot", "dépôt", "recharger", "payer"],
    answer: "💳 Pour faire un dépôt :\n1. Allez dans l'onglet 'Dépôt'\n2. Choisissez votre opérateur (MTN, Orange, Wave, Moov...)\n3. Entrez le montant (minimum 5 000 FCFA)\n4. Confirmez le paiement sur votre téléphone\n5. Votre wallet est crédité automatiquement !",
  },
  {
    keywords: ["retrait", "retirer", "retirable", "retirer argent"],
    answer: "🏧 Pour retirer vos gains :\n1. Allez dans l'onglet 'Retrait'\n2. Choisissez votre opérateur\n3. Entrez le montant à retirer\n4. La demande est envoyée à l'admin\n5. L'argent est envoyé sur votre numéro via FeeXPay\n\n⚠️ Seuls les gains de tâches sont retirables (pas le capital investi).",
  },
  {
    keywords: ["pack", "plan", "bronze", "silver", "gold", "activer"],
    answer: "📦 Les packs Rewardly :\n• Bronze : 5 000 FCFA → 1 tâche/jour\n• Silver : 10 000 FCFA → 3 tâches/jour\n• Gold : 20 000 FCFA → Tâches illimitées\n\nLe pack est un engagement de motivation. Plus le pack est élevé, plus les tâches sont rémunératrices !",
  },
  {
    keywords: ["parrain", "parrainage", "filleul", "inviter", "referral"],
    answer: "🤝 Le parrainage :\n1. Partagez votre code de parrainage (dans l'onglet 'Parrainage')\n2. Quand quelqu'un s'inscrit avec votre code, vous gagnez une commission\n3. Vous pouvez aussi partager votre QR code\n4. Plus vous parrainez, plus vous gagnez !",
  },
  {
    keywords: ["solde", "balance", "wallet", "compte"],
    answer: "👛 Votre wallet :\n• Balance : votre solde total\n• Gains : vos gains de tâches\n• Retirable : ce que vous pouvez retirer\n\nVous pouvez voir ces informations dans votre profil ou le tableau de bord.",
  },
  {
    keywords: ["service", "publicité", "promouvoir", "entreprise", "annonce"],
    answer: "📢 Pour promouvoir votre entreprise :\n1. Allez dans 'Nos services'\n2. Choisissez un pack publicitaire (500k, 1M, 2M)\n3. Décrivez votre besoin (sondage, visite, test...)\n4. Payez avec votre wallet\n5. Nous créons la mission pour nos utilisateurs !",
  },
  {
    keywords: ["mot de passe", "password", "oublié", "changer"],
    answer: "🔑 Pour changer votre mot de passe :\n1. Allez dans 'Profil' → 'Sécurité'\n2. Entrez votre nouveau mot de passe\n3. Confirmez\n\nSi vous avez oublié votre mot de passe, utilisez 'Mot de passe oublié' sur la page de connexion.",
  },
  {
    keywords: ["installer", "application", "app", "telecharger", "télécharger", "android", "ios", "windows"],
    answer: "📱 Pour installer l'application Rewardly :\n1. Allez dans la page 'Télécharger l'application'\n2. Suivez les instructions selon votre appareil (Android, iOS, Windows)\n3. L'application s'installe comme une application native\n\nC'est une PWA (Progressive Web App) qui fonctionne hors ligne !",
  },
  {
    keywords: ["contact", "operateur", "opérateur", "humain", "assistance", "probleme", "problème", "erreur"],
    answer: "🎧 Si vous avez besoin d'aide supplémentaire, vous pouvez nous contacter par email :\n\n📧 rewardlyfree@gmail.com\n\nNous vous répondrons dans les plus brefs délais !",
  },
  {
    keywords: ["merci", "ok", "d'accord", "super", "parfait"],
    answer: "Avec plaisir ! 😊 N'hésitez pas si vous avez d'autres questions. Bonne chance sur Rewardly !",
  },
];

const fallbackAnswer = "Je n'ai pas trouvé de réponse à votre question. 🤔 Pour une assistance personnalisée, veuillez nous contacter par email :\n\n📧 rewardlyfree@gmail.com\n\nUn opérateur vous répondra rapidement !";

function getBotAnswer(question: string): string {
  const lower = question.toLowerCase();
  for (const item of knowledgeBase) {
    if (item.keywords.some((k) => lower.includes(k))) {
      return item.answer;
    }
  }
  return fallbackAnswer;
}

export default function ContactPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content: "Bonjour ! 👋 Je suis l'assistant virtuel de Rewardly. Posez-moi une question sur les tâches, dépôts, retraits, packs, parrainage... Je vous répondrai instantanément !",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setTyping(true);
    // Simuler la réponse de l'IA
    setTimeout(() => {
      const answer = getBotAnswer(userMessage);
      setMessages((prev) => [...prev, { role: "bot", content: answer }]);
      setTyping(false);
    }, 800);
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6 overflow-guard">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Nous contacter</h1>
          <p className="text-[#8A8A8A] text-sm">Assistant virtuel + support</p>
        </div>
      </div>

      {/* Assistant IA */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-0">
            {/* Header assistant */}
            <div className="card-gradient p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white flex items-center gap-2">
                  Assistant Rewardly <Sparkles className="w-3 h-3 text-yellow-300" />
                </p>
                <p className="text-white/70 text-xs">En ligne • Réponse instantanée</p>
              </div>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white rounded-br-sm"
                      : "bg-gray-100 dark:bg-white/5 rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-white/5 p-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex gap-2">
                <Input
                  placeholder="Posez votre question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <Button onClick={handleSend} disabled={!input.trim() || typing}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Contact par email */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Headphones className="w-4 h-4" /> Parler à un opérateur</h2>
            <p className="text-sm text-[#8A8A8A]">
              Si l'assistant ne peut pas répondre à votre question, contactez-nous par email. Un opérateur vous répondra rapidement.
            </p>
            <a
              href="mailto:rewardlyfree@gmail.com"
              className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-500/10 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-sm">rewardlyfree@gmail.com</p>
                <p className="text-xs text-[#8A8A8A]">Cliquez pour nous envoyer un email</p>
              </div>
            </a>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}