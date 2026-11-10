import { displayBookingUrl, publicBookingUrl } from "@/lib/sitio";
import { Card } from "./card";
import { CopyButton } from "./copy-button";
import { ShareButton } from "./share-button";
import { textos } from "./textos";

const t = textos.ui.linkReservas;

// The booking link of D-14 and D-62: the link without the protocol, then
// "Copiar" and "Compartir" side by side. D-14 names it with a label above;
// D-62, where copying is the screen's main action, makes "Copiar" primary.
// Each design spaces the card its own way (8 px with the label, 10 without).
export function BookingLinkCard({
  slug,
  name,
  label,
  copyVariant = "secondary",
}: {
  slug: string;
  name: string;
  label?: string;
  copyVariant?: "primary" | "secondary";
}) {
  const url = publicBookingUrl(slug);
  return (
    <Card className={label ? "gap-2" : "gap-2.5"}>
      {label ? <span className="text-help text-muted">{label}</span> : null}
      <strong className="text-lg break-all">{displayBookingUrl(slug)}</strong>
      <div className="grid grid-cols-2 gap-2.5">
        <CopyButton
          text={url}
          label={t.copiar}
          copiedLabel={t.copiado}
          variant={copyVariant}
        />
        <ShareButton
          url={url}
          title={name}
          text={t.compartirTexto(name)}
          label={t.compartir}
        />
      </div>
    </Card>
  );
}
