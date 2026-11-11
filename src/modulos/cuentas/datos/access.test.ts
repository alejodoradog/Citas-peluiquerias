import { beforeEach, describe, expect, it, vi } from "vitest";

// getCurrentAccess runs on the server; the session, the two tables it reads
// and the sede cookie are stand-ins, so the test decides what RLS returned.
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const NORTE = "aaaaaaaa-0000-4000-8000-000000000000";
const SUR = "bbbbbbbb-0000-4000-8000-000000000000";
const ALIEN = "dddddddd-0000-4000-8000-000000000000";

type Shop = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  subscription_status: "trial" | "active" | "suspended";
  expires_on: string;
  trial_ends_on: string;
  created_at: string;
};

const norte: Shop = {
  id: NORTE,
  name: "Barbería El Parche",
  slug: "barberia-el-parche",
  logo_path: null,
  subscription_status: "trial",
  expires_on: "2026-11-24",
  trial_ends_on: "2026-11-24",
  created_at: "2026-11-04T15:00:00+00:00",
};
const sur: Shop = {
  id: SUR,
  name: "El Parche Sur",
  slug: "el-parche-sur",
  logo_path: `${SUR}/logo/1.webp`,
  subscription_status: "active",
  expires_on: "2026-12-30",
  trial_ends_on: "2026-11-24",
  created_at: "2026-11-09T15:00:00+00:00",
};

let memberships: { barbershops: Shop | null }[] = [];
let cookie: string | undefined;

// Each query ends where the code awaits it: maybeSingle for the profile, the
// last eq for the memberships.
function query(table: string) {
  const builder = {
    select: () => builder,
    eq: (column: string) =>
      table === "memberships" && column === "role"
        ? Promise.resolve({ data: memberships, error: null })
        : builder,
    maybeSingle: async () => ({
      data: { full_name: "Carlos Pérez", is_super_admin: false },
      error: null,
    }),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "carlos@example.com" } },
      }),
    },
    from: query,
  }),
}));
vi.mock("./active-barbershop", () => ({
  readActiveBarbershopChoice: async () => cookie,
}));

const { getCurrentAccess } = await import("./access");

beforeEach(() => {
  // Newest first on purpose: the order is the access's job.
  memberships = [{ barbershops: sur }, { barbershops: norte }];
  cookie = undefined;
});

async function owner() {
  const access = await getCurrentAccess();
  if (access.kind !== "owner") throw new Error(`not an owner: ${access.kind}`);
  return access;
}

describe("getCurrentAccess for an owner with two sedes", () => {
  it("lists both sedes, oldest first, with the company trial of the oldest", async () => {
    const access = await owner();
    expect(access.barbershops).toEqual([
      { id: NORTE, name: norte.name, slug: norte.slug, logoPath: null },
      { id: SUR, name: sur.name, slug: sur.slug, logoPath: sur.logo_path },
    ]);
    expect(access.companyTrialEndsOn).toBe("2026-11-24");
  });

  it("works on the sede the cookie names", async () => {
    cookie = SUR;
    const { barbershop } = await owner();
    expect(barbershop).toEqual({
      id: SUR,
      name: sur.name,
      slug: sur.slug,
      logoPath: sur.logo_path,
      subscriptionStatus: "active",
      expiresOn: "2026-12-30",
    });
  });

  it("ignores a cookie naming a barbershop that is not the owner's", async () => {
    cookie = ALIEN;
    expect((await owner()).barbershop.id).toBe(NORTE);
  });

  it("takes the oldest sede without a cookie", async () => {
    expect((await owner()).barbershop.id).toBe(NORTE);
  });

  it("falls back to the oldest when the cookie's sede is gone", async () => {
    cookie = SUR;
    memberships = [{ barbershops: norte }];
    const access = await owner();
    expect(access.barbershop.id).toBe(NORTE);
    expect(access.barbershops.map((b) => b.id)).toEqual([NORTE]);
  });

  it("has no access without memberships, whatever the cookie says", async () => {
    cookie = SUR;
    memberships = [];
    expect((await getCurrentAccess()).kind).toBe("no_access");
  });

  it("skips memberships whose barbershop RLS hides", async () => {
    cookie = SUR;
    memberships = [{ barbershops: null }, { barbershops: norte }];
    const access = await owner();
    expect(access.barbershop.id).toBe(NORTE);
    expect(access.barbershops).toHaveLength(1);
  });
});
