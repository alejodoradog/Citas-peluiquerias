import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const { anonymizeCustomer, deleteCustomerError, getCustomerProfile } =
  await import("./customers");

describe("deleteCustomerError", () => {
  it("reads an appointment still to come", () => {
    expect(
      deleteCustomerError({ code: "23514", hint: "has_upcoming_appointments" }),
    ).toBe("has_upcoming_appointments");
  });

  it("reads a customer the owner does not reach, or one already deleted", () => {
    expect(
      deleteCustomerError({ code: "P0002", hint: "customer_not_found" }),
    ).toBe("customer_not_found");
    expect(
      deleteCustomerError({ code: "23514", hint: "customer_anonymized" }),
    ).toBe("customer_not_found");
  });

  it("calls anything else unknown", () => {
    expect(deleteCustomerError({ code: "57014" })).toBe("unknown");
    expect(deleteCustomerError({})).toBe("unknown");
  });
});

describe("ids from the URL", () => {
  it("never reach the database when they are not ids", async () => {
    expect(await getCustomerProfile("shop", "no-es-un-id")).toBeNull();
    expect(await anonymizeCustomer("shop", "1; drop table")).toEqual({
      ok: false,
      code: "customer_not_found",
    });
  });
});
