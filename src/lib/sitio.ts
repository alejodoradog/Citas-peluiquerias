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
