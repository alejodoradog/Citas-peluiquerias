"use client";

import { useState } from "react";
import {
  formatLocation,
  type ShopLocation,
} from "@/modulos/barberias/dominio/profile";
import { Button } from "@/ui/button";
import { MapPinIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { ShopMap } from "@/ui/shop-map";
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

// D-57's location (decision P2 of task 2.4). The owner, usually at the
// barbershop, marks it with the phone's location and sees it on the map
// (decision 0009), which opens their maps app when tapped. It travels with
// the form as "location" ("lat,lng", or empty to remove it).
export function LocationField({
  saved,
  initial,
  error,
  shopName,
}: {
  // What the database holds, to tell "saved" from "marked".
  saved: ShopLocation | null;
  // What the form starts with: the saved one, or what came back from the
  // server after an error.
  initial: ShopLocation | null;
  // An error of the server about it.
  error?: string;
  // The barbershop's name, for the map and the maps app.
  shopName: string;
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
      {location ? (
        <div className="flex flex-col gap-1.5">
          <ShopMap location={location} name={shopName} />
          <p className="text-help text-muted flex flex-wrap items-center gap-x-2 font-semibold">
            <span className="text-ink flex items-center gap-1.5">
              <MapPinIcon size={16} />
              {isSaved ? t.guardada : t.marcada}
            </span>
            {isSaved ? null : (
              <span className="font-normal">{t.marcadaDetalle}</span>
            )}
          </p>
        </div>
      ) : (
        <div className="image-placeholder rounded-card text-help text-muted flex h-32.5 flex-col items-center justify-center gap-1.5 px-4 text-center font-semibold">
          <span className="flex items-center gap-2">
            <MapPinIcon size={18} />
            <span>{t.ayuda}</span>
          </span>
        </div>
      )}
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
