"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { routes } from "@/lib/routes";
import { TextLink } from "./text-link";
import { textos } from "./textos";

// The way out of a legal text (task 7.2). Opened from a form or a page of
// the app (?volver, routes.termsFromApp), it goes back to it: Next.js kept
// that page as it was, so what the person had written is still there. Opened
// by its own address, it leads home.
export function LegalBack() {
  const router = useRouter();
  const fromApp = useSearchParams().has("volver");
  const legal = textos.legal;

  if (!fromApp) {
    return (
      <TextLink href={routes.home} standalone>
        {legal.volver}
      </TextLink>
    );
  }
  return (
    <TextLink
      href={routes.home}
      standalone
      onClick={(event) => {
        // A link someone shared with ?volver has nowhere to go back to.
        if (window.history.length <= 1) return;
        event.preventDefault();
        router.back();
      }}
    >
      {legal.volverAtras}
    </TextLink>
  );
}
