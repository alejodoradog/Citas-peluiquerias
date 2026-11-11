import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { formatWallClock, now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import {
  loadPublicProfile,
  type PublicProfile,
} from "@/modulos/agenda/datos/public-booking";
import { openingOf, weekRows } from "@/modulos/agenda/dominio/booking-flow";
import { resolveRetiredSlug } from "@/modulos/barberias/datos/public-barbershop";
import { buttonClasses } from "@/ui/button";
import { ClockIcon, InfoIcon, MapPinIcon } from "@/ui/icons";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import {
  Cover,
  directionsUrl,
  OutsideLink,
  SectionTitle,
  ShopLogo,
  whatsappUrl,
} from "./booking-ui";

const t = textos.reservas;
// C-01 lists the first services; the rest are on C-02.
const SERVICES_ON_PROFILE = 3;

export async function generateMetadata({
  params,
}: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadPublicProfile(slug);
  return { title: profile ? t.tituloPestana(profile.name) : textos.marca };
}

// The booking link (yapoin.com/<slug>) of the QR and the poster of D-62:
// C-01, or C-17 when the barbershop takes no bookings. A link a barbershop
// left (D-61) leads to its current one, so printed QR codes keep working
// (decision P1 of task 2.4); any other link is C-18 (not-found.tsx).
export default function BookingProfilePage({ params }: PageProps<"/[slug]">) {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <BookingProfile params={params} />
    </Suspense>
  );
}

async function BookingProfile({
  params,
}: Pick<PageProps<"/[slug]">, "params">) {
  const { slug } = await params;
  // This page reads the moment of the request ("Abierto hoy", and how long
  // an old link stays set aside): the profile itself is cached, the time is
  // not.
  await connection();
  const profile = await loadPublicProfile(slug);
  if (!profile) {
    const current = await resolveRetiredSlug(slug);
    // Inside Suspense the response has started, so Next.js sends this
    // redirect as a meta refresh the browser follows, not as a 308.
    if (current) permanentRedirect(routes.booking(current));
    notFound();
  }
  return profile.acceptsBookings ? (
    <Profile profile={profile} today={toBogotaDate(now())} />
  ) : (
    <Suspended profile={profile} />
  );
}

function Profile({
  profile,
  today,
}: {
  profile: PublicProfile;
  today: string;
}) {
  const opening = openingOf(today, profile.shopHours, profile.holidayOpenings);
  const directions = directionsUrl(profile);
  const address = [profile.address, profile.locality]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="mx-auto flex w-full max-w-md flex-col pb-7.5">
      <Cover path={profile.coverPhotoPath} height={190} />
      <main className="flex flex-col">
        <div className="-mt-9.5 flex flex-col gap-3.5 px-5">
          <ShopLogo name={profile.name} path={profile.logoPath} />
          <h1 className="text-title">{profile.name}</h1>
          <div className="text-muted flex flex-col gap-1.5 text-sm">
            {address ? (
              <span className="flex items-center gap-1.5">
                <MapPinIcon size={16} />
                {address}
              </span>
            ) : null}
            <span
              className={
                opening
                  ? "text-success flex items-center gap-1.5 font-semibold"
                  : "flex items-center gap-1.5 font-semibold"
              }
            >
              <ClockIcon size={16} />
              {opening
                ? t.perfil.abiertoHoy(
                    formatWallClock(opening.start),
                    formatWallClock(opening.end),
                  )
                : t.perfil.cerradoHoy}
            </span>
          </div>
          <Link
            href={routes.bookingFlow(profile.slug)}
            className={buttonClasses()}
          >
            {t.perfil.reservar}
          </Link>
          <div className="flex flex-col gap-2.5">
            {profile.whatsappPhone ? (
              <OutsideLink href={whatsappUrl(profile.whatsappPhone)}>
                {t.perfil.whatsapp}
              </OutsideLink>
            ) : null}
            {directions ? (
              <OutsideLink href={directions}>{t.perfil.comoLlegar}</OutsideLink>
            ) : null}
          </div>
        </div>

        {profile.services.length > 0 ? (
          <section
            aria-labelledby="servicios"
            className="flex flex-col gap-2.5 px-5 pt-5.5"
          >
            <h2 id="servicios" className="text-base font-semibold">
              {t.perfil.servicios}
            </h2>
            <ul className="border-line rounded-card divide-line divide-y border bg-white">
              {profile.services.slice(0, SERVICES_ON_PROFILE).map((service) => (
                <li
                  key={service.id}
                  className="flex min-h-13 items-center justify-between gap-3 px-4 py-3.5"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[0.9375rem] font-semibold">
                      {service.name}
                    </span>
                    <span className="text-help text-muted">
                      {t.minutos(service.durationMinutes)}
                    </span>
                  </span>
                  <strong>{formatPesos(service.priceCop)}</strong>
                </li>
              ))}
            </ul>
            {profile.services.length > SERVICES_ON_PROFILE ? (
              <Link
                href={routes.bookingFlow(profile.slug)}
                className={buttonClasses({ variant: "text", size: "md" })}
              >
                {t.perfil.verServicios(profile.services.length)}
              </Link>
            ) : null}
          </section>
        ) : null}

        <section
          aria-labelledby="horario"
          className="flex flex-col gap-2.5 px-5 pt-2.5"
        >
          <h2 id="horario" className="pt-3 text-base font-semibold">
            {t.perfil.horario}
          </h2>
          <dl className="border-line rounded-card flex flex-col gap-1 border bg-white p-4">
            {weekRows(profile.shopHours).map((row) => (
              <div
                key={row.fromDay}
                className="flex justify-between gap-3 py-1 text-[0.9375rem]"
              >
                <dt className="text-muted">
                  {row.fromDay === row.toDay
                    ? t.dias[row.fromDay]
                    : t.perfil.rango(t.dias[row.fromDay]!, t.dias[row.toDay]!)}
                </dt>
                <dd className="text-right font-semibold">
                  {row.shifts.length === 0
                    ? t.perfil.cerrado
                    : row.shifts
                        .map(
                          (s) =>
                            `${formatWallClock(s.start)} – ${formatWallClock(s.end)}`,
                        )
                        .join(", ")}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 py-1 text-[0.9375rem]">
              <dt className="text-muted">{t.perfil.festivos}</dt>
              <dd className="text-right font-semibold">
                {t.perfil.festivosCerrado}
              </dd>
            </div>
          </dl>
        </section>

        {address ? (
          <section
            aria-labelledby="ubicacion"
            className="flex flex-col gap-2.5 px-5 pt-5.5"
          >
            <SectionTitle>
              <span id="ubicacion">{t.perfil.ubicacion}</span>
            </SectionTitle>
            <p className="border-line rounded-card flex items-start gap-2 border bg-white p-4 text-[0.9375rem]">
              <MapPinIcon size={18} />
              {address}
            </p>
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="text-muted flex flex-col items-center gap-1 px-5 pt-6.5 text-xs">
      <span>
        {t.perfil.reservasCon} <strong>{textos.marca}</strong>
      </span>
      <Link href={routes.privacy} className="text-muted">
        {t.perfil.politicaDatos}
      </Link>
    </footer>
  );
}

// C-17: no services and no "Reservar"; the WhatsApp and the way there. The
// appointments already taken stand.
function Suspended({ profile }: { profile: PublicProfile }) {
  const directions = directionsUrl(profile);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <Cover path={profile.coverPhotoPath} height={160} />
      <main className="flex flex-col gap-4 p-5">
        <h1 className="text-title">{profile.name}</h1>
        <div
          role="status"
          className="bg-neutral-soft flex gap-2.5 rounded-[14px] px-3.5 py-3"
        >
          <span className="text-muted">
            <InfoIcon size={20} />
          </span>
          <div className="flex flex-col gap-1">
            <strong className="text-muted text-sm">
              {t.suspendida.titulo}
            </strong>
            <span className="text-help">
              {profile.whatsappPhone
                ? t.suspendida.bajada
                : t.suspendida.bajadaSinWhatsapp}
            </span>
          </div>
        </div>
        {profile.whatsappPhone ? (
          <OutsideLink
            href={whatsappUrl(profile.whatsappPhone)}
            size="lg"
            variant="primary"
          >
            {t.suspendida.whatsapp}
          </OutsideLink>
        ) : null}
        {directions ? (
          <OutsideLink href={directions} size="lg">
            {t.perfil.comoLlegar}
          </OutsideLink>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
