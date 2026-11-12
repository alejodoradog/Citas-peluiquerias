import Link from "next/link";
import type { ReactNode } from "react";
import { publicImageUrl } from "@/lib/imagenes/keys";
import { formatPesos } from "@/lib/dinero/pesos";
import { shopInitialsOf } from "@/ui/avatar";
import { buttonClasses } from "@/ui/button";
import { cx } from "@/ui/cx";
import { ChevronLeftIcon, ImageIcon } from "@/ui/icons";
import { Steps } from "@/ui/steps";
import { textos } from "@/ui/textos";

// Pieces shared by the screens of the public booking (C-01 to C-08, C-17).

const t = textos.reservas;

export function Cover({
  path,
  height,
}: {
  path: string | null;
  height: 160 | 190;
}) {
  const size = height === 190 ? "h-47.5" : "h-40";
  if (path) {
    return (
      // A small public image from storage (1200 px, under 100 KB).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={publicImageUrl(path)}
        alt={t.perfil.portada}
        className={cx("w-full object-cover", size)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={t.perfil.portada}
      className={cx(
        "text-muted flex w-full items-center justify-center bg-[repeating-linear-gradient(135deg,#e3eae8_0_10px,#edf2f0_10px_20px)]",
        size,
      )}
    >
      <ImageIcon size={18} />
    </div>
  );
}

export function ShopLogo({
  name,
  path,
}: {
  name: string;
  path: string | null;
}) {
  return (
    <span
      role="img"
      aria-label={t.perfil.logo(name)}
      className="border-paper bg-ink flex size-19 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border-4 text-[1.625rem] font-bold text-white"
    >
      {path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={publicImageUrl(path)}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{shopInitialsOf(name)}</span>
      )}
    </span>
  );
}

// An outlined 46 px link to another site (WhatsApp, Google Maps).
export function OutsideLink({
  href,
  icon,
  children,
  size = "md",
  variant = "secondary",
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg";
  variant?: "primary" | "secondary";
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses({ variant, size })}
    >
      {icon}
      <span>{children}</span>
    </a>
  );
}

// "Agregar a mi calendario" (C-08, C-09): a Google Calendar event.
export function calendarUrl(
  title: string,
  start: Date,
  end: Date,
  place: string,
) {
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${stamp(start)}/${stamp(end)}`,
    location: place,
  });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

// "Cómo llegar": the point when the barbershop saved it, else its address.
export function directionsUrl(shop: {
  location: { latitude: number; longitude: number } | null;
  address: string | null;
  locality: string | null;
}): string | null {
  const query = shop.location
    ? `${shop.location.latitude},${shop.location.longitude}`
    : [shop.address, shop.locality].filter(Boolean).join(", ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold">{children}</h2>;
}

// The top of C-02 to C-07: back, the barbershop's name and 4 steps.
export function StepHeader({
  shopName,
  backHref,
  step,
}: {
  shopName: string;
  backHref: string;
  step: 1 | 2 | 3 | 4;
}) {
  return (
    <div className="mx-auto w-full max-w-md">
      <header className="flex min-h-14 items-center gap-1 px-3 pt-2.5 pb-1.5">
        <Link
          href={backHref}
          aria-label={t.volver}
          className="text-ink flex size-11 shrink-0 items-center justify-center rounded-full no-underline"
        >
          <ChevronLeftIcon size={22} />
        </Link>
        <p className="min-w-0 flex-1 text-base font-bold">{shopName}</p>
      </header>
      <div className="px-5">
        <Steps current={step} total={4} />
      </div>
    </div>
  );
}

export function StepTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-title">{title}</h1>
      {intro ? <p className="text-body text-muted">{intro}</p> : null}
    </div>
  );
}

// The white bar at the bottom of C-02 to C-06: a summary and the price,
// then the main action.
export function SummaryBar({
  summary,
  priceCop,
  children,
}: {
  summary: ReactNode;
  priceCop: number | null;
  children: ReactNode;
}) {
  return (
    // Above the step's content, so the list of hours never covers the button.
    <div className="sticky bottom-0 z-10 mx-auto w-full max-w-md">
      <div className="border-line flex flex-col gap-2.5 border-t bg-white px-5 pt-3.5 pb-5.5">
        <div className="flex items-center justify-between gap-3 text-[0.9375rem]">
          <span className="text-muted">{summary}</span>
          {priceCop !== null ? (
            <strong className="text-[1.0625rem]">
              {formatPesos(priceCop)}
            </strong>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

// The "Continuar" of a bar when there is nothing to continue with yet.
export function DisabledContinue() {
  return (
    <button
      type="button"
      disabled
      className="bg-line text-muted rounded-button text-button min-h-13.5 w-full"
    >
      {t.continuar}
    </button>
  );
}
