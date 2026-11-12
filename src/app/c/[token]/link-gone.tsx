"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { routes } from "@/lib/routes";
import { BrandHeader } from "@/ui/brand";
import { buttonClasses } from "@/ui/button";
import { LinkIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";
import { appointmentStorage } from "../../[slug]/appointment-storage";

const t = textos.reservas.gestionar.vencido;

// C-16: the appointment passed, was cancelled or the link is not one. The
// database says nothing more, so the barbershop comes from this phone, when
// it booked there; this phone also forgets the link.
export function LinkGone({ token }: { token: string }) {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    const kept = appointmentStorage.slugOf(token);
    appointmentStorage.forget(token);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of browser storage after mounting
    setSlug(kept);
  }, [token]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="px-5 pt-5">
        <BrandHeader />
      </div>
      <main className="flex flex-col gap-4 px-5 py-15">
        <span className="text-muted">
          <LinkIcon size={40} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title">{t.titulo}</h1>
          <p className="text-body text-muted">{t.detalle}</p>
        </div>
        <Link
          href={slug ? routes.booking(slug) : routes.home}
          className={buttonClasses({ variant: "secondary" })}
        >
          {slug ? t.ir : t.inicio}
        </Link>
      </main>
    </div>
  );
}
