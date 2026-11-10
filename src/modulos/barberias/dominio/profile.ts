import { z } from "zod";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";
import { normalizeColombianMobile } from "./phone";
import { barbershopNameSchema, type BarbershopErrorCode } from "./registration";

// The barbershop's own data (D-57, "Datos y fotos"; spec, "Perfil de la
// barbería"): what its booking page shows next to the logo and the cover.
// The photos travel apart, as keys of the bucket (src/lib/imagenes/keys.ts).

// The same caps as the checks of barbershops (migration
// add_barbershop_profile_rules).
export const ADDRESS_MAX_LENGTH = 200;
export const LOCALITY_MAX_LENGTH = 100;

export type ShopLocation = { latitude: number; longitude: number };

export type ShopProfile = {
  name: string;
  address: string | null;
  // "Barrio y ciudad" (decision P3 of task 2.4, provisional).
  locality: string | null;
  // E.164. Required on D-57 (decision P4 of task 2.4, provisional): the
  // booking page and D-60 send customers to it.
  whatsappPhone: string;
  location: ShopLocation | null;
};

export type ShopProfileErrorCode =
  | Extract<
      BarbershopErrorCode,
      "barbershop_name_required" | "barbershop_name_too_long" | "phone_invalid"
    >
  | "address_too_long"
  | "locality_too_long"
  | "location_invalid";

// An optional text: blank is null, otherwise trimmed and capped.
function optionalText(max: number, code: ShopProfileErrorCode) {
  return z.string({ error: code }).transform((value, ctx) => {
    const text = value.trim();
    if (text === "") return null;
    if (text.length > max) {
      ctx.addIssue({ code: "custom", message: code });
      return z.NEVER;
    }
    return text;
  });
}

// "4.667123,-74.054500": what the location button writes in the form.
// Plain decimals only (no exponents, NaN or Infinity), within the globe; the
// database checks the same ranges and that both go together.
const LOCATION = /^(-?\d{1,3}(?:\.\d{1,12})?),(-?\d{1,3}(?:\.\d{1,12})?)$/;

// The location in a form value: null when empty, undefined when unreadable.
export function readLocation(value: string): ShopLocation | null | undefined {
  const text = value.trim();
  if (text === "") return null;
  const match = LOCATION.exec(text);
  if (!match) return undefined;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

// Six decimals: about 11 cm, more than a phone's GPS can tell.
export function formatLocation({ latitude, longitude }: ShopLocation): string {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

// The point in Google Maps, in a new tab: a plain link, no API key and no
// map service of our own (decision 0007; decision P2 of task 2.4).
export function mapsUrl(location: ShopLocation): string {
  const query = encodeURIComponent(formatLocation(location));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// A saved WhatsApp as the owner would type it: "300 123 4567" for a
// Colombian mobile; anything else exactly as saved.
export function displayWhatsapp(phone: string | null): string {
  if (!phone) return "";
  const mobile = /^\+57(3\d{2})(\d{3})(\d{4})$/.exec(phone);
  return mobile ? `${mobile[1]} ${mobile[2]} ${mobile[3]}` : phone;
}

// The form of D-57 as sent: name, address, locality, whatsappPhone and
// location ("lat,lng" or empty). The WhatsApp must be a Colombian mobile,
// like the one of the sign-up; one saved another way (from abroad, by the
// support team) is kept when it comes back unchanged.
export function parseShopProfile(
  input: unknown,
  saved: { whatsappPhone: string | null },
): ParseResult<ShopProfile, ShopProfileErrorCode> {
  const schema = z.object({
    name: barbershopNameSchema,
    address: optionalText(ADDRESS_MAX_LENGTH, "address_too_long"),
    locality: optionalText(LOCALITY_MAX_LENGTH, "locality_too_long"),
    whatsappPhone: z
      .string({ error: "phone_invalid" })
      .transform((value, ctx) => {
        if (saved.whatsappPhone && value.trim() === saved.whatsappPhone) {
          return saved.whatsappPhone;
        }
        const phone = normalizeColombianMobile(value);
        if (!phone) {
          ctx.addIssue({ code: "custom", message: "phone_invalid" });
          return z.NEVER;
        }
        return phone;
      }),
    location: z
      .string({ error: "location_invalid" })
      .transform((value, ctx) => {
        const location = readLocation(value);
        if (location === undefined) {
          ctx.addIssue({ code: "custom", message: "location_invalid" });
          return z.NEVER;
        }
        return location;
      }),
  });
  return parseWith(schema, input);
}
