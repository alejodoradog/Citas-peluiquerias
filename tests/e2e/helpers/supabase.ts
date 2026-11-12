import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { addDays, toBogotaDate } from "../../../src/lib/fechas/fechas";
import { getColombianHolidays } from "../../../src/lib/fechas/festivos";

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

async function barbershopIdOf(slug: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("barbershops")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data.id as string;
}

// D-57's data of a barbershop and the files of its logo and cover folders,
// read past RLS, so a test can check that replacing or removing an image
// leaves exactly one file per kind, or none.
export async function shopProfileSnapshot(slug: string) {
  const admin = adminClient();
  const { data: shop, error } = await admin
    .from("barbershops")
    .select(
      "id, name, address, locality, whatsapp_phone, latitude, longitude, logo_path, cover_photo_path",
    )
    .eq("slug", slug)
    .single();
  if (error) throw error;
  const [logos, covers] = await Promise.all([
    admin.storage.from("images").list(`${shop.id}/logo`, { limit: 100 }),
    admin.storage.from("images").list(`${shop.id}/cover`, { limit: 100 }),
  ]);
  if (logos.error) throw logos.error;
  if (covers.error) throw covers.error;
  return {
    name: shop.name as string,
    address: shop.address as string | null,
    locality: shop.locality as string | null,
    whatsappPhone: shop.whatsapp_phone as string | null,
    latitude: shop.latitude as number | null,
    longitude: shop.longitude as number | null,
    logoPath: shop.logo_path as string | null,
    coverPath: shop.cover_photo_path as string | null,
    logoObjects: (logos.data ?? []).map((o) => `${shop.id}/logo/${o.name}`),
    coverObjects: (covers.data ?? []).map((o) => `${shop.id}/cover/${o.name}`),
  };
}

// A barber's id and private link as the database keeps them, read past RLS
// (task 2.3): the hash, whether it works and when it was issued.
export async function barberLinkSnapshot(slug: string, barberName: string) {
  const { data, error } = await adminClient()
    .from("barbers")
    .select("id, link_token_hash, link_active, link_issued_at")
    .eq("barbershop_id", await barbershopIdOf(slug))
    .eq("display_name", barberName)
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    hash: data.link_token_hash as string,
    active: data.link_active as boolean,
    issuedAt: data.link_issued_at as string | null,
  };
}

// A barber added straight to a barbershop, past the app, so a test has a
// barber of another barbershop to aim at. Its token is thrown away.
export async function insertBarber(
  slug: string,
  barberName: string,
): Promise<string> {
  const { data, error } = await adminClient()
    .from("barbers")
    .insert({
      barbershop_id: await barbershopIdOf(slug),
      display_name: barberName,
      link_token_hash: randomBytes(32).toString("hex"),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// Deactivates or brings back a barber past the app; the trigger stamps when.
export async function setBarberActive(
  slug: string,
  barberName: string,
  active: boolean,
) {
  const { error } = await adminClient()
    .from("barbers")
    .update({ active })
    .eq("barbershop_id", await barbershopIdOf(slug))
    .eq("display_name", barberName);
  if (error) throw error;
}

// D-60's two columns of a barbershop, read or written past RLS.
export async function policiesSnapshot(slug: string) {
  const { data, error } = await adminClient()
    .from("barbershops")
    .select("min_booking_notice_minutes, cancellation_notice_hours")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return {
    minBookingNoticeMinutes: data.min_booking_notice_minutes as number,
    cancellationNoticeHours: data.cancellation_notice_hours as number,
  };
}

export async function setPolicies(
  slug: string,
  policies: {
    minBookingNoticeMinutes: number;
    cancellationNoticeHours: number;
  },
) {
  const { error } = await adminClient()
    .from("barbershops")
    .update({
      min_booking_notice_minutes: policies.minBookingNoticeMinutes,
      cancellation_notice_hours: policies.cancellationNoticeHours,
    })
    .eq("slug", slug);
  if (error) throw error;
}

// D-59: the holidays a barbershop opens and its closures of the whole
// barbershop (time_blocks without barber), read or written past RLS.
export async function holidayOpenings(slug: string): Promise<string[]> {
  const { data, error } = await adminClient()
    .from("holiday_openings")
    .select("holiday_date")
    .eq("barbershop_id", await barbershopIdOf(slug))
    .order("holiday_date");
  if (error) throw error;
  return data.map((row) => row.holiday_date as string);
}

export async function shopClosures(slug: string) {
  const { data, error } = await adminClient()
    .from("time_blocks")
    .select("starts_at, ends_at, reason")
    .eq("barbershop_id", await barbershopIdOf(slug))
    .is("barber_id", null)
    .order("starts_at");
  if (error) throw error;
  return data.map((row) => ({
    startsAt: new Date(row.starts_at as string).toISOString(),
    endsAt: new Date(row.ends_at as string).toISOString(),
    reason: row.reason as string | null,
  }));
}

export async function insertShopClosure(
  slug: string,
  closure: { startsAt: Date; endsAt: Date; reason: string | null },
) {
  const { error } = await adminClient()
    .from("time_blocks")
    .insert({
      barbershop_id: await barbershopIdOf(slug),
      starts_at: closure.startsAt.toISOString(),
      ends_at: closure.endsAt.toISOString(),
      reason: closure.reason,
    });
  if (error) throw error;
}

// D-61: when each link a barbershop left was left, read past RLS, so a test
// knows until which day the screen must say it keeps leading to the new one.
export async function slugHistory(slug: string) {
  const { data, error } = await adminClient()
    .from("barbershop_slug_history")
    .select("slug, retired_at")
    .eq("barbershop_id", await barbershopIdOf(slug))
    .order("retired_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    slug: row.slug as string,
    retiredAt: new Date(row.retired_at as string),
  }));
}

// A link the barbershop on `slug` left `daysAgo` days ago, written past the
// app (only the trigger writes the history), so a test has a link that is no
// longer set aside without moving the clock.
export async function insertLeftSlug(
  slug: string,
  leftSlug: string,
  daysAgo: number,
) {
  const { error } = await adminClient()
    .from("barbershop_slug_history")
    .insert({
      slug: leftSlug,
      barbershop_id: await barbershopIdOf(slug),
      retired_at: new Date(
        Date.now() - daysAgo * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  if (error) throw error;
}

// More sedes for the owner of a barbershop (task 2.6b), written past RLS as
// create_barbershop would leave them, with their setup already done so the
// whole panel opens on them. Newer than the first one, in the given order.
export async function addReadySedes(
  slug: string,
  names: readonly string[],
): Promise<{ id: string; slug: string }[]> {
  const admin = adminClient();
  const { data: first, error } = await admin
    .from("barbershops")
    .select("id, trial_ends_on, memberships(user_id)")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  const owner = first.memberships[0]?.user_id;
  if (!owner) throw new Error(`No owner for ${slug}`);
  const added: { id: string; slug: string }[] = [];
  for (const [index, name] of names.entries()) {
    const sedeSlug = `${slug}-sede-${index + 2}`;
    const { data: sede, error: sedeError } = await admin
      .from("barbershops")
      .insert({
        name,
        slug: sedeSlug,
        whatsapp_phone: "+573001234567",
        trial_ends_on: first.trial_ends_on,
        expires_on: first.trial_ends_on,
        setup_completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (sedeError) throw sedeError;
    const { error: membershipError } = await admin
      .from("memberships")
      .insert({ user_id: owner, barbershop_id: sede.id, role: "owner" });
    if (membershipError) throw membershipError;
    added.push({ id: sede.id, slug: sedeSlug });
  }
  return added;
}

// A client signed in as an account, straight against the local Supabase
// (no browser): a test can call Storage and the RPCs the way an account
// could without the app (security review of task 2.4, image quota).
export async function signedInClient(email: string, password: string) {
  const client = createClient(
    requireLocalSupabaseUrl(),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

// The id of a barbershop and its image quota (migration
// add_image_upload_tickets: 2 per barber plus 10), read past RLS.
export async function imageQuotaOf(slug: string) {
  const admin = adminClient();
  const id = await barbershopIdOf(slug);
  const { count, error } = await admin
    .from("barbers")
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", id);
  if (error) throw error;
  return { id, quota: 2 * (count ?? 0) + 10 };
}

// Images uploaded past the policies (service key) into a barbershop's
// barbers folder, as old images that hold no ticket.
export async function uploadImagesPastPolicies(
  barbershopId: string,
  count: number,
) {
  const images = adminClient().storage.from("images");
  for (let index = 0; index < count; index += 1) {
    const { error } = await images.upload(
      `${barbershopId}/barbers/${crypto.randomUUID()}.webp`,
      new Blob(["webp"], { type: "image/webp" }),
      { contentType: "image/webp" },
    );
    if (error) throw error;
  }
}

// A barbershop ready to take bookings (tasks 3.2 and 3.3), written past RLS:
// open every day 06:00-22:00, on every holiday of the next weeks too, with
// Corte (30 min) and Barba (15 min) done by Ana and Beto, in that order.
export async function createBookableShop(
  tag: string,
  barbershopName = "Barbería La Esquina",
): Promise<{
  slug: string;
  id: string;
  services: { corte: string; barba: string };
  barbers: { ana: string; beto: string };
  // The owner's account, to sign in to the panel (task 4.3).
  owner: { email: string; password: string };
}> {
  const owner = { email: uniqueEmail(tag), password: "clave-segura-1" };
  const { slug } = await createConfirmedOwner(owner.email, owner.password, {
    ownerName: "Carlos Pérez",
    barbershopName,
  });
  const admin = adminClient();
  const id = await barbershopIdOf(slug);
  const { error: setupError } = await admin
    .from("barbershops")
    .update({
      setup_completed_at: new Date().toISOString(),
      address: "Cra. 15 # 82-40",
      locality: "Chapinero, Bogotá",
    })
    .eq("id", id);
  if (setupError) throw setupError;

  const { error: hoursError } = await admin.from("barbershop_hours").insert(
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      barbershop_id: id,
      weekday,
      start_time: "06:00",
      end_time: "22:00",
    })),
  );
  if (hoursError) throw hoursError;
  const today = toBogotaDate(new Date());
  const holidays = [0, 1]
    .flatMap((offset) =>
      getColombianHolidays(Number(today.slice(0, 4)) + offset),
    )
    .filter((date) => date >= today && date <= addDays(today, 40));
  if (holidays.length > 0) {
    const { error } = await admin.from("holiday_openings").upsert(
      [...new Set(holidays)].map((holiday_date) => ({
        barbershop_id: id,
        holiday_date,
      })),
    );
    if (error) throw error;
  }

  const { data: services, error: servicesError } = await admin
    .from("services")
    .insert([
      {
        barbershop_id: id,
        name: "Corte",
        price_cop: 25000,
        duration_minutes: 30,
      },
      {
        barbershop_id: id,
        name: "Barba",
        price_cop: 15000,
        duration_minutes: 15,
      },
    ])
    .select("id, name");
  if (servicesError) throw servicesError;
  const { data: barbers, error: barbersError } = await admin
    .from("barbers")
    .insert(
      ["Ana", "Beto"].map((display_name, index) => ({
        barbershop_id: id,
        display_name,
        sort_order: 100 + index,
        link_token_hash: randomBytes(32).toString("hex"),
      })),
    )
    .select("id, display_name");
  if (barbersError) throw barbersError;
  const { error: linesError } = await admin.from("barber_services").insert(
    barbers.flatMap((barber) =>
      services.map((service) => ({
        barbershop_id: id,
        barber_id: barber.id,
        service_id: service.id,
      })),
    ),
  );
  if (linesError) throw linesError;
  const named = <T extends { id: string }>(
    rows: T[],
    key: keyof T,
    value: string,
  ) => rows.find((row) => row[key] === value)!.id;
  return {
    slug,
    id,
    owner,
    services: {
      corte: named(services, "name", "Corte"),
      barba: named(services, "name", "Barba"),
    },
    barbers: {
      ana: named(barbers, "display_name", "Ana"),
      beto: named(barbers, "display_name", "Beto"),
    },
  };
}

// The web appointments of a barbershop, read past RLS (anon reads none).
export async function webAppointments(barbershopId: string) {
  const { data, error } = await adminClient()
    .from("appointments")
    .select(
      "barber_id, starts_at, status, source, manage_token_hash, customers(full_name, email)",
    )
    .eq("barbershop_id", barbershopId)
    .eq("source", "web")
    .order("created_at");
  if (error) throw error;
  return data;
}

// Suspends a barbershop by hand, as the super admin will (task 5.4).
export async function suspendBarbershop(barbershopId: string) {
  const { error } = await adminClient()
    .from("barbershops")
    .update({ subscription_status: "suspended" })
    .eq("id", barbershopId);
  if (error) throw error;
}
