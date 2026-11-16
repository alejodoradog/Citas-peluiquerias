"use client";

import { useState, useTransition } from "react";
import type {
  DeleteBarberRefusal,
  DeleteBarberResult,
} from "@/modulos/barberias/acciones/barbers";
import { Button } from "@/ui/button";
import { Notice } from "@/ui/notice";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.barberos.eliminar;

// "Eliminar a …" in D-54 (task 7.6c, decision 0010 point 7), under
// "Desactivar". The sheet says what goes and what stays before the owner
// confirms. With appointments to come it explains them and offers no way to
// delete: the database refuses it anyway, and says how many. When the
// professional was deleted but Auth kept their account, the same tap tries
// that part again. On success the action goes back to the team.
export function DeleteSection({
  barberId,
  barberName,
  upcoming,
  remove,
}: {
  barberId: string;
  barberName: string;
  // Appointments to come, as the page read them.
  upcoming: number;
  remove: (barberId: string) => Promise<DeleteBarberResult>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<DeleteBarberRefusal | null>(null);
  const [blocking, setBlocking] = useState(upcoming);
  const [working, startWorking] = useTransition();

  function confirm() {
    setError(null);
    startWorking(async () => {
      const result = await remove(barberId);
      if (result && !result.ok) {
        if (result.error === "has_upcoming_appointments") {
          setBlocking(result.upcoming ?? Math.max(blocking, 1));
        } else {
          setError(result.error);
        }
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <Button
        variant="danger"
        size="md"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t.boton(barberName)}
      </Button>
      <p className="text-help text-muted leading-[1.45]">{t.ayuda}</p>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t.titulo(barberName)}
      >
        {blocking > 0 ? (
          <>
            <Notice tone="warning" title={t.conCitas(blocking)} />
            <Button
              variant="secondary"
              size="md"
              onClick={() => setOpen(false)}
            >
              {t.entendido}
            </Button>
          </>
        ) : (
          <>
            <p className="text-body leading-[1.45]">{t.borra}</p>
            <p className="text-body leading-[1.45]">{t.queda}</p>
            <p className="text-help text-muted leading-[1.45]">{t.sinVuelta}</p>
            {error ? <Notice tone="danger" title={t.errores[error]} /> : null}
            <Button variant="dangerSolid" disabled={working} onClick={confirm}>
              {working
                ? t.eliminando
                : error === "account_not_deleted"
                  ? t.reintentar
                  : t.si}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setOpen(false)}
            >
              {t.no}
            </Button>
          </>
        )}
      </Sheet>
    </div>
  );
}
