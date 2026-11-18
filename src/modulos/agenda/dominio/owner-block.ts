import type { BogotaDate } from "@/lib/fechas/fechas";
import { isId } from "@/modulos/barberias/dominio/service";
import { closedBlockDays } from "./barber-agenda";
import type { AgendaBarber, AgendaData } from "./owner-agenda";

// "Bloquear horas" of the owner (D-39, task 8.14): what is blocked.
// - mine: the owner's own agenda, their row of barbers (is_owner), when they
//   attend. The server finds that row; the browser never names it.
// - barber: another professional of the establishment, by id (the database
//   checks it is of the owner's establishment and active).
// - shop: the whole establishment, a closure without professional.
export const BLOCK_TARGETS = ["mine", "barber", "shop"] as const;
export type BlockTargetKind = (typeof BLOCK_TARGETS)[number];

export type BlockTarget =
  { kind: "mine" } | { kind: "barber"; barberId: string } | { kind: "shop" };

// The fields "para" (the kind) and "profesional" (the id, for barber only).
export function parseBlockTarget(
  kind: string,
  barberId: string,
): BlockTarget | null {
  if (kind === "mine") return { kind: "mine" };
  if (kind === "shop") return { kind: "shop" };
  if (kind === "barber" && isId(barberId)) return { kind: "barber", barberId };
  return null;
}

// The days of the picker with nothing open to block for a professional, or
// for the whole establishment (barber null): the rule of task 7.4, as the
// database applies it (private.block_has_open_time). The establishment is
// open in its own hours, whoever works them.
export function ownerClosedBlockDays(
  agenda: Pick<AgendaData, "shopHours" | "holidayOpenings" | "blocks">,
  barber: Pick<AgendaBarber, "usesBarbershopHours" | "shifts"> | null,
  days: readonly BogotaDate[],
): BogotaDate[] {
  return closedBlockDays(
    {
      schedule: barber
        ? {
            usesBarbershopHours: barber.usesBarbershopHours,
            shifts: barber.shifts,
          }
        : { usesBarbershopHours: true, shifts: [] },
      shopHours: agenda.shopHours,
      holidayOpenings: agenda.holidayOpenings,
      // Only the closures of the whole establishment close time for others.
      blocks: agenda.blocks.map((block) => ({
        id: block.id,
        start: block.start,
        end: block.end,
        reason: block.reason,
        own: block.barberId !== null,
      })),
    },
    days,
  );
}
