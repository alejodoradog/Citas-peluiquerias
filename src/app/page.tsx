import Link from "next/link";
import { textos } from "@/ui/textos";

const t = textos.inicio;

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="comb" aria-hidden="true" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-5 py-16">
        <h1 className="text-5xl leading-none font-extrabold tracking-tight">
          {t.titulo}
        </h1>
        <p className="text-muted text-lg">{t.descripcion}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/registro"
            className="bg-brand hover:bg-brand-strong focus-visible:outline-ink flex h-12 items-center justify-center rounded-lg px-5 text-base font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t.crearCuenta}
          </Link>
          <Link
            href="/ingresar"
            className="border-line text-ink hover:border-ink focus-visible:outline-brand flex h-12 items-center justify-center rounded-lg border-2 px-5 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t.ingresar}
          </Link>
        </div>
      </main>
    </div>
  );
}
