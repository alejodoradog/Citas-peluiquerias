import { beforeEach, describe, expect, it, vi } from "vitest";

// Task 7.6b: accepting an invitation. Auth and the database are stand-ins.
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
vi.mock("../datos/active-barbershop", () => ({
  forgetActiveBarbershop: async () => {},
}));

let access: { kind: string; acceptedTerms?: boolean } = {
  kind: "professional",
  acceptedTerms: false,
};
let recent = true;
vi.mock("../datos/access", () => ({
  getCurrentAccess: async () => access,
  hasRecentRecoverySession: async () => recent,
}));

const calls: string[] = [];
const verifyOtp = vi.fn<
  (input: unknown) => Promise<{ data: object; error: unknown }>
>(async () => ({
  data: {},
  error: null as unknown,
}));
const updateUser = vi.fn<(input: unknown) => Promise<{ error: unknown }>>(
  async () => {
    calls.push("updateUser");
    return { error: null };
  },
);
const rpc = vi.fn<
  (name: string, args?: unknown) => Promise<{ error: unknown }>
>(async (name) => {
  calls.push(name);
  return { error: null as unknown };
});
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { verifyOtp, updateUser, signOut: async () => ({}) },
    rpc,
  }),
}));

const { confirmInvitation, setNewPassword } = await import("./account");
const { LEGAL_VERSION } = await import("@/lib/legal/version");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function run<T>(call: () => Promise<T>) {
  try {
    return await call();
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

const password = { password: "clave-segura-1", confirmation: "clave-segura-1" };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  access = { kind: "professional", acceptedTerms: false };
  recent = true;
});

describe("confirmInvitation", () => {
  it("spends the invitation's token, then goes to create the password", async () => {
    expect(
      await run(() => confirmInvitation(form({ tokenHash: "h", next: "" }))),
    ).toEqual({ redirectedTo: "/nueva-clave" });
    expect(verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "h" });
  });

  it("explains an invitation that expired or was used", async () => {
    verifyOtp.mockResolvedValueOnce({ data: {}, error: { status: 403 } });
    expect(
      await run(() => confirmInvitation(form({ tokenHash: "h", next: "" }))),
    ).toEqual({ redirectedTo: "/ingresar?invitacion=vencida" });
    expect(
      await run(() => confirmInvitation(form({ tokenHash: "", next: "" }))),
    ).toEqual({ redirectedTo: "/ingresar?invitacion=vencida" });
  });
});

describe("setNewPassword for a professional who opened the invitation", () => {
  it("asks for the terms, without touching anything", async () => {
    expect(
      await setNewPassword({ status: "idle" }, form(password)),
    ).toMatchObject({
      status: "invalid",
      fieldErrors: { acepto: "terms_required" },
    });
    expect(calls).toEqual([]);
  });

  it("keeps the acceptance first, then the password, then opens Mi agenda", async () => {
    expect(
      await run(() =>
        setNewPassword({ status: "idle" }, form({ ...password, acepto: "on" })),
      ),
    ).toEqual({ redirectedTo: "/mi-agenda" });
    expect(calls).toEqual(["accept_professional_terms", "updateUser"]);
    expect(rpc).toHaveBeenCalledWith("accept_professional_terms", {
      p_version: LEGAL_VERSION,
    });
  });

  it("sets no password when the acceptance could not be kept", async () => {
    rpc.mockResolvedValueOnce({ error: { hint: "not_professional" } });
    expect(
      await setNewPassword(
        { status: "idle" },
        form({ ...password, acepto: "on" }),
      ),
    ).toMatchObject({ status: "failed", error: "unknown" });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("needs the session the invitation opened, within the hour", async () => {
    recent = false;
    expect(
      await setNewPassword(
        { status: "idle" },
        form({ ...password, acepto: "on" }),
      ),
    ).toMatchObject({ status: "failed", error: "link_expired" });
    expect(calls).toEqual([]);
  });
});

describe("setNewPassword for everyone else", () => {
  it("is the recovery of D-09: no terms, then the panel", async () => {
    access = { kind: "owner" };
    expect(
      await run(() => setNewPassword({ status: "idle" }, form(password))),
    ).toEqual({ redirectedTo: "/panel" });
    expect(calls).toEqual(["updateUser"]);
  });

  it("a professional who already accepted only changes the password", async () => {
    access = { kind: "professional", acceptedTerms: true };
    expect(
      await run(() => setNewPassword({ status: "idle" }, form(password))),
    ).toEqual({ redirectedTo: "/mi-agenda" });
    expect(calls).toEqual(["updateUser"]);
  });
});
