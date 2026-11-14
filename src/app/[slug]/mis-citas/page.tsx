import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import { loadPublicProfile } from "@/modulos/agenda/datos/public-booking";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { ManageHeader } from "../../c/[token]/manage-header";
import { MyAppointmentsForm } from "./my-appointments-form";

const t = textos.reservas.misCitas;

export const metadata: Metadata = {
  title: t.tituloPestana,
  robots: { index: false, follow: false },
};

// C-19 and C-20, "Mis citas": the customer writes their email and gets, by
// email, a link to their upcoming appointments in this barbershop.
export default function MyAppointmentsPage({
  params,
}: PageProps<"/[slug]/mis-citas">) {
  return (
    <Suspense fallback={<LoadingState label={textos.reservas.cargando} />}>
      <MyAppointments params={params} />
    </Suspense>
  );
}

async function MyAppointments({
  params,
}: Pick<PageProps<"/[slug]/mis-citas">, "params">) {
  const { slug } = await params;
  const profile = await loadPublicProfile(slug);
  if (!profile) notFound();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ManageHeader
        name={profile.name}
        locality={profile.locality}
        backHref={routes.booking(profile.slug)}
      />
      <MyAppointmentsForm slug={profile.slug} name={profile.name} />
    </div>
  );
}
