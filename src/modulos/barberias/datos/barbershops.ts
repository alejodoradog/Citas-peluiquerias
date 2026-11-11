import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// "Nueva sede" (task 2.6) through create_barbershop (decision 0006), with the
// owner's session: the database checks who may create one, gives it the
// company trial and the owner's membership, and creates it once per request
// id (migration make_create_barbershop_idempotent).

export type CreateBarbershopResult =
  | { ok: true; id: string }
  | { ok: false; code: "slug_taken" | "phone_invalid" | "unknown" };

type DatabaseError = { code?: string; hint?: string | null };

// 23505: the link is taken, now (barbershops_slug_key) or set aside for
// another barbershop (guard_barbershop_slug). 23514 with phone_invalid: not a
// Colombian mobile in E.164. Anything else (a reserved or invalid link, a
// name the constraint refuses, 42501) wrote nothing.
export function createBarbershopError(
  error: DatabaseError,
): Exclude<CreateBarbershopResult, { ok: true }>["code"] {
  if (error.code === "23505") return "slug_taken";
  if (error.code === "23514" && error.hint === "phone_invalid") {
    return "phone_invalid";
  }
  return "unknown";
}

export async function createBarbershopRow(values: {
  name: string;
  slug: string;
  whatsappPhone: string | null;
  requestId: string;
}): Promise<CreateBarbershopResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_barbershop", {
    p_name: values.name,
    p_slug: values.slug,
    ...(values.whatsappPhone ? { p_whatsapp_phone: values.whatsappPhone } : {}),
    p_request_id: values.requestId,
  });
  if (error) return { ok: false, code: createBarbershopError(error) };
  return { ok: true, id: data };
}
