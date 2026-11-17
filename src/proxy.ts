import { NextResponse, type NextRequest } from "next/server";
import { movedAddress } from "@/lib/old-addresses";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // An address someone saved or left open still gets where it moved
  // (src/lib/old-addresses.ts).
  const moved = movedAddress(request.nextUrl.pathname);
  if (moved) {
    const url = request.nextUrl.clone();
    url.pathname = moved;
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
