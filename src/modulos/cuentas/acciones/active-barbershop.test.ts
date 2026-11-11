import { beforeEach, describe, expect, it, vi } from "vitest";

// The action runs on the server; the session and the cookie are stand-ins.
vi.mock("server-only", () => ({}));

const NORTE = "aaaaaaaa-0000-4000-8000-000000000000";
const SUR = "bbbbbbbb-0000-4000-8000-000000000000";
const ALIEN = "dddddddd-0000-4000-8000-000000000000";

const requireOwner = vi.fn(async () => ({
  barbershop: { id: NORTE },
  barbershops: [{ id: NORTE }, { id: SUR }],
}));
vi.mock("../guards", () => ({ requireOwner }));

const rememberActiveBarbershop = vi.fn<(id: string) => Promise<void>>(
  async () => {},
);
vi.mock("../datos/active-barbershop", () => ({ rememberActiveBarbershop }));

const { switchBarbershop } = await import("./active-barbershop");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("switchBarbershop", () => {
  it("remembers another of the owner's sedes", async () => {
    expect(await switchBarbershop(SUR)).toBe("switched");
    expect(rememberActiveBarbershop).toHaveBeenCalledWith(SUR);
  });

  it.each([
    ["a barbershop of another owner", ALIEN],
    ["an empty id", ""],
    ["something that is not an id", { id: SUR }],
    ["nothing", undefined],
  ])("refuses %s and keeps the cookie as it was", async (_case, id) => {
    expect(await switchBarbershop(id)).toBe("refused");
    expect(rememberActiveBarbershop).not.toHaveBeenCalled();
  });

  it("checks the owner before reading the id", async () => {
    requireOwner.mockRejectedValueOnce(new Error("redirect"));
    await expect(switchBarbershop(SUR)).rejects.toThrow("redirect");
    expect(rememberActiveBarbershop).not.toHaveBeenCalled();
  });
});
