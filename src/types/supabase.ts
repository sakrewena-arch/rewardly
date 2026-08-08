export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          username: string | null;
          avatar_url: string | null;
          phone: string | null;
          referral_code: string | null;
          referred_by: string | null;
          role: 'user' | 'moderator' | 'admin' | 'super_admin';
          is_active: boolean;
          is_banned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          role?: 'user' | 'moderator' | 'admin' | 'super_admin';
          is_active?: boolean;
          is_banned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          role?: 'user' | 'moderator' | 'admin' | 'super_admin';
          is_active?: boolean;
          is_banned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          balance: number;
          invested_capital: number;
          total_earnings: number;
          locked_amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          balance?: number;
          invested_capital?: number;
          total_earnings?: number;
          locked_amount?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          balance?: number;
          invested_capital?: number;
          total_earnings?: number;
          locked_amount?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      wallet_transactions: {
        Row: {
          id: string;
          user_id: string;
          wallet_id: string;
          amount: number;
          type: 'deposit' | 'withdrawal' | 'reward' | 'investment' | 'bonus' | 'referral' | 'admin_adjustment';
          description: string | null;
          reference: string | null;
          status: 'pending' | 'completed' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          wallet_id: string;
          amount: number;
          type: 'deposit' | 'withdrawal' | 'reward' | 'investment' | 'bonus' | 'referral' | 'admin_adjustment';
          description?: string | null;
          reference?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          wallet_id?: string;
          amount?: number;
          type?: 'deposit' | 'withdrawal' | 'reward' | 'investment' | 'bonus' | 'referral' | 'admin_adjustment';
          description?: string | null;
          reference?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
        };
      };
      plans: {
        Row: {
          id: string;
          name: string;
          slug: string;
          price: number;
          daily_tasks: number;
          min_profitability: number;
          max_profitability: number;
          color: string;
          icon: string;
          badge: string;
          is_active: boolean;
          sort_order: number;
          allow_upgrade: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          price: number;
          daily_tasks: number;
          min_profitability: number;
          max_profitability: number;
          color?: string;
          icon?: string;
          badge?: string;
          is_active?: boolean;
          sort_order?: number;
          allow_upgrade?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          price?: number;
          daily_tasks?: number;
          min_profitability?: number;
          max_profitability?: number;
          color?: string;
          icon?: string;
          badge?: string;
          is_active?: boolean;
          sort_order?: number;
          allow_upgrade?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      investments: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          wallet_id: string;
          amount: number;
          status: 'active' | 'completed' | 'cancelled';
          start_date: string;
          end_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          wallet_id: string;
          amount: number;
          status?: 'active' | 'completed' | 'cancelled';
          start_date: string;
          end_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          wallet_id?: string;
          amount?: number;
          status?: 'active' | 'completed' | 'cancelled';
          start_date?: string;
          end_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      task_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          icon?: string;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          image_url: string | null;
          icon: string | null;
          amount: number;
          estimated_time: number | null;
          instructions: string | null;
          link: string | null;
          max_completions: number | null;
          duration_minutes: number | null;
          deadline: string | null;
          category_id: string | null;
          plan_id: string | null;
          validation_type: 'auto' | 'manual';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          image_url?: string | null;
          icon?: string | null;
          amount: number;
          estimated_time?: number | null;
          instructions?: string | null;
          link?: string | null;
          max_completions?: number | null;
          duration_minutes?: number | null;
          deadline?: string | null;
          category_id?: string | null;
          plan_id?: string | null;
          validation_type?: 'auto' | 'manual';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          image_url?: string | null;
          icon?: string | null;
          amount?: number;
          estimated_time?: number | null;
          instructions?: string | null;
          link?: string | null;
          max_completions?: number | null;
          duration_minutes?: number | null;
          deadline?: string | null;
          category_id?: string | null;
          plan_id?: string | null;
          validation_type?: 'auto' | 'manual';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      submission_fields: {
        Row: {
          id: string;
          task_id: string;
          title: string;
          description: string | null;
          field_type: 'text' | 'number' | 'email' | 'url' | 'image' | 'screenshot' | 'video' | 'file' | 'telegram' | 'whatsapp';
          is_required: boolean;
          placeholder: string | null;
          max_size: number | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          title: string;
          description?: string | null;
          field_type: 'text' | 'number' | 'email' | 'url' | 'image' | 'screenshot' | 'video' | 'file' | 'telegram' | 'whatsapp';
          is_required?: boolean;
          placeholder?: string | null;
          max_size?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          title?: string;
          description?: string | null;
          field_type?: 'text' | 'number' | 'email' | 'url' | 'image' | 'screenshot' | 'video' | 'file' | 'telegram' | 'whatsapp';
          is_required?: boolean;
          placeholder?: string | null;
          max_size?: number | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      task_submissions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          status: 'pending' | 'approved' | 'rejected';
          admin_comment: string | null;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          status?: 'pending' | 'approved' | 'rejected';
          admin_comment?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          status?: 'pending' | 'approved' | 'rejected';
          admin_comment?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      submission_answers: {
        Row: {
          id: string;
          submission_id: string;
          field_id: string;
          value: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          field_id: string;
          value: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          field_id?: string;
          value?: string;
          created_at?: string;
        };
      };
      deposits: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          method: string;
          reference: string | null;
          proof_url: string | null;
          status: 'pending' | 'approved' | 'rejected';
          admin_comment: string | null;
          reviewed_by: string | null;
          feexpay_reference: string | null;
          account_number: string | null;
          network: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          method: string;
          reference?: string | null;
          proof_url?: string | null;
          status?: 'pending' | 'approved' | 'rejected';
          admin_comment?: string | null;
          reviewed_by?: string | null;
          feexpay_reference?: string | null;
          account_number?: string | null;
          network?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          method?: string;
          reference?: string | null;
          proof_url?: string | null;
          status?: 'pending' | 'approved' | 'rejected';
          admin_comment?: string | null;
          reviewed_by?: string | null;
          feexpay_reference?: string | null;
          account_number?: string | null;
          network?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      withdrawals: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          method: string;
          account_info: string | null;
          status: 'pending' | 'approved' | 'paid' | 'rejected';
          admin_comment: string | null;
          reviewed_by: string | null;
          feexpay_reference: string | null;
          network: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          method: string;
          account_info?: string | null;
          status?: 'pending' | 'approved' | 'paid' | 'rejected';
          admin_comment?: string | null;
          reviewed_by?: string | null;
          feexpay_reference?: string | null;
          network?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          method?: string;
          account_info?: string | null;
          status?: 'pending' | 'approved' | 'paid' | 'rejected';
          admin_comment?: string | null;
          reviewed_by?: string | null;
          feexpay_reference?: string | null;
          network?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          message: string;
          type: 'deposit' | 'withdrawal' | 'task' | 'reward' | 'investment' | 'promotion' | 'admin' | 'referral';
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          message: string;
          type: 'deposit' | 'withdrawal' | 'task' | 'reward' | 'investment' | 'promotion' | 'admin' | 'referral';
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          message?: string;
          type?: 'deposit' | 'withdrawal' | 'task' | 'reward' | 'investment' | 'promotion' | 'admin' | 'referral';
          is_read?: boolean;
          created_at?: string;
        };
      };
      payment_methods: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          is_active: boolean;
          instructions: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string | null;
          is_active?: boolean;
          instructions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          icon?: string | null;
          is_active?: boolean;
          instructions?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string;
          commission: number;
          status: 'pending' | 'paid';
          created_at: string;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referred_id: string;
          commission: number;
          status?: 'pending' | 'paid';
          created_at?: string;
        };
        Update: {
          id?: string;
          referrer_id?: string;
          referred_id?: string;
          commission?: number;
          status?: 'pending' | 'paid';
          created_at?: string;
        };
      };
      system_settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Json;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      admin_logs: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
      };
      daily_statistics: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          tasks_completed: number;
          earnings: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          tasks_completed?: number;
          earnings?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          tasks_completed?: number;
          earnings?: number;
          created_at?: string;
        };
      };
      banners: {
        Row: {
          id: string;
          title: string;
          image_url: string;
          link: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          image_url: string;
          link?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          image_url?: string;
          link?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          content: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      add_reward: {
        Args: { p_user_id: string; p_amount: number; p_description?: string | null };
        Returns: Json;
      };
      submit_task: {
        Args: { p_user_id: string; p_task_id: string; p_answers: Json };
        Returns: Json;
      };
      approve_submission: {
        Args: { p_submission_id: string; p_admin_id: string; p_comment?: string | null };
        Returns: Json;
      };
      reject_submission: {
        Args: { p_submission_id: string; p_admin_id: string; p_comment?: string | null };
        Returns: Json;
      };
      validate_deposit: {
        Args: { p_deposit_id: string; p_admin_id: string; p_approve: boolean; p_comment?: string | null };
        Returns: Json;
      };
      validate_withdrawal: {
        Args: { p_withdrawal_id: string; p_admin_id: string; p_status: string; p_comment?: string | null };
        Returns: Json;
      };
      ban_user: {
        Args: { p_user_id: string; p_admin_id: string; p_ban: boolean };
        Returns: Json;
      };
      delete_user: {
        Args: { p_user_id: string; p_admin_id: string };
        Returns: Json;
      };
      activate_plan: {
        Args: { p_user_id: string; p_plan_id: string; p_amount: number };
        Returns: Json;
      };
      create_task: {
        Args: {
          p_admin_id: string;
          p_title: string;
          p_description?: string | null;
          p_amount: number;
          p_plan_id?: string | null;
          p_category_id?: string | null;
          p_icon?: string;
          p_estimated_time?: number | null;
          p_instructions?: string | null;
          p_link?: string | null;
          p_max_completions?: number | null;
          p_duration_minutes?: number | null;
          p_deadline?: string | null;
          p_validation_type?: string;
          p_fields?: Json | null;
        };
        Returns: Json;
      };
      update_task: {
        Args: {
          p_admin_id: string;
          p_task_id: string;
          p_title?: string | null;
          p_description?: string | null;
          p_amount?: number | null;
          p_plan_id?: string | null;
          p_icon?: string | null;
          p_estimated_time?: number | null;
          p_instructions?: string | null;
          p_link?: string | null;
          p_max_completions?: number | null;
          p_duration_minutes?: number | null;
          p_deadline?: string | null;
          p_validation_type?: string | null;
          p_is_active?: boolean | null;
        };
        Returns: Json;
      };
      delete_task: {
        Args: { p_admin_id: string; p_task_id: string };
        Returns: Json;
      };
      create_plan: {
        Args: {
          p_admin_id: string;
          p_name: string;
          p_slug: string;
          p_price: number;
          p_daily_tasks: number;
          p_min_profitability: number;
          p_max_profitability: number;
          p_color?: string;
          p_icon?: string;
          p_badge?: string;
        };
        Returns: Json;
      };
      toggle_plan_status: {
        Args: { p_admin_id: string; p_plan_id: string; p_is_active: boolean };
        Returns: Json;
      };
      update_plan: {
        Args: {
          p_admin_id: string;
          p_plan_id: string;
          p_name?: string | null;
          p_price?: number | null;
          p_daily_tasks?: number | null;
          p_min_profitability?: number | null;
          p_max_profitability?: number | null;
          p_color?: string | null;
          p_icon?: string | null;
          p_badge?: string | null;
        };
        Returns: Json;
      };
      get_platform_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_users_with_details: {
        Args: { p_plan_slug?: string | null };
        Returns: Json;
      };
      submit_withdrawal: {
        Args: { p_user_id: string; p_amount: number; p_method: string; p_account_info: string };
        Returns: Json;
      };
      submit_deposit: {
        Args: { p_user_id: string; p_amount: number; p_method: string; p_reference?: string | null; p_proof_url?: string | null };
        Returns: Json;
      };
      get_withdrawable_amount: {
        Args: { p_user_id: string };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
  };
}