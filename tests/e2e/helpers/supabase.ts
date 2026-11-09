import { createClient } from "@supabase/supabase-js";

// Local Supabase only: Mailpit catches every email the local Auth sends.
const MAILPIT_URL = "http://127.0.0.1:44324";

// The tests create accounts with known passwords, super admins included, so
// they refuse to run against anything but the local Supabase.
export function requireLocalSupabaseUrl(): string {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`E2E tests only run against a local Supabase, not ${url}`);
  }
  return url;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Start Supabase locally and set the variables listed in the example environment file.`,
    );
  }
  return value;
}

export function uniqueEmail(tag: string): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${tag}-${suffix}@example.com`;
}

function adminClient() {
  return createClient(
    requireLocalSupabaseUrl(),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// An auth account with no profile: it can sign in but has no access.
export async function createAccountWithoutProfile(
  email: string,
  password: string,
) {
  const { error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
}

// Super admins are never created through the app (decision 0004).
export async function createSuperAdmin(email: string, password: string) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    full_name: "Admin Plataforma",
    // A super admin has no membership (decision 0006).
    is_super_admin: true,
  });
  if (profileError) throw profileError;
}

export async function emailCount(email: string): Promise<number> {
  const search = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  const { messages = [] } = (await search.json()) as { messages?: unknown[] };
  return messages.length;
}

// The newest /auth/confirm link of that kind. An owner gets a confirmation
// email first, so it waits until the newest email is the one asked for.
export async function latestEmailLink(
  email: string,
  type: "recovery" | "signup",
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    );
    const { messages = [] } = (await search.json()) as {
      messages?: { ID: string }[];
    };
    if (messages[0]) {
      const message = await fetch(
        `${MAILPIT_URL}/api/v1/message/${messages[0].ID}`,
      );
      const { HTML } = (await message.json()) as { HTML: string };
      const href = /href="([^"]*\/auth\/confirm[^"]*)"/
        .exec(HTML)?.[1]
        ?.replaceAll("&amp;", "&");
      if (href?.includes(`type=${type}`)) return href;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No ${type} email arrived for ${email}`);
}
