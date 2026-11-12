import { formatWallClock, toBogotaTime } from "@/lib/fechas/fechas";
import { dayParts, sinceParts } from "@/modulos/clientes/dominio/customers";
import { textos } from "@/ui/textos";

const t = textos.clientes;

// Days and times of D-40 and D-41, in Bogotá.

// "hoy", "24 oct" or "3 dic 2025".
export function shortDay(instant: Date, now: Date): string {
  const parts = dayParts(instant, now);
  if (parts.today) return t.hoy;
  const year = parts.year ? ` ${parts.year}` : "";
  return `${parts.day} ${t.mesesCortos[parts.month]}${year}`;
}

// "hoy", "el 7 de nov" or "el 3 de dic de 2025", inside a sentence.
function dayInSentence(instant: Date, now: Date): string {
  const parts = dayParts(instant, now);
  if (parts.today) return t.hoy;
  const year = parts.year ? ` de ${parts.year}` : "";
  return `el ${parts.day} de ${t.mesesCortos[parts.month]}${year}`;
}

// "4:00 p. m."
export function timeOf(instant: Date): string {
  return formatWallClock(toBogotaTime(instant));
}

// The alert of D-41: "No llegó el 7 de nov ni el 12 de oct. …", with the
// latest three days and then how many more. days come the latest first.
export function noShowSentence(days: readonly Date[], now: Date): string {
  const shown = days.slice(0, 3).map((day) => dayInSentence(day, now));
  const rest = days.length - shown.length;
  if (rest > 0) {
    shown.push(
      rest === 1 ? t.ficha.alerta.otraVez : t.ficha.alerta.otrasVeces(rest),
    );
  }
  const list =
    shown.length <= 1
      ? (shown[0] ?? "")
      : `${shown.slice(0, -1).join(", ")} ${t.ficha.alerta.ni} ${shown.at(-1)}`;
  return t.ficha.alerta.cuerpo(list);
}

// "Cliente desde agosto 2026".
export function customerSince(createdAt: Date): string {
  const { month, year } = sinceParts(createdAt);
  return t.ficha.desde(t.meses[month] ?? "", year);
}
