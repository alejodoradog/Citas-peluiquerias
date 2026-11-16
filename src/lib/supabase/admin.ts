import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getPublicSupabaseEnv, requireEnv } from "./env";

// Bypasses RLS. Use only for operations that have no signed-in user, and
// for the two Auth calls of the owner over a professional's account (task
// 7.6b: inviting and deleting), which act only on what the database answered
// to the owner's own session (src/modulos/cuentas/datos/professional-access.ts).
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
