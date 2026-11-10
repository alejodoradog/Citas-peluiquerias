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

// Files the owner downloads from D-14 and D-62, named after the link so a
// phone full of downloads still tells them apart.
export function qrFileName(slug: string): string {
  return `qr-yapoin-${slug}.png`;
}

export function posterFileName(slug: string): string {
  return `afiche-yapoin-${slug}.png`;
}

// A barber's private link, <SITE_URL>/b/<token> (D-56). It is built only in
// the Server Action that issues the token and travels only in its answer.
export function barberAgendaUrl(token: string): string {
  return `${SITE_URL}${routes.barberAgenda(token)}`;
}
