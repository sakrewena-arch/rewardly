"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  invested_capital: number;
  total_earnings: number;
  locked_amount: number;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  type: "deposit" | "withdrawal" | "reward" | "investment" | "bonus" | "referral" | "admin_adjustment";
  description: string | null;
  reference: string | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
}

export function useWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !user) {
      setWallet(null);
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data: walletData } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (walletData) {
        setWallet(walletData as Wallet);
      }

      const { data: txData } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (txData) {
        setTransactions(txData as Transaction[]);
      }
    } catch (error) {
      console.error("Error fetching wallet:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const addReward = useCallback(async (amount: number, description: string) => {
    if (!user) return;
    const supabase = createClient();
    if (!supabase) return;

    try {
      const { data, error } = await supabase.rpc("add_reward", {
        p_user_id: user.id,
        p_amount: amount,
        p_description: description,
      });

      if (error) {
        console.error("Failed to persist reward to Supabase:", error);
        return;
      }

      // Refetch wallet to get updated balance
      await fetchWallet();
    } catch (e) {
      console.error("Failed to add reward:", e);
    }
  }, [user, fetchWallet]);

  // ============================================================
  // CALCUL DU MONTANT RETIRABLE (via RPC serveur)
  // ============================================================
  // SEULS LES GAINS (rewards/bonus/referrals) sont retirables,
  // PAS les dépôts ni le capital investi.
  //
  // Le calcul est fait côté serveur via la RPC get_withdrawable_amount
  // pour garantir la cohérence avec la logique SQL de submit_withdrawal.
  // ============================================================
  const [withdrawableAmount, setWithdrawableAmount] = useState(0);

  const fetchWithdrawableAmount = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !user) {
      setWithdrawableAmount(0);
      return;
    }

    try {
      // 1. Montant retirable via la RPC (gains bruts)
      const { data } = await supabase.rpc("get_withdrawable_amount", {
        p_user_id: user.id,
      });

      // 2. Soustraire les retraits en attente (pending) du montant retirable
      const { data: pendingWithdrawals } = await supabase
        .from("withdrawals")
        .select("amount")
        .eq("user_id", user.id)
        .in("status", ["pending", "approved"]);

      const pendingAmount = (pendingWithdrawals || []).reduce((sum: number, w: any) => sum + (w.amount || 0), 0);

      // 3. Soustraire les paiements de services (montants négatifs) du montant retirable
      const { data: servicePayments } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("type", "service");

      const serviceAmount = (servicePayments || []).reduce((sum: number, t: any) => sum + Math.abs(t.amount || 0), 0);

      // 4. Le montant retirable = gains bruts - retraits en attente - paiements services
      const raw = Number(data?.withdrawable_amount) || 0;
      setWithdrawableAmount(Math.max(0, raw - pendingAmount - serviceAmount));
    } catch (error) {
      console.error("Error fetching withdrawable amount:", error);
      setWithdrawableAmount(0);
    }
  }, [user]);

  useEffect(() => {
    fetchWithdrawableAmount();
  }, [fetchWithdrawableAmount]);

  const refreshWallet = useCallback(async () => {
    await fetchWallet();
    await fetchWithdrawableAmount();
  }, [fetchWallet, fetchWithdrawableAmount]);

  return { wallet, transactions, isLoading, withdrawableAmount, refreshWallet, addReward };
}