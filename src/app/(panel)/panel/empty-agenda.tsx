import type { ReactNode } from "react";
import { routes } from "@/lib/routes";
import { ButtonLink } from "@/ui/button";
import { LinkIcon, PlusIcon, ShareIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";

const t = textos.agenda.vacia;

// D-33: until the first appointment, the agenda says how to get one.
export function EmptyAgenda({ newAppointment }: { newAppointment: string }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
      <Step
        icon={<ShareIcon size={28} />}
        title={t.compartir.titulo}
        body={t.compartir.cuerpo}
        action={
          <ButtonLink href={routes.panelShare} size="md" block>
            {t.compartir.boton}
          </ButtonLink>
        }
      />
      <Step
        icon={<LinkIcon size={28} />}
        title={t.barberos.titulo}
        body={t.barberos.cuerpo}
        action={
          <ButtonLink
            href={routes.panelBarbers}
            variant="secondary"
            size="md"
            block
          >
            {t.barberos.boton}
          </ButtonLink>
        }
      />
      <Step
        icon={<PlusIcon size={28} />}
        title={t.manual.titulo}
        action={
          <ButtonLink href={newAppointment} variant="secondary" size="md" block>
            {t.manual.boton}
          </ButtonLink>
        }
      />
    </div>
  );
}

function Step({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action: ReactNode;
}) {
  return (
    <section className="rounded-card border-line flex flex-col gap-2.5 border bg-white p-4">
      <span className="text-brand flex">{icon}</span>
      <h2 className="text-[17px] font-bold">{title}</h2>
      {body ? (
        <p className="text-muted text-sm leading-[1.45]">{body}</p>
      ) : null}
      {action}
    </section>
  );
}
