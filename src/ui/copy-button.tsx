"use client";

import { useState } from "react";
import { Button } from "./button";
import { CheckIcon, CopyIcon } from "./icons";
import { textos } from "./textos";

type CopyResult = "idle" | "copied" | "failed";

// Copies text to the clipboard and remembers how it went. The clipboard can
// be missing (an old browser, a page not served over HTTPS) or refused.
export function useCopy() {
  const [result, setResult] = useState<CopyResult>("idle");
  async function copy(text: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setResult("copied");
    } catch {
      setResult("failed");
    }
  }
  // For text that does not exist yet when the person taps, such as a link the
  // server makes (D-56). Safari lets a page write the clipboard only during
  // the tap, so the clipboard gets a promise of the text right away; where
  // that is not supported, the text is written once it arrives. Null means
  // there is nothing to copy (the caller shows why) and says nothing here.
  async function copyFrom(text: Promise<string | null>) {
    if (
      typeof ClipboardItem === "function" &&
      typeof navigator.clipboard?.write === "function"
    ) {
      const blob = text.then((value) => {
        if (value === null) throw new Error("nothing to copy");
        return new Blob([value], { type: "text/plain" });
      });
      // Handled below through `text`; this only keeps the rejection quiet.
      blob.catch(() => {});
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": blob }),
        ]);
        setResult("copied");
        return;
      } catch {
        // Falls through to writing the text.
      }
    }
    const value = await text.catch(() => null);
    if (value === null) {
      setResult("idle");
      return;
    }
    await copy(value);
  }

  return { result, copy, copyFrom, reset: () => setResult("idle") };
}

// What happened after copying. The live region is always on the page, so
// screen readers hear the change. When copying fails, the text is shown
// ready to be selected and copied by hand.
export function CopyFeedback({
  result,
  copiedLabel,
  text,
}: {
  result: CopyResult;
  copiedLabel: string;
  text: string;
}) {
  return (
    <div role="status">
      {result === "copied" ? (
        <span className="text-help text-success mt-2 flex items-center gap-1.5">
          <CheckIcon size={16} />
          {copiedLabel}
        </span>
      ) : null}
      {result === "failed" ? (
        <span className="mt-2 flex flex-col gap-1.5">
          <span className="text-help text-warning">
            {textos.ui.copiar.fallo}
          </span>{" "}
          <span className="rounded-field bg-paper text-body text-ink px-3 py-2 break-all select-all">
            {text}
          </span>
        </span>
      ) : null}
    </div>
  );
}

// Copy button of D-14 and D-62: secondary and medium, or primary where it is
// the screen's main action (the link card of D-62).
export function CopyButton({
  text,
  label,
  copiedLabel,
  variant = "secondary",
}: {
  text: string;
  label: string;
  copiedLabel: string;
  variant?: "primary" | "secondary";
}) {
  const { result, copy } = useCopy();
  return (
    <div className="flex flex-col">
      <Button variant={variant} size="md" onClick={() => copy(text)}>
        <CopyIcon size={18} />
        {label}
      </Button>
      <CopyFeedback result={result} copiedLabel={copiedLabel} text={text} />
    </div>
  );
}
