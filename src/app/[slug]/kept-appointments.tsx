"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatCalendarDay,
  formatWallClock,
  toBogotaDate,
  toBogotaTime,
} from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { CalendarIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import {
  appointmentStorage,
  type StoredAppointment,
} from "./appointment-storage";

const t = textos.reservas.gestionar.aviso;

// C-01 (task 3.4): the next appointment this phone booked at this
// barbershop, with its link, while there is no confirmation email. Nothing
// on a phone that booked none, or with storage blocked.
export function KeptAppointments({ slug }: { slug: string }) {
  const [next, setNext] = useState<StoredAppointment | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of browser storage after mounting
    setNext(appointmentStorage.upcoming(slug)[0] ?? null);
  }, [slug]);
  if (!next) return null;

  const start = new Date(next.startsAt);
  return (
    <Notice
      tone="info"
      icon={<CalendarIcon size={20} />}
      title={t.titulo(
        `${formatCalendarDay(toBogotaDate(start))} · ${formatWallClock(toBogotaTime(start))}`,
      )}
      action={
        <Link
          href={routes.manageAppointment(next.token)}
          className="text-brand-strong text-sm font-bold"
        >
          {t.ver}
        </Link>
      }
    />
  );
}
