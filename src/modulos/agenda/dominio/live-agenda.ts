import type { BogotaDate } from "@/lib/fechas/fechas";
import type { AgendaView } from "./owner-agenda";

// Task 4.5: the owner's agenda of today asks the server again every minute,
// while the tab is visible, so a booking that arrives shows up without
// reloading (decision 0007, point 13: no Realtime). 60 s is the cheap end of
// its 30–60 s range: every refresh is one invocation of a Vercel function.
export const LIVE_REFRESH_MS = 60_000;

// Only the day of today (D-30, D-31): bookings arrive there. The week (D-32)
// and other days stay as they were opened.
export function pollsLive({
  view,
  date,
  today,
}: {
  view: AgendaView;
  date: BogotaDate;
  today: BogotaDate;
}): boolean {
  return view === "dia" && date === today;
}
