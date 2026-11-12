import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { fromBogota } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { chosenServices } from "@/modulos/agenda/datos/public-availability";
import { loadManagedAppointment } from "@/modulos/agenda/datos/manage-appointment";
import { MANAGE_TOKEN_COOKIE } from "@/modulos/agenda/datos/manage-cookie";
import { loadPublicProfile } from "@/modulos/agenda/datos/public-booking";
import {
  isUuid,
  readBookingParams,
} from "@/modulos/agenda/dominio/booking-flow";
import { buttonClasses } from "@/ui/button";
import { CopyButton } from "@/ui/copy-button";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import {
  calendarUrl,
  directionsUrl,
  OutsideLink,
  whatsappUrl,
} from "../../booking-ui";
import { servicesLine, whenLine } from "../summary";
import { ConfirmedGreeting } from "./confirmed-greeting";
import { ManageLink } from "./manage-link";

const t = textos.reservas.confirmada;

export const metadata: Metadata = {
  title: textos.marca,
  robots: { index: false, follow: false },
};

// C-08. Only public data travels in the URL (services, barber, day and
// time); the customer's name comes from this phone (customer-storage.ts).
// The confirmation email arrives with phase 5: this screen does not promise
// it. Until then the link to cancel or change (task 3.4) is given here, from
// the short cookie of the booking (manage-cookie.ts), and only when it is
// the link of this same appointment.
export default function BookingConfirmedPage({
  params,
  searchParams,
}: PageProps<"/[slug]/reservar/confirmada">) {
  return (
    <Suspense fallback={<LoadingState label={textos.reservas.cargando} />}>
      <Confirmed params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Confirmed({
  params,
  searchParams,
}: Pick<PageProps<"/[slug]/reservar/confirmada">, "params" | "searchParams">) {
  const { slug } = await params;
  const query = await searchParams;
  const profile = await loadPublicProfile(slug);
  if (!profile) notFound();
  const selection = readBookingParams(query);
  const chosen = chosenServices(profile, selection.serviceIds);
  const barber = profile.barbers.find((b) => b.id === selection.barber);
  if (selection.step !== "datos" || !chosen || !barber || !isUuid(barber.id)) {
    redirect(routes.booking(profile.slug));
  }
  const start = fromBogota(selection.date!, selection.time!);
  const end = new Date(start.getTime() + chosen.minutes * 60_000);
  const place = [profile.name, profile.address, profile.locality]
    .filter(Boolean)
    .join(", ");
  const directions = directionsUrl(profile);
  const assigned = query.asignado === "1";
  const token = (await cookies()).get(MANAGE_TOKEN_COOKIE.name)?.value;
  const managed = token ? await loadManagedAppointment(token) : null;
  const manageToken =
    managed &&
    managed.slug === profile.slug &&
    managed.barberId === barber.id &&
    managed.start.getTime() === start.getTime()
      ? token!
      : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pt-10 pb-7.5">
      <div className="flex flex-col gap-1.5">
        <ConfirmedGreeting />
        <p className="text-body text-muted">{t.bajada}</p>
      </div>
      <dl className="border-line rounded-card flex flex-col gap-3.5 border bg-white p-4">
        <Item label={t.cuando}>
          {whenLine(selection.date!, selection.time!)}
        </Item>
        <Item label={t.servicios}>
          {servicesLine({
            services: chosen.services,
            durationMinutes: chosen.minutes,
          })}
        </Item>
        <Item label={t.con}>
          {assigned ? t.asignado(barber.name) : barber.name}
        </Item>
        <Item label={t.donde}>
          {profile.name}
          {profile.address ? (
            <>
              <br />
              {[profile.address, profile.locality].filter(Boolean).join(", ")}
            </>
          ) : null}
        </Item>
        <div className="flex items-center justify-between gap-3 text-[0.9375rem]">
          <dt className="text-muted">{t.pagas}</dt>
          <dd>
            <strong className="text-[1.0625rem]">
              {formatPesos(chosen.priceCop)}
            </strong>
          </dd>
        </div>
      </dl>
      {profile.deposit ? (
        <section
          aria-labelledby="abono"
          className="border-line rounded-card flex flex-col gap-2.5 border bg-white p-4"
        >
          <h2 id="abono" className="text-[0.9375rem] font-bold">
            {t.abono}
          </h2>
          <p className="text-muted text-sm">{t.abonoBajada}</p>
          <p className="text-sm">
            <span className="text-muted">
              {t.metodos[profile.deposit.method] ?? profile.deposit.method}
            </span>
            <br />
            <strong>{profile.deposit.account}</strong>
          </p>
          <CopyButton
            text={profile.deposit.account}
            label={textos.ui.linkReservas.copiar}
            copiedLabel={textos.ui.linkReservas.copiado}
          />
        </section>
      ) : null}
      <a
        href={calendarUrl(t.calendarioTitulo(profile.name), start, end, place)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses()}
      >
        {t.calendario}
      </a>
      <div className="flex flex-col gap-2.5">
        {directions ? (
          <OutsideLink href={directions}>
            {textos.reservas.perfil.comoLlegar}
          </OutsideLink>
        ) : null}
        {profile.whatsappPhone ? (
          <OutsideLink href={whatsappUrl(profile.whatsappPhone)}>
            {textos.reservas.perfil.whatsapp}
          </OutsideLink>
        ) : null}
      </div>
      {manageToken ? (
        <>
          <ManageLink
            token={manageToken}
            slug={profile.slug}
            startsAt={start.toISOString()}
          />
          <p className="text-muted text-sm">
            {t.gestionarAyuda(profile.cancellationNoticeHours)}
          </p>
        </>
      ) : (
        <p className="text-muted text-sm">{t.cancelar}</p>
      )}
      <Link
        href={routes.booking(profile.slug)}
        className={buttonClasses({ variant: "text", size: "md" })}
      >
        {t.reservarOtra}
      </Link>
    </main>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-help text-muted">{label}</dt>
      <dd className="text-[0.9375rem] leading-[1.4] font-semibold">
        {children}
      </dd>
    </div>
  );
}
