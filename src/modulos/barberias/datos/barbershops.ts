import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// "Nueva sede" (task 2.6) through create_barbershop and "Eliminar sede"
// (task 2.6b) through delete_barbershop (decision 0006), with the owner's
// session: the database checks who may create or delete one, gives a new
// sede the company trial and the owner's membership, creates it once per
// request id (migration make_create_barbershop_idempotent) and keeps the
// account between 1 and 4 sedes (migration
// add_barbershop_limit_and_deletion).

export type CreateBarbershopResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code: "slug_taken" | "phone_invalid" | "barbershop_limit" | "unknown";
    };

type DatabaseError = { code?: string; hint?: string | null };

// 23505: the link is taken, now (barbershops_slug_key) or set aside for
// another barbershop (guard_barbershop_slug). 23514 with phone_invalid: not a
// Colombian mobile in E.164; with barbershop_limit: the account already has
// its 4 sedes. Anything else (a reserved or invalid link, a name the
// constraint refuses, 42501, the sede of a replayed request was deleted)
// wrote nothing.
export function createBarbershopError(
  error: DatabaseError,
): Exclude<CreateBarbershopResult, { ok: true }>["code"] {
  if (error.code === "23505") return "slug_taken";
  if (error.code === "23514" && error.hint === "phone_invalid") {
    return "phone_invalid";
  }
  if (error.code === "23514" && error.hint === "barbershop_limit") {
    return "barbershop_limit";
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

export type DeleteBarbershopResult =
  | { ok: true }
  | {
      ok: false;
      code: "last_barbershop" | "has_upcoming_appointments" | "unknown";
    };

// 23514 with last_barbershop: the account has no other sede; with
// has_upcoming_appointments: customers still expect to be served. Anything
// else (42501: not the owner, or already deleted) deleted nothing.
export function deleteBarbershopError(
  error: DatabaseError,
): Exclude<DeleteBarbershopResult, { ok: true }>["code"] {
  if (error.code === "23514" && error.hint === "last_barbershop") {
    return "last_barbershop";
  }
  if (error.code === "23514" && error.hint === "has_upcoming_appointments") {
    return "has_upcoming_appointments";
  }
  return "unknown";
}

export async function deleteBarbershopRow(
  barbershopId: string,
): Promise<DeleteBarbershopResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_barbershop", {
    p_barbershop_id: barbershopId,
  });
  if (error) return { ok: false, code: deleteBarbershopError(error) };
  return { ok: true };
}
