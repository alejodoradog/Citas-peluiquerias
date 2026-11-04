import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { tryGetPublicSupabaseEnv } from "./env";

// Refreshes the Supabase session cookie before the page renders, so Server
// Components always read a valid session.
export async function updateSession(request: NextRequest) {
  // Without Supabase configured (a preview without a database) there is no
  // session to refresh; the pages that need one report the missing setup.
  const env = tryGetPublicSupabaseEnv();
  if (!env) {
    return NextResponse.next({ request });
  }
  const { url, publishableKey } = env;

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Validates the token and refreshes it when it is about to expire.
  await supabase.auth.getClaims();
  return response;
}
