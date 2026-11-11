import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const { createBarbershopError, deleteBarbershopError } =
  await import("./barbershops");

describe("createBarbershopError", () => {
  it("reads a taken link, now or set aside for another barbershop", () => {
    expect(createBarbershopError({ code: "23505" })).toBe("slug_taken");
    expect(createBarbershopError({ code: "23505", hint: "slug_taken" })).toBe(
      "slug_taken",
    );
  });

  it("reads a WhatsApp the database refused", () => {
    expect(
      createBarbershopError({ code: "23514", hint: "phone_invalid" }),
    ).toBe("phone_invalid");
  });

  it("reads the limit of 4 sedes", () => {
    expect(
      createBarbershopError({ code: "23514", hint: "barbershop_limit" }),
    ).toBe("barbershop_limit");
  });

  it("treats anything else as a failure that wrote nothing", () => {
    expect(createBarbershopError({ code: "23514" })).toBe("unknown");
    expect(
      createBarbershopError({ code: "P0002", hint: "barbershop_deleted" }),
    ).toBe("unknown");
    expect(createBarbershopError({ code: "42501" })).toBe("unknown");
    expect(createBarbershopError({})).toBe("unknown");
  });
});

describe("deleteBarbershopError", () => {
  it("reads the last sede of the account", () => {
    expect(
      deleteBarbershopError({ code: "23514", hint: "last_barbershop" }),
    ).toBe("last_barbershop");
  });

  it("reads upcoming appointments", () => {
    expect(
      deleteBarbershopError({
        code: "23514",
        hint: "has_upcoming_appointments",
      }),
    ).toBe("has_upcoming_appointments");
  });

  it("treats anything else as a failure that deleted nothing", () => {
    expect(deleteBarbershopError({ code: "42501" })).toBe("unknown");
    expect(deleteBarbershopError({ code: "23514" })).toBe("unknown");
    expect(
      deleteBarbershopError({ code: "23514", hint: "barbershop_limit" }),
    ).toBe("unknown");
    expect(deleteBarbershopError({})).toBe("unknown");
  });
});
