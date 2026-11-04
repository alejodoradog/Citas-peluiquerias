"use client";

import { buttonClasses } from "@/ui/button";
import { textos } from "@/ui/textos";

const t = textos.errorGeneral;

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pt-16">
      <h1 className="text-[2rem] leading-[1.1] font-extrabold tracking-tight">
        {t.titulo}
      </h1>
      <p className="text-muted text-base">{t.bajada}</p>
      <button
        type="button"
        onClick={reset}
        className={buttonClasses("primary")}
      >
        {t.reintentar}
      </button>
    </main>
  );
}
