import { routes } from "./routes";

// The public address of Yapoin. Booking links are <SITE_URL>/<slug>. The page
// behind them arrives with task 3.2.
export const SITE_URL = "https://yapoin.com";

export function publicBookingUrl(slug: string): string {
  return `${SITE_URL}/${slug}`;
}

// The same link without the protocol, as screens show it ("yapoin.com/slug").
export function displayBookingUrl(slug: string): string {
  return publicBookingUrl(slug).replace(/^https?:\/\//, "");
}

// The booking page with a professional already chosen (task 7.6b, decision
// 0010 point 6): what "Compartir" of "Mi agenda" shares. The customer picks
// the services first; a professional who does not do them all leaves the
// customer on the step that chooses one (booking-flow.ts reads the query).
export function professionalBookingUrl(slug: string, barberId: string): string {
  return `${SITE_URL}${routes.bookingFlow(slug)}?profesional=${encodeURIComponent(barberId)}`;
}

// Files the owner downloads from D-14 and D-62, named after the link so a
// phone full of downloads still tells them apart.
export function qrFileName(slug: string): string {
  return `qr-yapoin-${slug}.png`;
}

export function posterFileName(slug: string): string {
  return `afiche-yapoin-${slug}.png`;
}
