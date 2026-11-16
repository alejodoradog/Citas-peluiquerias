import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "./datos/access";

// Where each kind of account belongs (task 7.6b adds the professional).
vi.mock("server-only", () => ({}));
class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));
let access: Access = { kind: "anonymous" };
vi.mock("./datos/access", () => ({ getCurrentAccess: async () => access }));

const {
  homeFor,
  redirectIfSignedIn,
  requireOwner,
  requireProfessional,
  requireSuperAdmin,
} = await import("./guards");

const professional = (acceptedTerms: boolean): Access => ({
  kind: "professional",
  email: "ana@example.com",
  barberId: "b",
  name: "Ana",
  active: true,
  barbershop: { name: "El Parche", slug: "el-parche", writable: true },
  acceptedTerms,
});
const owner = { kind: "owner" } as Access;

async function goesTo(call: () => Promise<unknown>): Promise<string | null> {
  try {
    await call();
    return null;
  } catch (error) {
    if (error instanceof Redirect) return error.to;
    throw error;
  }
}

beforeEach(() => {
  access = { kind: "anonymous" };
});

describe("homeFor", () => {
  it("sends a professional to their agenda, or to accept the terms first", () => {
    expect(homeFor(professional(true))).toBe("/mi-agenda");
    expect(homeFor(professional(false))).toBe("/nueva-clave");
    expect(homeFor(owner)).toBe("/panel");
    expect(homeFor({ kind: "super_admin", name: "A" })).toBe("/admin");
    expect(homeFor({ kind: "no_access" })).toBe("/ingresar");
  });
});

describe("the guards", () => {
  it("a professional never opens the panel nor the platform: they go to their agenda", async () => {
    access = professional(true);
    expect(await goesTo(requireOwner)).toBe("/mi-agenda");
    expect(await goesTo(requireSuperAdmin)).toBe("/mi-agenda");
    expect(await goesTo(requireProfessional)).toBeNull();
  });

  it("an owner never opens Mi agenda: they go to their panel", async () => {
    access = owner;
    expect(await goesTo(requireProfessional)).toBe("/panel");
  });

  it("nobody else opens Mi agenda either", async () => {
    for (const other of [
      { kind: "anonymous" },
      { kind: "no_access" },
      { kind: "super_admin", name: "A" },
    ] as Access[]) {
      access = other;
      expect(await goesTo(requireProfessional)).not.toBeNull();
    }
  });

  it("a professional who has not accepted the terms goes to accept them", async () => {
    access = professional(false);
    expect(await goesTo(requireProfessional)).toBe("/nueva-clave");
  });

  it("a professional already signed in skips the sign-in screen", async () => {
    access = professional(true);
    expect(await goesTo(redirectIfSignedIn)).toBe("/mi-agenda");
    access = { kind: "anonymous" };
    expect(await goesTo(redirectIfSignedIn)).toBeNull();
  });
});
