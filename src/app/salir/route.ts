import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAccess, homeFor } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Where an account without access is sent: an inactive profile, or an auth
// user with no profile. It ends that session and explains why. Accounts that
// do have access are sent home, so a link to /salir cannot sign anyone out.
export async function GET(request: NextRequest) {
  const access = await getCurrentAccess();
  if (access.kind === "owner" || access.kind === "super_admin") {
    return NextResponse.redirect(new URL(homeFor(access), request.url));
  }
  if (access.kind === "anonymous") {
    return NextResponse.redirect(new URL("/ingresar", request.url));
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(
    new URL("/ingresar?aviso=sin-acceso", request.url),
  );
}
