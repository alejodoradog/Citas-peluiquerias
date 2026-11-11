"use client";

import { useState } from "react";
import { routes } from "@/lib/routes";
import { displayBookingUrl } from "@/lib/sitio";
import type { SwitchBarbershopResult } from "@/modulos/cuentas/acciones/active-barbershop";
import { Button, ButtonLink, buttonClasses } from "@/ui/button";
import { CheckIcon, PlusIcon, StoreIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.sedes;

export type SwitcherBarbershop = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
};

type SwitchProps = {
  barbershops: readonly SwitcherBarbershop[];
  activeId: string;
  switchTo: (id: string) => Promise<SwitchBarbershopResult>;
  // Where a switch lands; a full page load, replaced in tests.
  goTo?: (path: string) => void;
};

// The sede's logo, or the store icon while it has none. Decorative: its name
// is written next to it.
function ShopMark({ logoUrl }: { logoUrl: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="bg-brand-soft text-brand-strong flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[0.625rem]"
    >
      {logoUrl ? (
        // A small image from storage; next/image would need every storage
        // host configured and adds nothing at 44 px.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-full object-cover" />
      ) : (
        <StoreIcon />
      )}
    </span>
  );
}

function fullPageLoad(path: string) {
  window.location.assign(path);
}

// "Tus sedes": every sede of the owner, a check on the active one, and
// "Nueva sede". Picking another sede asks the server, which checks it is one
// of the owner's, and then loads the panel again in full: a client
// navigation would leave hidden pages mounted with the other sede's data
// (lesson of PR #30).
function BarbershopsSheet({
  open,
  onClose,
  barbershops,
  activeId,
  switchTo,
  goTo = fullPageLoad,
}: SwitchProps & { open: boolean; onClose: () => void }) {
  const [switching, setSwitching] = useState(false);
  const [failed, setFailed] = useState(false);

  async function choose(id: string) {
    if (switching) return;
    if (id === activeId) {
      onClose();
      return;
    }
    setFailed(false);
    setSwitching(true);
    let result: SwitchBarbershopResult = "refused";
    try {
      result = await switchTo(id);
    } catch {
      // A network failure: the panel stays on the sede it was on.
    }
    if (result === "switched") {
      // The page goes away; the buttons stay off until it does.
      goTo(routes.panel);
      return;
    }
    setSwitching(false);
    setFailed(true);
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setFailed(false);
        onClose();
      }}
      title={t.hoja.titulo}
    >
      {failed ? <Notice tone="danger" title={t.hoja.fallo} /> : null}
      <ul className="rounded-card border-line flex flex-col overflow-hidden border bg-white">
        {barbershops.map((barbershop) => {
          const current = barbershop.id === activeId;
          return (
            <li
              key={barbershop.id}
              className="border-neutral-soft border-b last:border-b-0"
            >
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                disabled={switching}
                onClick={() => choose(barbershop.id)}
                className="text-ink flex min-h-13 w-full items-center gap-3 px-4 py-3 text-left focus-visible:-outline-offset-2 disabled:cursor-wait"
              >
                <ShopMark logoUrl={barbershop.logoUrl} />
                {/* The spaces keep the button's name readable; flex layout
                    hides them on screen. */}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body font-semibold break-words">
                    {barbershop.name}
                  </span>{" "}
                  <span className="text-help text-muted break-all">
                    {displayBookingUrl(barbershop.slug)}
                  </span>
                </span>{" "}
                {current ? (
                  <span className="text-brand-strong flex">
                    <CheckIcon size={20} />
                    <span className="sr-only">{t.hoja.actual}</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="text-help text-muted empty:hidden">
        {switching ? t.hoja.cambiando : null}
      </p>
      {/* A full page load: the sheet is a modal dialog, and a page Next.js
          kept hidden with it open would leave the next page inert. */}
      <a
        href={routes.panelNewBarbershop}
        className={buttonClasses({ variant: "secondary" })}
      >
        <PlusIcon size={18} />
        {t.nueva}
      </a>
    </Sheet>
  );
}

// Task 2.6, at the top of Más (D-50): the active sede with its link, and
// "Cambiar", which opens "Tus sedes". With a single sede there is nothing to
// change to, so the card offers "Nueva sede" instead.
export function BarbershopSwitcher(props: SwitchProps) {
  const [open, setOpen] = useState(false);
  const { barbershops, activeId } = props;
  const active = barbershops.find((barbershop) => barbershop.id === activeId);
  if (!active) return null;
  const several = barbershops.length > 1;

  return (
    <section
      aria-label={t.activa}
      className="rounded-card border-line flex items-center gap-3 border bg-white p-4"
    >
      <ShopMark logoUrl={active.logoUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body font-bold break-words">{active.name}</p>
        <p className="text-help text-muted break-all">
          {displayBookingUrl(active.slug)}
        </p>
      </div>
      {several ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            block={false}
            aria-label={t.cambiarEtiqueta}
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            {t.cambiar}
          </Button>
          <BarbershopsSheet
            {...props}
            open={open}
            onClose={() => setOpen(false)}
          />
        </>
      ) : (
        <ButtonLink
          href={routes.panelNewBarbershop}
          variant="secondary"
          size="sm"
          block={false}
        >
          <PlusIcon size={18} />
          {t.nueva}
        </ButtonLink>
      )}
    </section>
  );
}

// The setup wizard of a sede is the only screen its owner reaches until it
// is done (requireReadyOwner): with several sedes, its top bar offers the
// same sheet, so the owner can go back to a sede that is ready instead of
// being held in the wizard (provisional decision P3 of task 2.6).
export function WizardBarbershopSwitch(props: SwitchProps) {
  const [open, setOpen] = useState(false);
  if (props.barbershops.length < 2) return null;
  return (
    <>
      <Button
        variant="text"
        size="sm"
        block={false}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {t.cambiarEtiqueta}
      </Button>
      <BarbershopsSheet {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
