"use client";

import Link from "next/link";
import { useState } from "react";
import { routes } from "@/lib/routes";
import { TRIAL_DAYS } from "@/modulos/suscripciones/dominio/trial";
import { buttonClasses } from "@/ui/button";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.landing;

// WhatsApp of Yapoin (the founder's, published in docs/trabajo-en-paralelo.md),
// with a message ready for someone who wants to ask something.
const WHATSAPP = `https://wa.me/573229381101?text=${encodeURIComponent(t.contacto.mensaje)}`;

const navButton =
  "inline-flex min-h-11 items-center rounded-xl px-3.5 text-[0.98rem] font-semibold text-ink hover:bg-paper";

// The landing's bar: the prices and the contact open in a sheet.
export function LandingNav() {
  const [open, setOpen] = useState<"precios" | "contacto" | null>(null);

  return (
    <>
      <div className="flex w-full items-center gap-1 sm:w-auto">
        <button
          type="button"
          className={navButton}
          onClick={() => setOpen("precios")}
        >
          {t.precios.abrir}
        </button>
        <button
          type="button"
          className={navButton}
          onClick={() => setOpen("contacto")}
        >
          {t.contacto.abrir}
        </button>
        <Link
          href={routes.signIn}
          className={`${navButton} border-line ml-auto border sm:ml-1.5`}
        >
          {t.ingresar}
        </Link>
      </div>

      <Sheet
        open={open === "precios"}
        onClose={() => setOpen(null)}
        title={t.precios.titulo}
      >
        <p className="bg-brand-soft text-brand-strong rounded-2xl px-4 py-3.5 font-semibold">
          {t.precios.prueba(TRIAL_DAYS)}
        </p>
        <ul className="flex flex-col gap-2.5">
          {t.precios.planes.map((plan, i) => (
            <li
              key={plan.quien}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 ${
                i === 0 ? "border-brand border-2 bg-[#f6fbfb]" : "border-line"
              }`}
            >
              <span>
                <b className="block">{plan.quien}</b>
                <span className="text-muted text-sm">{plan.detalle}</span>
              </span>
              <strong className="text-xl font-extrabold whitespace-nowrap tabular-nums">
                {plan.valor}
                {plan.mes ? (
                  <small className="text-muted text-xs font-semibold">
                    {" "}
                    {t.precios.porMes}
                  </small>
                ) : null}
              </strong>
            </li>
          ))}
        </ul>
        <p className="text-muted text-sm">{t.precios.incluye}</p>
        <Link href={routes.signUp} className={buttonClasses()}>
          {t.crearCuenta}
        </Link>
      </Sheet>

      <Sheet
        open={open === "contacto"}
        onClose={() => setOpen(null)}
        title={t.contacto.titulo}
      >
        <p className="text-muted">{t.contacto.bajada}</p>
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-13 items-center justify-center gap-2.5 rounded-2xl bg-[#25d366] text-[1.04rem] font-bold text-[#0b2e17]"
        >
          <WhatsAppIcon />
          {t.contacto.whatsapp}
        </a>
        <p className="border-line flex flex-col rounded-2xl border px-4 py-3">
          <span className="text-muted text-sm">
            {t.contacto.correoEtiqueta}
          </span>
          <a
            href={`mailto:${t.contacto.correo}`}
            className="text-ink text-lg font-bold break-all"
          >
            {t.contacto.correo}
          </a>
        </p>
        <p className="text-muted flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="bg-brand size-2 shrink-0 rounded-full"
          />
          {t.contacto.donde}
        </p>
      </Sheet>
    </>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-6 fill-current">
      <path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7a10.7 10.7 0 0 1-5.5-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.3-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.7 3.7 0 0 0-1.1 2.8 6.5 6.5 0 0 0 1.3 3.4 14.7 14.7 0 0 0 5.7 5c2.1.9 2.9 1 4 .8.6-.1 1.9-.8 2.2-1.6a2.7 2.7 0 0 0 .2-1.6c-.1-.1-.3-.2-.6-.3z" />
    </svg>
  );
}
