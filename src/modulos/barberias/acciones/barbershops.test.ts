import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CreateBarbershopResult,
  DeleteBarbershopResult,
} from "../datos/barbershops";

// The action runs on the server; here the session, the database and the
// cookie are stand-ins, so the test sees exactly what would be written.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag, updateTag }));
const updateTag = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const NEW_SHOP = "cccccccc-0000-4000-8000-000000000000";
const REQUEST_ID = "0b6a3c1e-8f7d-4c2a-9e5b-1d2f3a4b5c6d";

const NORTE = "aaaaaaaa-0000-4000-8000-000000000000";
const SUR = "bbbbbbbb-0000-4000-8000-000000000000";

type OwnerStub = {
  barbershop: { id: string; name: string };
  barbershops: { id: string; name: string }[];
};

// Oldest first, as getCurrentAccess lists them; Sur is the active one.
const twoSedes: OwnerStub = {
  barbershop: { id: SUR, name: "El Parche Sur" },
  barbershops: [
    { id: NORTE, name: "El Parche" },
    { id: SUR, name: "El Parche Sur" },
  ],
};

const requireOwner = vi.fn(async (): Promise<OwnerStub> => twoSedes);
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

const rememberActiveBarbershop = vi.fn<(id: string) => Promise<void>>(
  async () => {},
);
vi.mock("@/modulos/cuentas/datos/active-barbershop", () => ({
  rememberActiveBarbershop,
}));

const findFreeSlug = vi.fn(async (base: string) => base);
vi.mock("../datos/slugs", () => ({ findFreeSlug }));

const createBarbershopRow = vi.fn<
  (values: {
    name: string;
    slug: string;
    whatsappPhone: string | null;
    requestId: string;
  }) => Promise<CreateBarbershopResult>
>(async () => ({ ok: true, id: NEW_SHOP }));
const deleteBarbershopRow = vi.fn<
  (id: string) => Promise<DeleteBarbershopResult>
>(async () => ({ ok: true }));
vi.mock("../datos/barbershops", () => ({
  createBarbershopRow,
  deleteBarbershopRow,
}));

const removeBarbershopImages = vi.fn<(id: string) => Promise<void>>(
  async () => {},
);
vi.mock("../datos/images", () => ({ removeBarbershopImages }));

const { createBarbershop, deleteBarbershop } = await import("./barbershops");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const valid = {
  name: " El Parche Sur ",
  whatsappPhone: "",
  requestId: REQUEST_ID,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createBarbershop", () => {
  it("creates the sede with a link from its name and makes it the active one", async () => {
    const state = await createBarbershop({ status: "idle" }, form(valid));
    expect(state).toEqual({ status: "done", notice: "created" });
    expect(findFreeSlug).toHaveBeenCalledWith("el-parche-sur");
    expect(createBarbershopRow).toHaveBeenCalledWith({
      name: "El Parche Sur",
      slug: "el-parche-sur",
      whatsappPhone: null,
      requestId: REQUEST_ID,
    });
    expect(rememberActiveBarbershop).toHaveBeenCalledWith(NEW_SHOP);
  });

  it("sends the WhatsApp in E.164 when the owner gives one", async () => {
    await createBarbershop(
      { status: "idle" },
      form({ ...valid, whatsappPhone: "300 765 4321" }),
    );
    expect(createBarbershopRow).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappPhone: "+573007654321" }),
    );
  });

  it("checks the owner before anything else", async () => {
    requireOwner.mockRejectedValueOnce(new Error("redirect"));
    await expect(
      createBarbershop({ status: "idle" }, form(valid)),
    ).rejects.toThrow("redirect");
    expect(createBarbershopRow).not.toHaveBeenCalled();
  });

  it("explains a missing name and a WhatsApp that is not a mobile", async () => {
    const state = await createBarbershop(
      { status: "idle" },
      form({ ...valid, name: " ", whatsappPhone: "601 123 4567" }),
    );
    expect(state).toEqual({
      status: "invalid",
      fieldErrors: {
        name: "barbershop_name_required",
        whatsappPhone: "phone_invalid",
      },
      values: { name: " ", whatsappPhone: "601 123 4567" },
    });
    expect(createBarbershopRow).not.toHaveBeenCalled();
  });

  it.each([
    ["", "missing"],
    ["no-es-un-id", "forged"],
  ])(
    "creates nothing without the form's request id (%s: %s)",
    async (requestId) => {
      const state = await createBarbershop(
        { status: "idle" },
        form({ ...valid, requestId }),
      );
      expect(state).toMatchObject({ status: "failed", error: "unknown" });
      expect(createBarbershopRow).not.toHaveBeenCalled();
      expect(rememberActiveBarbershop).not.toHaveBeenCalled();
    },
  );

  it("looks the link up again once when another sede took it meanwhile", async () => {
    findFreeSlug
      .mockResolvedValueOnce("el-parche-sur")
      .mockResolvedValueOnce("el-parche-sur-2");
    createBarbershopRow.mockResolvedValueOnce({
      ok: false,
      code: "slug_taken",
    });
    const state = await createBarbershop({ status: "idle" }, form(valid));
    expect(state).toEqual({ status: "done", notice: "created" });
    expect(createBarbershopRow).toHaveBeenCalledTimes(2);
    expect(createBarbershopRow.mock.calls[1]?.[0]).toMatchObject({
      slug: "el-parche-sur-2",
      requestId: REQUEST_ID,
    });
  });

  it("gives up after the second taken link, writing nothing", async () => {
    createBarbershopRow.mockResolvedValue({ ok: false, code: "slug_taken" });
    const state = await createBarbershop({ status: "idle" }, form(valid));
    expect(state).toMatchObject({ status: "failed", error: "unknown" });
    expect(createBarbershopRow).toHaveBeenCalledTimes(2);
    expect(rememberActiveBarbershop).not.toHaveBeenCalled();
    createBarbershopRow.mockResolvedValue({ ok: true, id: NEW_SHOP });
  });

  it("points at the WhatsApp when the database refuses it", async () => {
    createBarbershopRow.mockResolvedValueOnce({
      ok: false,
      code: "phone_invalid",
    });
    const state = await createBarbershop({ status: "idle" }, form(valid));
    expect(state).toMatchObject({
      status: "invalid",
      fieldErrors: { whatsappPhone: "phone_invalid" },
    });
    expect(rememberActiveBarbershop).not.toHaveBeenCalled();
  });

  it("says so when the account already has its 4 sedes", async () => {
    createBarbershopRow.mockResolvedValueOnce({
      ok: false,
      code: "barbershop_limit",
    });
    const state = await createBarbershop({ status: "idle" }, form(valid));
    expect(state).toMatchObject({
      status: "failed",
      error: "barbershop_limit",
    });
    expect(createBarbershopRow).toHaveBeenCalledTimes(1);
    expect(rememberActiveBarbershop).not.toHaveBeenCalled();
  });

  it("leaves the limit to the database, so a retried request at 4 sedes gets its sede back", async () => {
    requireOwner.mockResolvedValueOnce({
      ...twoSedes,
      barbershops: [1, 2, 3, 4].map((n) => ({
        id: `cccccccc-0000-4000-8000-00000000000${n}`,
        name: `Sede ${n}`,
      })),
    });
    const state = await createBarbershop({ status: "idle" }, form(valid));
    expect(state).toEqual({ status: "done", notice: "created" });
  });

  it("says it failed when the database refuses anything else", async () => {
    createBarbershopRow.mockResolvedValueOnce({ ok: false, code: "unknown" });
    const state = await createBarbershop({ status: "idle" }, form(valid));
    expect(state).toEqual({
      status: "failed",
      error: "unknown",
      values: { name: " El Parche Sur ", whatsappPhone: "" },
    });
    expect(rememberActiveBarbershop).not.toHaveBeenCalled();
  });
});

describe("deleteBarbershop", () => {
  const confirmed = { barbershopId: SUR, confirmName: " el parche sur " };

  it("deletes the active sede, its images, and moves to the oldest one left", async () => {
    const state = await deleteBarbershop({ status: "idle" }, form(confirmed));
    expect(state).toEqual({ status: "done", notice: "deleted" });
    expect(deleteBarbershopRow).toHaveBeenCalledWith(SUR);
    expect(removeBarbershopImages).toHaveBeenCalledWith(SUR);
    expect(rememberActiveBarbershop).toHaveBeenCalledWith(NORTE);
  });

  it("moves to the next sede when the oldest one is deleted", async () => {
    requireOwner.mockResolvedValueOnce({
      ...twoSedes,
      barbershop: { id: NORTE, name: "El Parche" },
    });
    const state = await deleteBarbershop(
      { status: "idle" },
      form({ barbershopId: NORTE, confirmName: "El Parche" }),
    );
    expect(state).toEqual({ status: "done", notice: "deleted" });
    expect(deleteBarbershopRow).toHaveBeenCalledWith(NORTE);
    expect(rememberActiveBarbershop).toHaveBeenCalledWith(SUR);
  });

  it("checks the owner before anything else", async () => {
    requireOwner.mockRejectedValueOnce(new Error("redirect"));
    await expect(
      deleteBarbershop({ status: "idle" }, form(confirmed)),
    ).rejects.toThrow("redirect");
    expect(deleteBarbershopRow).not.toHaveBeenCalled();
  });

  it.each([
    ["the other sede", NORTE],
    ["a sede of another account", "dddddddd-0000-4000-8000-000000000000"],
    ["no sede", ""],
  ])(
    "deletes nothing when the screen showed %s (another tab switched sede)",
    async (_case, barbershopId) => {
      const state = await deleteBarbershop(
        { status: "idle" },
        form({ ...confirmed, barbershopId }),
      );
      expect(state).toMatchObject({
        status: "failed",
        error: "barbershop_changed",
      });
      expect(deleteBarbershopRow).not.toHaveBeenCalled();
    },
  );

  it("deletes nothing when the name does not match", async () => {
    const state = await deleteBarbershop(
      { status: "idle" },
      form({ ...confirmed, confirmName: "El Parche" }),
    );
    expect(state).toEqual({
      status: "invalid",
      fieldErrors: { confirmName: "name_mismatch" },
      values: { confirmName: "El Parche" },
    });
    expect(deleteBarbershopRow).not.toHaveBeenCalled();
    expect(removeBarbershopImages).not.toHaveBeenCalled();
  });

  it("never deletes the only sede", async () => {
    requireOwner.mockResolvedValueOnce({
      barbershop: { id: SUR, name: "El Parche Sur" },
      barbershops: [{ id: SUR, name: "El Parche Sur" }],
    });
    const state = await deleteBarbershop({ status: "idle" }, form(confirmed));
    expect(state).toMatchObject({ status: "failed", error: "last_barbershop" });
    expect(deleteBarbershopRow).not.toHaveBeenCalled();
  });

  it.each(["last_barbershop", "has_upcoming_appointments", "unknown"] as const)(
    "keeps everything when the database refuses (%s)",
    async (code) => {
      deleteBarbershopRow.mockResolvedValueOnce({ ok: false, code });
      const state = await deleteBarbershop({ status: "idle" }, form(confirmed));
      expect(state).toEqual({
        status: "failed",
        error: code,
        values: { confirmName: " el parche sur " },
      });
      expect(removeBarbershopImages).not.toHaveBeenCalled();
      expect(rememberActiveBarbershop).not.toHaveBeenCalled();
    },
  );
});
