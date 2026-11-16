// Yapoin's WhatsApp: the founder's number, published in
// docs/trabajo-en-paralelo.md. The landing's "Contáctanos", the plan "por
// acuerdo" and the professionals' limit (task 7.8) open it with a message
// ready for what the person wants.
export const YAPOIN_WHATSAPP = "573229381101";

export function yapoinWhatsapp(message: string): string {
  return `https://wa.me/${YAPOIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
