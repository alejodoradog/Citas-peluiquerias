// Colombia stays on UTC-5 all year, so a fixed offset is exact.
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const LOCALE = "es-CO";
const TIME_ZONE = "America/Bogota";

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  dateStyle: "full",
});
const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  timeStyle: "short",
});

// Calendar dates ("2026-11-03") and times ("14:30") in Colombia are plain text
// so a day can never shift with the server's time zone.
export type BogotaDate = string;
function parseDateToUtcMs(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const ms = match
    ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : NaN;

  // Date.UTC rolls impossible dates over, so 02-30 comes back as another day.
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Invalid date: ${date}`);
  }
  return ms;
}

function parseTimeToMs(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    throw new RangeError(`Invalid time: ${time}`);
  }
  return (Number(match[1]) * 60 + Number(match[2])) * 60 * 1000;
}

function toBogotaIso(instant: Date): string {
  return new Date(instant.getTime() - BOGOTA_OFFSET_MS).toISOString();
}

export function now(): Date {
  return new Date();
}

export function toBogotaDate(instant: Date): string {
  return toBogotaIso(instant).slice(0, 10);
}

export function toBogotaTime(instant: Date): string {
  return toBogotaIso(instant).slice(11, 16);
}

export function fromBogota(date: string, time: string): Date {
  return new Date(
    parseDateToUtcMs(date) + parseTimeToMs(time) + BOGOTA_OFFSET_MS,
  );
}

export function startOfBogotaDay(date: string): Date {
  return fromBogota(date, "00:00");
}

export function addDays(date: string, days: number): string {
  return new Date(parseDateToUtcMs(date) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// 0 is Sunday and 6 is Saturday.
export function getWeekday(date: string): number {
  return new Date(parseDateToUtcMs(date)).getUTCDay();
}

export function formatBogotaDate(instant: Date): string {
  return dateFormatter.format(instant);
}

export function formatBogotaTime(instant: Date): string {
  return timeFormatter.format(instant);
}

const dayMonthFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
});

// "24 de noviembre", as D-14 writes the end of the trial.
export function formatBogotaDayMonth(instant: Date): string {
  return dayMonthFormatter.format(instant);
}

// A wall clock time of a weekly schedule ("09:00" or "09:00:00") as people
// read it: "9:00 a. m.", "8:30 p. m.", "12:00 m." stays "12:00 p. m.".
// Intl puts a narrow no-break space before "a. m."; screens use a plain one.
export function formatWallClock(time: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) throw new RangeError(`Invalid time: ${time}`);
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours < 12 ? "a. m." : "p. m.";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}
