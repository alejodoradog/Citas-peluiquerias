"use client";

import { useEffect, useRef, useState } from "react";
import {
  mapLinks,
  type ShopLocation,
} from "@/modulos/barberias/dominio/profile";
import { cx } from "./cx";
import { Sheet } from "./sheet";
import { textos } from "./textos";

const t = textos.mapa;

// The map (decision 0009): MapLibre, the library mapcn is built on, with the
// free OpenFreeMap tiles (no account, no key, no cookies). Its worker is
// served by the app itself (public/maplibre), never by a CDN.
const STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const ZOOM = 15.5;

// iPhone and iPad (an iPad says "Macintosh" but has touch).
function isApple(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

// A still map of the barbershop with its pin, in D-57 and on its public page.
// It loads when it scrolls into view, since MapLibre is heavy, and never moves
// or zooms, so it never traps the page's scroll on a phone. The whole map is
// one button: it opens the person's maps app.
// - Android: the phone lists its maps apps (geo:), or opens its default one.
// - iPhone: it has no such list, so a sheet offers Apple Maps, Google Maps and
//   Waze.
// - A computer: Google Maps in another tab.
export function ShopMap({
  location,
  name,
  className,
}: {
  location: ShopLocation;
  name: string;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [choosing, setChoosing] = useState(false);
  const links = mapLinks(location, name);
  const { latitude, longitude } = location;

  useEffect(() => {
    const element = container.current;
    // Without IntersectionObserver (an old browser, the unit tests) the map
    // stays the striped placeholder, and the button still opens the app.
    if (!element || typeof IntersectionObserver === "undefined") return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    async function draw() {
      const [maplibre] = await Promise.all([
        import("maplibre-gl"),
        import("maplibre-gl/dist/maplibre-gl.css"),
      ]);
      if (cancelled || !element) return;
      maplibre.setWorkerUrl(WORKER_URL);
      const created = new maplibre.Map({
        container: element,
        style: STYLE_URL,
        center: [longitude, latitude],
        zoom: ZOOM,
        interactive: false,
        attributionControl: { compact: true },
      });
      const pin = document.createElement("div");
      pin.className =
        "size-5 rounded-full border-[3px] border-white bg-brand shadow-[0_2px_6px_rgba(22,33,31,0.35)]";
      new maplibre.Marker({ element: pin })
        .setLngLat([longitude, latitude])
        .addTo(created);
      // The credit (OpenStreetMap's, required) starts folded into its ⓘ.
      created.once("load", () => {
        element
          .querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show");
      });
      map = created;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void draw();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      map?.remove();
    };
  }, [latitude, longitude]);

  function open() {
    if (isApple()) {
      setChoosing(true);
    } else if (isAndroid()) {
      window.location.href = links.geo;
    } else {
      window.open(links.google, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
      <div
        className={cx(
          // isolate: the map and its button stack among themselves, never
          // above the page's sticky bars.
          "image-placeholder rounded-card relative isolate h-40 overflow-hidden",
          className,
        )}
      >
        {/* MapLibre's CSS makes its container position: relative, so it
            fills a positioned box instead of being one. Inert: its credit
            button and links are a picture here, never a stop for the
            keyboard or a screen reader; the button below is the control. */}
        <div inert className="absolute inset-0">
          <div ref={container} className="h-full w-full" />
        </div>
        {/* Above the map and its credit, so a tap anywhere opens the app. */}
        <button
          type="button"
          onClick={open}
          aria-label={t.abrir(name)}
          className="absolute inset-0 z-10 cursor-pointer"
        />
      </div>
      <Sheet
        open={choosing}
        onClose={() => setChoosing(false)}
        title={t.elegir}
      >
        <ul className="flex flex-col gap-2">
          {(
            [
              [t.apple, links.apple],
              [t.google, links.google],
              [t.waze, links.waze],
            ] as const
          ).map(([label, href]) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setChoosing(false)}
                className="border-line rounded-button flex min-h-12 items-center border px-4 text-[0.9375rem] font-semibold"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
