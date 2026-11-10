"use client";

import { useState } from "react";
import {
  formatLocation,
  mapsUrl,
  type ShopLocation,
} from "@/modulos/barberias/dominio/profile";
import { Button } from "@/ui/button";
import { MapPinIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";

const t = textos.datos.ubicacion;

type LocateError = keyof typeof t.errores;

// The phone's own GPS: precise, and with no wait for a cached position.
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

const sameLocation = (a: ShopLocation | null, b: ShopLocation | null) =>
  a && b ? formatLocation(a) === formatLocation(b) : a === b;

// D-57's location (decision P2 of task 2.4, provisional). The design's map
// with a pin would need a map service, which decision 0007 does not have:
// the owner, usually at the barbershop, marks it with the phone's location,
// and checks it in Google Maps through a plain link. It travels with the
// form as "location" ("lat,lng", or empty to remove it).
export function LocationField({
  saved,
  initial,
  error,
}: {
  // What the database holds, to tell "saved" from "marked".
  saved: ShopLocation | null;
  // What the form starts with: the saved one, or what came back from the
  // server after an error.
  initial: ShopLocation | null;
  // An error of the server about it.
  error?: string;
}) {
  const [location, setLocation] = useState(initial);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<LocateError | null>(null);

  function locate() {
    setLocateError(null);
    const geolocation =
      typeof navigator === "undefined" ? undefined : navigator.geolocation;
    if (!geolocation) {
      setLocateError("unsupported");
      return;
    }
    setLocating(true);
    geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        // Rounded as the form sends it, so "saved" compares what is stored.
        const [latitude, longitude] = formatLocation(coords)
          .split(",")
          .map(Number);
        setLocation({ latitude: latitude!, longitude: longitude! });
      },
      (failure) => {
        setLocating(false);
        setLocateError(
          failure.code === failure.PERMISSION_DENIED ? "denied" : "unavailable",
        );
      },
      POSITION_OPTIONS,
    );
  }

  function clear() {
    setLocateError(null);
    setLocation(null);
  }

  const isSaved = sameLocation(location, saved);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-label mb-1.5">{t.titulo}</legend>
      <input
        type="hidden"
        name="location"
        value={location ? formatLocation(location) : ""}
      />
      <div className="image-placeholder rounded-card text-help text-muted flex h-32.5 flex-col items-center justify-center gap-1.5 px-4 text-center font-semibold">
        <span className="flex items-center gap-2">
          <MapPinIcon size={18} />
          <span className={location ? "text-ink" : undefined}>
            {location ? (isSaved ? t.guardada : t.marcada) : t.ayuda}
          </span>
        </span>
        {location && !isSaved ? (
          <span className="font-normal">{t.marcadaDetalle}</span>
        ) : null}
        {location ? (
          <a
            href={mapsUrl(location)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.verNuevaPestana}
            className="text-brand-strong inline-flex min-h-11 items-center font-bold underline"
          >
            {t.ver}
          </a>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3.5">
        <Button
          variant="secondary"
          size="sm"
          block={false}
          disabled={locating}
          onClick={locate}
        >
          <MapPinIcon size={18} />
          {locating ? t.buscando : t.usar}
        </Button>
        {location ? (
          <Button variant="text" size="sm" block={false} onClick={clear}>
            {t.quitar}
          </Button>
        ) : null}
      </div>
      {locateError ? (
        <Notice tone="danger" title={t.errores[locateError]} />
      ) : error ? (
        <Notice tone="danger" title={error} />
      ) : null}
    </fieldset>
  );
}
