"use client";

import { Button } from "@/ui/button";
import { ErrorState } from "@/ui/states";
import { textos } from "@/ui/textos";

const t = textos.errorGeneral;

// A panel screen that failed to load (a database error, for one). The owner
// can try again without leaving the screen.
export default function PanelError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5.5 px-5 pt-16">
      <h1 className="text-title">{t.titulo}</h1>
      <ErrorState
        title={t.bajada}
        action={
          <Button variant="secondary" size="md" onClick={reset}>
            {t.reintentar}
          </Button>
        }
      />
    </main>
  );
}
