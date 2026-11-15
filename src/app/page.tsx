import Link from "next/link";
import { routes } from "@/lib/routes";
import { textos } from "@/ui/textos";
import { HomeHero } from "./home-hero";
import "./home.css";

const t = textos.inicio;

const button =
  "flex h-13 items-center justify-center rounded-2xl text-[1.0625rem] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

// D-01, redesigned with the partner (2026-11-15): the teal gradient that
// breathes, the app's comb next to the name, and one animated character per
// kind of business (./home-hero.tsx, ./home.css).
export default function Home() {
  return (
    <div className="yp-home flex min-h-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pt-8 pb-10">
        <p className="flex items-center gap-2.5 text-[1.4rem] font-bold">
          <CombMark />
          {textos.marca}
        </p>
        <HomeHero
          title={t.titulo}
          start={t.tituloInicio}
          end={t.tituloFin}
          words={t.negocios}
        >
          <p className="text-body">{t.bajada}</p>
        </HomeHero>
        <div className="flex flex-col gap-2.5">
          <Link
            href={routes.signUp}
            className={`${button} bg-[#bfeef2] text-[#0f444b] shadow-[0_8px_20px_rgb(10_50_55/0.35)]`}
          >
            {t.crearCuenta}
          </Link>
          <Link
            href={routes.signIn}
            className={`${button} border-2 border-[#bfeef2] bg-[#bfeef2]/20 text-[#bfeef2]`}
          >
            {t.ingresar}
          </Link>
          <p className="text-help text-center">{t.nota}</p>
        </div>
      </main>
    </div>
  );
}

// The comb of the app's icon (src/app/icon.svg), on its own over the gradient.
function CombMark() {
  return (
    <svg
      viewBox="80 112 352 300"
      aria-hidden="true"
      className="yp-comb h-10 w-11.5 shrink-0"
    >
      <defs>
        <linearGradient id="yp-comb-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#bfeef2" />
        </linearGradient>
      </defs>
      <g transform="rotate(-16 256 256)" fill="url(#yp-comb-fill)">
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
