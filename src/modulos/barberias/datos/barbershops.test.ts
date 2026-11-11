import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const { createBarbershopError } = await import("./barbershops");

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

  it("treats anything else as a failure that wrote nothing", () => {
    expect(createBarbershopError({ code: "23514" })).toBe("unknown");
    expect(createBarbershopError({ code: "42501" })).toBe("unknown");
    expect(createBarbershopError({})).toBe("unknown");
  });
});
