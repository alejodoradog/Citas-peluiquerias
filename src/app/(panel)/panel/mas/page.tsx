import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { formatBogotaDayMonth, startOfBogotaDay } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { displayBookingUrl } from "@/lib/sitio";
import { countActive } from "@/modulos/barberias/datos/services";
import { Chip } from "@/ui/chip";
import {
  BarChartIcon,
  CalendarIcon,
  ClockIcon,
  DollarIcon,
  LinkIcon,
  ScissorsIcon,
  SlidersIcon,
  StoreIcon,
  UserIcon,
  UsersIcon,
} from "@/ui/icons";
import { List, ListRow } from "@/ui/list";
import { Notice } from "@/ui/notice";
import { SignOutButton } from "@/ui/sign-out-button";
import { LoadingState } from "@/ui/states";
import { TabShell } from "@/ui/tab-shell";
import { textos } from "@/ui/textos";
import { requireReadyOwner } from "../ready-owner";

const t = textos.mas;

export const metadata: Metadata = { title: t.titulo };

// D-50: the owner's settings. Servicios and Barberos work now; the other rows
// arrive with tasks 2.4, 2.6 and 4.6 and show "Pronto" without a link
// (decision 9 of task 2.2). Its top bar names the barbershop, as the design
// does, so the whole frame waits for it; "Cerrar sesión" is in "Tu cuenta".
export default function MorePage() {
  return (
    <Suspense
      fallback={
        <TabShell title={t.titulo}>
          <LoadingState label={t.cargando} />
        </TabShell>
      }
    >
      <More />
    </Suspense>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-label text-muted">{title}</h2>
      <List>{children}</List>
    </section>
  );
}

const soon = <Chip tone="warning">{t.pronto}</Chip>;

async function More() {
  const { email, barbershop } = await requireReadyOwner();
  const counts = await countActive(barbershop.id);
  const trialEnd = formatBogotaDayMonth(startOfBogotaDay(barbershop.expiresOn));

  return (
    <TabShell title={t.titulo} subtitle={barbershop.name}>
      <div className="flex flex-col gap-4">
        {barbershop.subscriptionStatus === "trial" ? (
          <Notice tone="info" title={t.prueba(trialEnd)}>
            {t.pruebaDetalle}
          </Notice>
        ) : null}
        <Section title={t.secciones.equipo}>
          <ListRow
            icon={<ScissorsIcon />}
            title={t.servicios}
            subtitle={t.conteoServicios(counts.services)}
            href={routes.panelServices}
          />
          <ListRow
            icon={<UsersIcon />}
            title={t.barberos}
            subtitle={t.conteoBarberos(counts.barbers)}
            href={routes.panelBarbers}
          />
        </Section>
        <Section title={t.secciones.barberia}>
          <ListRow icon={<StoreIcon />} title={t.datos} trailing={soon} />
          <ListRow icon={<ClockIcon />} title={t.horario} trailing={soon} />
          <ListRow icon={<CalendarIcon />} title={t.festivos} trailing={soon} />
          <ListRow icon={<SlidersIcon />} title={t.politicas} trailing={soon} />
          <ListRow
            icon={<LinkIcon />}
            title={t.link}
            subtitle={displayBookingUrl(barbershop.slug)}
            trailing={soon}
          />
        </Section>
        <Section title={t.secciones.dinero}>
          <ListRow icon={<DollarIcon />} title={t.abono} trailing={soon} />
          <ListRow icon={<BarChartIcon />} title={t.cierre} trailing={soon} />
        </Section>
        <Section title={t.secciones.cuenta}>
          <ListRow icon={<UserIcon />} title={email} subtitle={t.correo} />
          <li>
            <SignOutButton row />
          </li>
        </Section>
      </div>
    </TabShell>
  );
}
