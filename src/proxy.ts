import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// "Profesionales" lived at /panel/barberos until task 7.1b: an address
// someone saved or left open still gets there.
const OLD_TEAM = "/panel/barberos";
const TEAM = "/panel/profesionales";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === OLD_TEAM || pathname.startsWith(`${OLD_TEAM}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = TEAM + pathname.slice(OLD_TEAM.length);
    return NextResponse.redirect(url, 308);
  }
  return updateSession(request);
}

// Only routes that use the session. Public pages never touch it.
export const config = {
  matcher: [
    "/panel/:path*",
    // The owners' entry sends a signed-in owner to their agenda.
    "/app",
    "/admin/:path*",
    // "Mi agenda" of a professional with their own account (task 7.6b).
    "/mi-agenda/:path*",
    "/registro",
    "/ingresar",
    "/recuperar-clave",
    "/nueva-clave",
    "/auth/:path*",
  ],
};
