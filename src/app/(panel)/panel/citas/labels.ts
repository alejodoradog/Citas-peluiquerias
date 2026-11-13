import {
  formatShortWallClock,
  formatWallClock,
  toBogotaDate,
  toBogotaTime,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import { textos } from "@/ui/textos";
import { dayTitle, timeLabel } from "../agenda-labels";

const t = textos.agenda.detalleCita;

// "10:40 – 11:40 a. m." when both ends are in the same half of the day,
// "11:30 a. m. – 12:30 p. m." otherwise.
export function timeRange(start: Date, end: Date): string {
  const from = toBogotaTime(start);
  const until = toBogotaTime(end);
  const sameHalf =
    Number(from.slice(0, 2)) < 12 === Number(until.slice(0, 2)) < 12;
  return sameHalf
    ? `${formatShortWallClock(from)} – ${formatWallClock(until)}`
    : `${formatWallClock(from)} – ${formatWallClock(until)}`;
}

// D-34, "Cuándo": "Hoy, sábado 7 de nov · 10:40 – 11:40 a. m."
export function whenLabel(start: Date, end: Date, today: BogotaDate): string {
  const [from, until] = timeRange(start, end).split(" – ");
  return t.horario(dayTitle(toBogotaDate(start), today), from!, until!);
}

// D-36 and D-37: "hoy 10:40 a. m." or "domingo 8 de nov 10:40 a. m."
export function shortWhen(start: Date, today: BogotaDate): string {
  const day = dayTitle(toBogotaDate(start), today);
  const short = day.startsWith("Hoy, ")
    ? "hoy"
    : day.charAt(0).toLowerCase() + day.slice(1);
  return `${short} ${timeLabel(start)}`;
}

// D-34: "hace 20 min", "hace 3 horas", or the day for older ones.
export function agoLabel(
  createdAt: Date,
  now: Date,
  today: BogotaDate,
): string {
  const minutes = Math.floor((now.getTime() - createdAt.getTime()) / 60_000);
  if (minutes < 60) return t.haceMinutos(Math.max(0, minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.haceHoras(hours);
  return dayTitle(toBogotaDate(createdAt), today);
}
