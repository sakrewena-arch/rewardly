import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for browser-side usage only
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl === "https://placeholder.supabase.co") {
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}

/**
 * WARNING: Do NOT create an admin client in the browser.
 * The service role key must never be exposed to the client.
 * Use the server-side createAdminClient in src/lib/supabase/server.ts instead.
 */