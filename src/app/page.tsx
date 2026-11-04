import Link from "next/link";
import { routes } from "@/lib/routes";
import { buttonClasses } from "@/ui/button";
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
          <Link href={routes.signUp} className={buttonClasses("primary")}>
            {t.crearCuenta}
          </Link>
          <Link href={routes.signIn} className={buttonClasses("secondary")}>
            {t.ingresar}
          </Link>
        </div>
      </main>
    </div>
  );
}
