import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Only routes that use the session. Public pages never touch it.
export const config = {
  matcher: [
    "/panel/:path*",
    "/admin/:path*",
    "/registro",
    "/ingresar",
    "/recuperar-clave",
    "/nueva-clave",
    "/auth/:path*",
    "/salir",
  ],
};
