import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBarberForm } from "./barber";
import { DEFAULT_BARBERSHOP_HOURS, groupWeek } from "./hours";
import {
  DURATION_OPTIONS,
  isValidDuration,
  parseServiceForm,
  sameServiceName,
  SERVICE_DURATION,
} from "./service";
import {
  initialDraft,
  offeredServices,
  parseSetupPayload,
  setupReducer,
  toSetupPayload,
  type SetupDraft,
} from "./setup";

describe("service durations", () => {
  it("go from 5 to 240 minutes in steps of 5", () => {
    expect(DURATION_OPTIONS[0]).toBe(5);
    expect(DURATION_OPTIONS.at(-1)).toBe(240);
    expect(DURATION_OPTIONS).toHaveLength(48);
    expect([4, 7, 245, 0].some(isValidDuration)).toBe(false);
    expect([5, 40, 240].every(isValidDuration)).toBe(true);
  });

  it("match the rule the database enforces", () => {
    const dir = join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(dir)
      .sort()
      .map((file) => readFileSync(join(dir, file), "utf8"))
      .join("\n");
    const rule = [
      ...sql.matchAll(
        /duration_minutes between (\d+) and (\d+) and duration_minutes % (\d+) = 0/g,
      ),
    ].at(-1);
    expect(rule?.slice(1).map(Number)).toEqual([
      SERVICE_DURATION.min,
      SERVICE_DURATION.max,
      SERVICE_DURATION.step,
    ]);
  });
});

describe("parseServiceForm", () => {
  it("reads the service as typed", () => {
    expect(
      parseServiceForm({ name: " Corte ", price: "$ 28.000", duration: "45" }),
    ).toEqual({
      success: true,
      data: { name: "Corte", price: 28000, duration: 45 },
    });
  });

  it("says what is wrong with each field", () => {
    const result = parseServiceForm({
      name: " ",
      price: "25,5",
      duration: "42",
    });
    expect(result).toEqual({
      success: false,
      errors: {
        name: "service_name_required",
        price: "service_price_invalid",
        duration: "service_duration_invalid",
      },
    });
  });

  it("compares names without case or spaces", () => {
    expect(sameServiceName("Corte", " corte ")).toBe(true);
    expect(sameServiceName("Corte", "Corte niño")).toBe(false);
  });
});

describe("parseBarberForm", () => {
  it("keeps an optional email in lower case", () => {
    expect(
      parseBarberForm({
        displayName: " Kevin ",
        email: " Kevin@Correo.com ",
        serviceKeys: ["a"],
      }),
    ).toEqual({
      success: true,
      data: {
        displayName: "Kevin",
        email: "kevin@correo.com",
        serviceKeys: ["a"],
      },
    });
  });

  it("turns an empty email into none", () => {
    const result = parseBarberForm({
      displayName: "Kevin",
      email: "  ",
      serviceKeys: ["a"],
    });
    expect(result.success && result.data.email).toBeNull();
  });

  it("asks for a name, a valid email and at least one service", () => {
    expect(
      parseBarberForm({ displayName: "", email: "kevin@", serviceKeys: [] }),
    ).toEqual({
      success: false,
      errors: {
        displayName: "barber_name_required",
        email: "email_invalid",
        serviceKeys: "barber_services_required",
      },
    });
  });
});

describe("groupWeek", () => {
  it("joins consecutive days with the same hours", () => {
    expect(groupWeek(DEFAULT_BARBERSHOP_HOURS)).toEqual([
      { fromDay: 1, toDay: 5, shifts: [{ start: "09:00", end: "20:00" }] },
      { fromDay: 6, toDay: 6, shifts: [{ start: "08:00", end: "21:00" }] },
    ]);
  });

  it("keeps split shifts and breaks groups at closed days", () => {
    expect(
      groupWeek([
        { weekday: 1, start: "14:00:00", end: "18:00:00" },
        { weekday: 1, start: "09:00:00", end: "12:00:00" },
        { weekday: 3, start: "09:00", end: "12:00" },
        { weekday: 0, start: "10:00", end: "14:00" },
      ]),
    ).toEqual([
      {
        fromDay: 1,
        toDay: 1,
        shifts: [
          { start: "09:00", end: "12:00" },
          { start: "14:00", end: "18:00" },
        ],
      },
      { fromDay: 3, toDay: 3, shifts: [{ start: "09:00", end: "12:00" }] },
      { fromDay: 0, toDay: 0, shifts: [{ start: "10:00", end: "14:00" }] },
    ]);
  });
});

describe("the setup draft", () => {
  const barber = {
    key: "b1",
    displayName: "Kevin",
    email: null,
    serviceKeys: ["sugerido-1", "sugerido-3"],
  };

  it("starts with the suggested services and the owner cutting", () => {
    const draft = initialDraft();
    expect(draft.ownerCuts).toBe(true);
    expect(offeredServices(draft).map((s) => s.name)).toEqual([
      "Corte",
      "Barba",
      "Cejas",
    ]);
  });

  it("removes a service that stops being offered from every barber", () => {
    let draft: SetupDraft = setupReducer(initialDraft(), {
      type: "save_barber",
      barber,
    });
    draft = setupReducer(draft, { type: "toggle_service", key: "sugerido-3" });
    expect(draft.barbers[0]!.serviceKeys).toEqual(["sugerido-1"]);
    draft = setupReducer(draft, { type: "remove_service", key: "sugerido-1" });
    expect(draft.barbers[0]!.serviceKeys).toEqual([]);
  });

  it("adds and edits services and barbers", () => {
    let draft = setupReducer(initialDraft(), {
      type: "save_service",
      service: {
        key: "nuevo-1",
        name: "Diseño",
        priceCop: 10000,
        durationMinutes: 15,
        offered: true,
      },
    });
    draft = setupReducer(draft, {
      type: "save_service",
      service: { ...draft.services[0]!, priceCop: 28000 },
    });
    draft = setupReducer(draft, { type: "save_barber", barber });
    draft = setupReducer(draft, {
      type: "save_barber",
      barber: { ...barber, displayName: "Kevin M" },
    });
    expect(draft.services).toHaveLength(5);
    expect(draft.services[0]!.priceCop).toBe(28000);
    expect(draft.barbers.map((b) => b.displayName)).toEqual(["Kevin M"]);
    draft = setupReducer(draft, { type: "remove_barber", key: "b1" });
    draft = setupReducer(draft, { type: "set_owner_cuts", value: false });
    expect(draft.barbers).toEqual([]);
    expect(draft.ownerCuts).toBe(false);
    expect(
      setupReducer(draft, { type: "replace", draft: initialDraft() }),
    ).toEqual(initialDraft());
  });

  it("sends the offered services and the owner first", () => {
    const draft = setupReducer(initialDraft(), { type: "save_barber", barber });
    const payload = toSetupPayload(draft, " Carlos Pérez ");
    expect(payload.services.map((s) => s.name)).toEqual([
      "Corte",
      "Barba",
      "Cejas",
    ]);
    expect(payload.barbers).toEqual([
      {
        display_name: "Carlos Pérez",
        email: null,
        is_owner: true,
        service_keys: ["sugerido-1", "sugerido-2", "sugerido-3"],
      },
      {
        display_name: "Kevin",
        email: null,
        is_owner: false,
        service_keys: ["sugerido-1", "sugerido-3"],
      },
    ]);
    expect(parseSetupPayload(payload).success).toBe(true);
  });

  it("leaves the owner out when they do not cut", () => {
    const draft = setupReducer(initialDraft(), {
      type: "set_owner_cuts",
      value: false,
    });
    expect(toSetupPayload(draft, "Carlos").barbers).toEqual([]);
  });
});

describe("parseSetupPayload", () => {
  const service = {
    key: "a",
    name: "Corte",
    price_cop: 25000,
    duration_minutes: 40,
  };

  it("rejects a payload without services", () => {
    expect(parseSetupPayload({ services: [], barbers: [] })).toEqual({
      success: false,
      errors: { services: "services_required" },
    });
  });

  it("rejects repeated names, bad prices and durations", () => {
    const result = parseSetupPayload({
      services: [
        service,
        { ...service, key: "b", name: " corte " },
        {
          ...service,
          key: "c",
          name: "Barba",
          price_cop: -1,
          duration_minutes: 7,
        },
      ],
      barbers: [],
    });
    expect(result).toEqual({
      success: false,
      errors: {
        "services.1.name": "service_name_taken",
        "services.2.price_cop": "service_price_invalid",
        "services.2.duration_minutes": "service_duration_invalid",
      },
    });
  });

  it("rejects barbers with unknown services, no services or two owners", () => {
    const owner = {
      display_name: "Uno",
      email: null,
      is_owner: true,
      service_keys: ["a"],
    };
    expect(
      parseSetupPayload({
        services: [service],
        barbers: [
          { ...owner, service_keys: ["z"] },
          { ...owner, is_owner: false, service_keys: [] },
          owner,
        ],
      }),
    ).toEqual({
      success: false,
      errors: {
        "barbers.0.service_keys": "unknown_service",
        "barbers.1.service_keys": "barber_services_required",
        barbers: "invalid",
      },
    });
  });
});

describe("services added in the wizard", () => {
  it("are accepted with the key the draft gives them", () => {
    const key = `nuevo-${crypto.randomUUID()}`;
    const draft = setupReducer(initialDraft(), {
      type: "save_service",
      service: {
        key,
        name: "Diseño",
        priceCop: 10000,
        durationMinutes: 15,
        offered: true,
      },
    });
    const payload = toSetupPayload(draft, "Carlos");
    expect(payload.services.map((s) => s.key)).toContain(key);
    expect(parseSetupPayload(payload).success).toBe(true);
  });
});
