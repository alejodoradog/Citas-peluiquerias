import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { toBogotaDate, toBogotaTime } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import {
  linkOfMyAppointment,
  loadMyAppointments,
} from "@/modulos/agenda/datos/my-appointments";
import { loadPublicProfile } from "@/modulos/agenda/datos/public-booking";
import { buttonClasses } from "@/ui/button";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { ManageHeader } from "../../../c/[token]/manage-header";
import { whenLine } from "../../reservar/summary";

const t = textos.reservas.misCitas;

// The link is a credential: no search engine keeps it, and no page it opens
// learns it from the Referer.
export const metadata: Metadata = {
  title: t.tituloPestana,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// C-21: the upcoming appointments of the customer of the link, each with its
// own link to "Gestionar mi cita" (task 3.4). After 24 hours the link asks
// for a new one.
export default function MyAppointmentsListPage({
  params,
}: PageProps<"/[slug]/mis-citas/[token]">) {
  return (
    <Suspense fallback={<LoadingState label={textos.reservas.cargando} />}>
      <MyAppointmentsList params={params} />
    </Suspense>
  );
}

async function MyAppointmentsList({
  params,
}: Pick<PageProps<"/[slug]/mis-citas/[token]">, "params">) {
  const { slug, token } = await params;
  // Always live: the list changes with every booking, move or cancellation.
  await connection();
  const [list, profile] = await Promise.all([
    loadMyAppointments(token),
    loadPublicProfile(slug),
  ]);
  const shopSlug = list?.slug ?? profile?.slug ?? slug;

  if (!list || list.slug !== slug) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        {profile ? (
          <ManageHeader name={profile.name} locality={profile.locality} />
        ) : null}
        <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pt-6 pb-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-title">{t.vencido.titulo}</h1>
            <p className="text-body text-muted">{t.vencido.detalle}</p>
          </div>
          <Link
            href={routes.myAppointments(shopSlug)}
            className={buttonClasses()}
          >
            {t.vencido.pedir}
          </Link>
        </main>
      </div>
    );
  }

  const rows = await Promise.all(
    list.appointments.map(async (appointment) => ({
      appointment,
      link: await linkOfMyAppointment(token, appointment.id),
    })),
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ManageHeader
        name={list.barbershopName}
        locality={profile?.locality ?? null}
      />
      <main className="mx-auto flex w-full max-w-md flex-col gap-3.5 px-5 pt-2.5 pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title">
            {t.lista.titulo(list.customerFirstName)}
          </h1>
          {rows.length > 0 ? (
            <p className="text-body text-muted">{t.lista.bajada}</p>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <>
            <p className="text-body">{t.lista.vacia}</p>
            <Link href={routes.booking(list.slug)} className={buttonClasses()}>
              {t.lista.reservar}
            </Link>
          </>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(({ appointment, link }) => {
              const minutes = Math.round(
                (appointment.end.getTime() - appointment.start.getTime()) /
                  60_000,
              );
              return (
                <li
                  key={appointment.id}
                  className="border-line rounded-card flex flex-col gap-2 border bg-white p-4"
                >
                  <p className="text-[1.0625rem] font-bold">
                    {whenLine(
                      toBogotaDate(appointment.start),
                      toBogotaTime(appointment.start),
                    )}
                  </p>
                  <p className="text-body text-muted">
                    {`${appointment.serviceNames.join(" + ")} · ${textos.reservas.minutos(minutes)} · ${appointment.barberName}`}
                  </p>
                  <p className="text-body font-semibold">
                    {formatPesos(appointment.priceCop)}
                  </p>
                  {link ? (
                    <Link
                      href={routes.manageAppointment(link)}
                      className={buttonClasses({ variant: "secondary" })}
                    >
                      {t.lista.ver}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
