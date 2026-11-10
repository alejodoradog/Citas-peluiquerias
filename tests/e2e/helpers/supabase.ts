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

// An owner whose email is already confirmed, created the way sign-up creates
// one (the same metadata, so the database trigger opens their barbershop).
// Skips the confirmation email, which the Auth rate limits count.
export async function createConfirmedOwner(
  email: string,
  password: string,
  owner: { ownerName: string; barbershopName: string },
): Promise<{ slug: string }> {
  const slug = `prueba-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      owner_name: owner.ownerName,
      barbershop_name: owner.barbershopName,
      barbershop_slug: slug,
      phone: "+573001234567",
    },
  });
  if (error) throw error;
  return { slug };
}

// What the setup wizard saved for a barbershop, read past RLS.
export async function setupSnapshot(slug: string) {
  const admin = adminClient();
  const { data: shop, error } = await admin
    .from("barbershops")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  const [services, barbers, hours] = await Promise.all([
    admin
      .from("services")
      .select("name, price_cop, duration_minutes")
      .eq("barbershop_id", shop.id)
      .order("name"),
    admin
      .from("barbers")
      .select("display_name, email, is_owner, barber_services(service_id)")
      .eq("barbershop_id", shop.id)
      .order("sort_order"),
    admin
      .from("barbershop_hours")
      .select("weekday")
      .eq("barbershop_id", shop.id),
  ]);
  for (const result of [services, barbers, hours]) {
    if (result.error) throw result.error;
  }
  return {
    services: services.data ?? [],
    barbers: (barbers.data ?? []).map((b) => ({
      name: b.display_name,
      email: b.email,
      isOwner: b.is_owner,
      services: b.barber_services.length,
    })),
    hourRows: hours.data?.length ?? 0,
  };
}

// A barber's photo as Storage and the database see it, read past RLS: every
// object in the barbershop's barbers folder and the barber's photo_path, so a
// test can check that replacing or removing a photo leaves no orphan.
export async function barberPhotos(slug: string, barberName: string) {
  const admin = adminClient();
  const { data: shop, error } = await admin
    .from("barbershops")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  const [objects, barber] = await Promise.all([
    admin.storage.from("images").list(`${shop.id}/barbers`, { limit: 100 }),
    admin
      .from("barbers")
      .select("photo_path")
      .eq("barbershop_id", shop.id)
      .eq("display_name", barberName)
      .single(),
  ]);
  if (objects.error) throw objects.error;
  if (barber.error) throw barber.error;
  return {
    objects: (objects.data ?? []).map(
      (object) => `${shop.id}/barbers/${object.name}`,
    ),
    photoPath: barber.data.photo_path as string | null,
  };
}
