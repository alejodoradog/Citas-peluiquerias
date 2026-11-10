"use client";

import { Button } from "@/ui/button";
import { ErrorState } from "@/ui/states";
import { textos } from "@/ui/textos";

const t = textos.errorGeneral;

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-16">
      <ErrorState
        title={t.titulo}
        action={
          <Button variant="secondary" size="md" onClick={reset}>
            {t.reintentar}
          </Button>
        }
      >
        {t.bajada}
      </ErrorState>
    </main>
  );
}
