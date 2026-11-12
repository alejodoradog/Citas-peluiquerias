"use client";

import Link from "next/link";
import { useEffect } from "react";
import { routes } from "@/lib/routes";
import { buttonClasses } from "@/ui/button";
import { textos } from "@/ui/textos";
import { appointmentStorage } from "../../appointment-storage";

// C-08 (task 3.4): the link to this appointment, and this phone remembers it
// for the barbershop's page (C-01).
export function ManageLink({
  token,
  slug,
  startsAt,
}: {
  token: string;
  slug: string;
  startsAt: string;
}) {
  useEffect(() => {
    appointmentStorage.remember({ token, slug, startsAt });
  }, [token, slug, startsAt]);
  return (
    <Link
      href={routes.manageAppointment(token)}
      className={buttonClasses({ variant: "secondary" })}
    >
      {textos.reservas.confirmada.gestionar}
    </Link>
  );
}
