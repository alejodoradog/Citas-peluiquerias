import type { Metadata } from "next";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { TRIAL_DAYS } from "@/modulos/suscripciones/dominio/trial";
import { textos } from "@/ui/textos";
import { InstallAppButton } from "./_landing/install-app";
import { LandingNav } from "./_landing/landing-nav";
import { RotatingWord } from "./_landing/rotating-word";
import "./_landing/landing.css";

const t = textos.landing;

// The phone of yapoin.com offers to install the owners' app (/app).
export const metadata: Metadata = { manifest: "/app.webmanifest" };

// The landing page (approved by the partner, 2026-11-15): one screen with the
// title whose business turns, the phone that books by itself and the line
// through booking, reminder and arrival. The prices and the contact open in a
// sheet from the bar. The owners' entry moved to /app.
export default function Landing() {
  return (
    <div className="yl-page flex min-h-full flex-1 flex-col px-4 sm:px-6">
      <header className="mx-auto flex w-full max-w-[70rem] flex-wrap items-center justify-between gap-2 py-3.5">
        <Link
          href={routes.home}
          className="text-ink flex min-h-11 items-center gap-2.5 text-[1.3rem] font-extrabold"
        >
          <CombMark />
          {textos.marca}
        </Link>
        <nav aria-label={t.navegacion} className="w-full sm:w-auto">
          <LandingNav />
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-[70rem] flex-1 items-center gap-x-10 gap-y-6 py-2 md:grid-cols-[1.15fr_0.85fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <h1 className="text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] font-extrabold tracking-[-0.02em] text-balance">
            <span className="sr-only">{t.titulo}</span>
            <span aria-hidden="true">
              {t.tituloInicio} <RotatingWord words={t.negocios} />
              <br />
              {t.tituloFin}
            </span>
          </h1>
          <p className="text-muted max-w-[44ch] text-lg">{t.bajada}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={routes.signUp}
              className="bg-brand inline-flex min-h-13.5 items-center justify-center rounded-2xl px-7 text-[1.04rem] font-bold text-white shadow-[0_10px_22px_rgb(30_127_140/0.3)]"
            >
              {t.crearCuenta}
            </Link>
            <InstallAppButton className="border-line text-ink inline-flex min-h-13.5 items-center justify-center gap-2 rounded-2xl border bg-white px-5 font-bold" />
          </div>
          <p className="text-muted text-sm">{t.nota(TRIAL_DAYS)}</p>
        </div>
        <BookingDemo />
      </main>

      <section
        aria-label={t.pasosEtiqueta}
        className="mx-auto w-full max-w-[70rem] pt-8 pb-4 md:pt-0"
      >
        <div className="yl-track" aria-hidden="true">
          <svg viewBox="0 0 1000 56" preserveAspectRatio="none">
            <path
              className="yl-base"
              d="M20 28 C 250 -8, 400 64, 500 28 S 800 -8, 980 28"
            />
            <path
              className="yl-run"
              pathLength={1}
              d="M20 28 C 250 -8, 400 64, 500 28 S 800 -8, 980 28"
            />
          </svg>
        </div>
        <ol className="yl-stops grid gap-4 md:-mt-1.5 md:grid-cols-3">
          {t.pasos.map((paso, i) => (
            <li
              key={paso.titulo}
              className="relative z-1 flex items-start gap-3"
            >
              <span
                aria-hidden="true"
                className="yl-dot bg-brand-soft text-brand-strong flex size-10.5 shrink-0 items-center justify-center rounded-full"
                style={{ "--d": `${i * 1.2}s` } as React.CSSProperties}
              >
                <StepIcon step={i} />
              </span>
              <span>
                <b className="block">{paso.titulo}</b>
                <span className="text-muted text-[0.9rem]">{paso.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

// The phone that books by itself (a picture, hidden from screen readers).
function BookingDemo() {
  const d = t.demo;
  return (
    <div className="yl-stage" aria-hidden="true">
      <div className="yl-dev">
        <div className="yl-scr">
          <div className="yl-shop">
            <span className="yl-logo">LE</span>
            <span className="min-w-0">
              <b>{d.negocio}</b>
              <small>{d.horario}</small>
            </span>
          </div>
          <div className="yl-t">{d.servicio}</div>
          {d.servicios.map(([nombre, precio], i) => (
            <div
              key={nombre}
              className={i === 0 ? "yl-svc yl-tap-a" : "yl-svc"}
            >
              <span>{nombre}</span>
              <span>{precio}</span>
            </div>
          ))}
          <div className="yl-t">{d.dia}</div>
          <div className="yl-days">
            {d.dias.map((dia, i) => (
              <span key={dia} className={i === 1 ? "yl-tap-b" : undefined}>
                {dia}
              </span>
            ))}
          </div>
          <div className="yl-t">{d.hora}</div>
          <div className="yl-hrs">
            {d.horas.map((hora, i) => (
              <span key={hora} className={i === 1 ? "yl-tap-c" : undefined}>
                {hora}
              </span>
            ))}
          </div>
          <div className="yl-btn">{d.reservar}</div>
          <div className="yl-done">
            <span className="yl-ok">
              <svg viewBox="0 0 24 24">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <b>{d.reservada}</b>
            <small>{d.detalle}</small>
          </div>
          <span className="yl-finger" />
        </div>
      </div>
      <div className="yl-notif">
        <i />
        <span>
          <b>{d.aviso}</b>
          <br />
          {d.avisoDetalle}
        </span>
      </div>
    </div>
  );
}

function StepIcon({ step }: { step: number }) {
  const props = {
    viewBox: "0 0 24 24",
    className:
      "size-5.5 fill-none stroke-current stroke-[2.2] [stroke-linecap:round] [stroke-linejoin:round]",
  };
  if (step === 0)
    return (
      <svg {...props}>
        <rect x="6" y="2" width="12" height="20" rx="3" />
        <path d="M10 18h4" />
      </svg>
    );
  if (step === 1)
    return (
      <svg {...props}>
        <path d="M4 6h16v12H4z" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  return (
    <svg {...props}>
      <path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

// The comb of the app's icon (src/app/icon.svg), in the brand color.
function CombMark() {
  return (
    <svg
      viewBox="80 112 352 300"
      aria-hidden="true"
      className="text-brand h-8.5 w-9.5 shrink-0 fill-current"
    >
      <g transform="rotate(-16 256 256)">
        <rect x="96" y="148" width="320" height="66" rx="33" />
        <rect x="96" y="190" width="38" height="190" rx="19" />
        <rect x="166.5" y="190" width="38" height="160" rx="19" />
        <rect x="237" y="190" width="38" height="190" rx="19" />
        <rect x="307.5" y="190" width="38" height="160" rx="19" />
        <rect x="378" y="190" width="38" height="190" rx="19" />
      </g>
    </svg>
  );
}
