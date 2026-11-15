"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { routes } from "@/lib/routes";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.landing.instalar;

// Chrome on Android offers its own install prompt when the page has a
// manifest (public/app.webmanifest, which opens /app).
type InstallPrompt = Event & { prompt: () => Promise<void> };

type Platform = "iphone" | "android" | "computador";

function platform(): Platform {
  const ua = navigator.userAgent;
  if (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ) {
    return "iphone";
  }
  return /Android/.test(ua) ? "android" : "computador";
}

function installed(): boolean {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// What the browser says, read once on the client (the server knows nothing).
const noSubscription = () => () => {};
function useBrowser<T>(read: () => T, onServer: T): T {
  return useSyncExternalStore(noSubscription, read, () => onServer);
}

// "Añadir la app a tu celular" (2026-11-15): Yapoin on the phone's home
// screen, opening /app, the owners' entry. Chrome on Android shows its own
// prompt; anywhere else a sheet explains the steps on /app, so the shortcut
// opens there. Hidden once it is installed.
export function InstallAppButton({ className }: { className?: string }) {
  const router = useRouter();
  const standalone = useBrowser(installed, false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setDone(true);
    addEventListener("beforeinstallprompt", onPrompt);
    addEventListener("appinstalled", onInstalled);
    return () => {
      removeEventListener("beforeinstallprompt", onPrompt);
      removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || done) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      setPrompt(null);
      return;
    }
    // The steps, on /app: the shortcut takes the page it is added from.
    router.push(`${routes.app}?instalar=1`);
  }

  return (
    <button type="button" onClick={install} className={className}>
      <PhoneIcon />
      {t.boton}
    </button>
  );
}

// On /app?instalar=1: the steps of this phone to add Yapoin to its home
// screen. Inside a Suspense boundary (useSearchParams).
export function InstallSteps() {
  const asked = useSearchParams().has("instalar");
  const standalone = useBrowser(installed, false);
  const where = useBrowser<Platform>(platform, "computador");
  const [closed, setClosed] = useState(false);

  function close() {
    setClosed(true);
    window.history.replaceState(null, "", routes.app);
  }

  return (
    <Sheet
      open={asked && !standalone && !closed}
      onClose={close}
      title={t.titulo}
    >
      <p className="text-muted">{t.bajada}</p>
      {where === "computador" ? (
        <p>{t.computador}</p>
      ) : (
        <ol className="flex list-decimal flex-col gap-2.5 pl-5">
          {t[where].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={close}
        className="bg-brand min-h-12 rounded-xl px-5 font-bold text-white"
      >
        {t.listo}
      </button>
    </Sheet>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
    >
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M10 18h4" />
    </svg>
  );
}
