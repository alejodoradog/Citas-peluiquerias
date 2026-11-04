import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getPublicSupabaseEnv } from "./env";

// Always anonymous, even when someone is signed in: public pages and public
// lookups must see exactly what the public sees (decision 0002, point 3).
export function createSupabasePublicClient() {
  const { url, publishableKey } = getPublicSupabaseEnv();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
