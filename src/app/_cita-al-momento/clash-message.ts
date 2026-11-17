import { formatWallClock, toBogotaTime } from "@/lib/fechas/fechas";
import type { WalkInClash } from "@/modulos/agenda/dominio/walk-in";
import { textos } from "@/ui/textos";

const t = textos.citaAlMomento.choque;

// What the screen says when a walk-in does not fit now (decision D5): with
// what it clashes and how much time is free. `who` is the professional's
// name in the owner's screen, and null in the professional's own, which
// speaks to them ("Tienes una cita a las 3:30 p. m.").
export function clashLines(
  clash: WalkInClash | null,
  who: string | null,
  serviceCount: number,
): string[] {
  if (!clash) return [t.sinDetalle];
  const hour = clash.at ? formatWallClock(toBogotaTime(clash.at)) : "";
  const what =
    clash.kind === "closed" ? t.closed(who) : t[clash.kind](who, hour);
  return [
    what,
    t.libres(
      who,
      clash.freeMinutes,
      Math.max(serviceCount, 1),
      clash.neededMinutes,
    ),
  ];
}
