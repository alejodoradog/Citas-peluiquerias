import { z } from "zod";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";
import { normalizeColombianMobile } from "./phone";
import {
  barbershopNameSchema,
  type BarbershopErrorCode,
} from "./registration";

// "Nueva sede" (task 2.6): the name, with the rules of sign-up, and an
// optional WhatsApp. Without one, create_barbershop uses the owner's own
// mobile, as sign-up does.
export type NewBarbershopErrorCode = Extract<
  BarbershopErrorCode,
  "barbershop_name_required" | "barbershop_name_too_long" | "phone_invalid"
>;

const newBarbershopSchema = z.object({
  name: barbershopNameSchema,
  whatsappPhone: z
    .string({ error: "phone_invalid" })
    .transform((value, ctx) => {
      if (value.trim() === "") return null;
      const phone = normalizeColombianMobile(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "phone_invalid" });
        return z.NEVER;
      }
      return phone;
    }),
});

export type NewBarbershop = z.output<typeof newBarbershopSchema>;

export function parseNewBarbershop(
  input: unknown,
): ParseResult<NewBarbershop, NewBarbershopErrorCode> {
  return parseWith(newBarbershopSchema, input);
}
