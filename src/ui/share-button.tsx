"use client";

import { Button } from "./button";
import { CopyFeedback, useCopy } from "./copy-button";
import { ShareIcon } from "./icons";
import { textos } from "./textos";

// Share button of D-14 and D-62. On a phone it opens the system's share sheet
// (WhatsApp, Instagram…); where there is none, as on most computers, it
// copies the link instead and says so. Closing the share sheet is not an
// error, so nothing is shown then.
export function ShareButton({
  url,
  title,
  text,
  label,
}: {
  url: string;
  title: string;
  text: string;
  label: string;
}) {
  const { result, copy, reset } = useCopy();

  async function share() {
    // Checked on tap, not on render, so the server and the browser agree.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title, text });
        reset();
        return;
      } catch (error) {
        if ((error as { name?: unknown } | null)?.name === "AbortError") {
          return;
        }
      }
    }
    await copy(url);
  }

  return (
    <div className="flex flex-col">
      <Button variant="secondary" size="md" onClick={share}>
        <ShareIcon size={18} />
        {label}
      </Button>
      <CopyFeedback
        result={result}
        copiedLabel={textos.ui.compartir.copiado}
        text={url}
      />
    </div>
  );
}
