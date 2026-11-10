import { z } from "zod";
import { MAX_PRICE_COP } from "@/lib/dinero/pesos";
import { emailSchema } from "@/lib/validacion/credentials";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";
import { BARBER_NAME_MAX, type BarberErrorCode } from "./barber";
import {
  isValidDuration,
  SERVICE_NAME_MAX,
  sameServiceName,
  SUGGESTED_SERVICES,
  type ServiceErrorCode,
} from "./service";

// The setup wizard (task 2.1, D-10 to D-14) builds this draft in the browser
// and saves it in one transaction when the owner finishes.

export type DraftService = {
  key: string;
  name: string;
  priceCop: number;
  durationMinutes: number;
  offered: boolean;
};

export type DraftBarber = {
  key: string;
  displayName: string;
  email: string | null;
  serviceKeys: string[];
};

export type SetupDraft = {
  services: DraftService[];
  // "Yo también corto": the owner is one of the barbers.
  ownerCuts: boolean;
  barbers: DraftBarber[];
};

export function initialDraft(): SetupDraft {
  return {
    services: SUGGESTED_SERVICES.map((service, index) => ({
      key: `sugerido-${index + 1}`,
      ...service,
    })),
    ownerCuts: true,
    barbers: [],
  };
}

export function offeredServices(draft: SetupDraft): DraftService[] {
  return draft.services.filter((service) => service.offered);
}

export type SetupAction =
  | { type: "toggle_service"; key: string }
  | { type: "save_service"; service: DraftService }
  | { type: "remove_service"; key: string }
  | { type: "set_owner_cuts"; value: boolean }
  | { type: "save_barber"; barber: DraftBarber }
  | { type: "remove_barber"; key: string }
  | { type: "replace"; draft: SetupDraft };

// A service that stops being offered leaves every barber, so the draft never
// points at something the setup will not create.
function dropService(barbers: DraftBarber[], key: string): DraftBarber[] {
  return barbers.map((barber) => ({
    ...barber,
    serviceKeys: barber.serviceKeys.filter((serviceKey) => serviceKey !== key),
  }));
}

export function setupReducer(
  draft: SetupDraft,
  action: SetupAction,
): SetupDraft {
  switch (action.type) {
    case "toggle_service": {
      const services = draft.services.map((service) =>
        service.key === action.key
          ? { ...service, offered: !service.offered }
          : service,
      );
      const nowOffered = services.find((s) => s.key === action.key)?.offered;
      return {
        ...draft,
        services,
        barbers: nowOffered
          ? draft.barbers
          : dropService(draft.barbers, action.key),
      };
    }
    case "save_service": {
      const exists = draft.services.some((s) => s.key === action.service.key);
      return {
        ...draft,
        services: exists
          ? draft.services.map((s) =>
              s.key === action.service.key ? action.service : s,
            )
          : [...draft.services, action.service],
      };
    }
    case "remove_service":
      return {
        ...draft,
        services: draft.services.filter((s) => s.key !== action.key),
        barbers: dropService(draft.barbers, action.key),
      };
    case "set_owner_cuts":
      return { ...draft, ownerCuts: action.value };
    case "save_barber": {
      const exists = draft.barbers.some((b) => b.key === action.barber.key);
      return {
        ...draft,
        barbers: exists
          ? draft.barbers.map((b) =>
              b.key === action.barber.key ? action.barber : b,
            )
          : [...draft.barbers, action.barber],
      };
    }
    case "remove_barber":
      return {
        ...draft,
        barbers: draft.barbers.filter((b) => b.key !== action.key),
      };
    case "replace":
      return action.draft;
  }
}

// What complete_barbershop_setup receives. The owner, when they cut, goes
// first and does every offered service.
export type SetupPayload = {
  services: Array<{
    key: string;
    name: string;
    price_cop: number;
    duration_minutes: number;
  }>;
  barbers: Array<{
    display_name: string;
    email: string | null;
    is_owner: boolean;
    service_keys: string[];
  }>;
};

export function toSetupPayload(
  draft: SetupDraft,
  ownerName: string,
): SetupPayload {
  const services = offeredServices(draft);
  const offeredKeys = new Set(services.map((s) => s.key));
  const owner = draft.ownerCuts
    ? [
        {
          display_name: ownerName.trim().slice(0, BARBER_NAME_MAX),
          email: null,
          is_owner: true,
          service_keys: services.map((s) => s.key),
        },
      ]
    : [];
  return {
    services: services.map((s) => ({
      key: s.key,
      name: s.name.trim(),
      price_cop: s.priceCop,
      duration_minutes: s.durationMinutes,
    })),
    barbers: [
      ...owner,
      ...draft.barbers.map((b) => ({
        display_name: b.displayName.trim(),
        email: b.email,
        is_owner: false,
        service_keys: b.serviceKeys.filter((key) => offeredKeys.has(key)),
      })),
    ],
  };
}

export type SetupErrorCode =
  ServiceErrorCode | BarberErrorCode | "services_required" | "unknown_service";

// The server checks the whole payload again: it arrives as JSON from the
// browser and must not be trusted.
const setupPayloadSchema = z
  .object({
    services: z
      .array(
        z.object({
          key: z.string().min(1).max(40),
          name: z
            .string()
            .trim()
            .min(1, "service_name_required")
            .max(SERVICE_NAME_MAX, "service_name_too_long"),
          price_cop: z
            .number()
            .int("service_price_invalid")
            .min(0, "service_price_invalid")
            .max(MAX_PRICE_COP, "service_price_invalid"),
          duration_minutes: z
            .number()
            .refine(isValidDuration, "service_duration_invalid"),
        }),
      )
      .min(1, "services_required")
      .max(30, "services_required"),
    barbers: z
      .array(
        z.object({
          display_name: z
            .string()
            .trim()
            .min(1, "barber_name_required")
            .max(BARBER_NAME_MAX, "barber_name_too_long"),
          email: emailSchema.nullable(),
          is_owner: z.boolean(),
          service_keys: z
            .array(z.string())
            .min(1, "barber_services_required")
            .max(30, "barber_services_required"),
        }),
      )
      .max(50),
  })
  .superRefine((payload, ctx) => {
    payload.services.forEach((service, index) => {
      const taken = payload.services
        .slice(0, index)
        .some((other) => sameServiceName(other.name, service.name));
      if (taken) {
        ctx.addIssue({
          code: "custom",
          path: ["services", index, "name"],
          message: "service_name_taken",
        });
      }
    });
    const keys = new Set(payload.services.map((s) => s.key));
    payload.barbers.forEach((barber, index) => {
      if (barber.service_keys.some((key) => !keys.has(key))) {
        ctx.addIssue({
          code: "custom",
          path: ["barbers", index, "service_keys"],
          message: "unknown_service",
        });
      }
    });
    if (payload.barbers.filter((b) => b.is_owner).length > 1) {
      ctx.addIssue({ code: "custom", path: ["barbers"], message: "invalid" });
    }
  });

export function parseSetupPayload(
  input: unknown,
): ParseResult<SetupPayload, SetupErrorCode> {
  return parseWith(setupPayloadSchema, input);
}
