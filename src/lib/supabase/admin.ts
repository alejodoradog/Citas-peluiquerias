import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getPublicSupabaseEnv, requireEnv } from "./env";

// Bypasses RLS. Use only for operations that have no signed-in user.
export function createSupabaseAdminClient() {
  const { url } = getPublicSupabaseEnv();
  const secretKey = requireEnv(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SECRET_KEY,
  );

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
