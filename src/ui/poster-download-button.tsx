"use client";

import { useState } from "react";
import { Button } from "./button";
import { ImageIcon } from "./icons";
import {
  POSTER,
  POSTER_TEXT_WIDTH,
  posterLayout,
  wrapLines,
} from "./poster-layout";
import { downloadBlob, fillModules } from "./qr-download-button";
import { textos } from "./textos";

const INK = "#16211f";
const MUTED = "#4c5c58";
// A font that never arrives must not keep the poster from downloading.
const FONT_WAIT_MS = 3000;

// The font of the screen (Bricolage Grotesque, from next/font), so the poster
// reads like the app. The canvas only uses it once it is loaded.
async function screenFont(): Promise<string> {
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const fonts = (document as { fonts?: FontFaceSet }).fonts;
  if (fonts?.load) {
    const loads = Promise.all([
      fonts.load(`700 ${POSTER.captionSize}px ${family}`),
      fonts.load(`600 ${POSTER.nameSize}px ${family}`),
    ]);
    await Promise.race([
      loads.catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS)),
    ]);
  }
  return family;
}

// Draws the letter page of P1 (task 2.5): white, the QR in plain black for
// any scanner, the caption in ink and the name in muted, centered.
function drawPoster(
  matrix: ReadonlyArray<ReadonlyArray<boolean>>,
  caption: string,
  name: string,
  family: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER.width;
  canvas.height = POSTER.height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.font = `600 ${POSTER.nameSize}px ${family}`;
  const lines = wrapLines(
    name,
    POSTER_TEXT_WIDTH,
    (text) => context.measureText(text).width,
    POSTER.nameMaxLines,
  );
  const layout = posterLayout(matrix.length, lines.length);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, POSTER.width, POSTER.height);
  fillModules(context, matrix, layout.qr.x, layout.qr.y, layout.qr.scale);

  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = INK;
  context.font = `700 ${POSTER.captionSize}px ${family}`;
  context.fillText(caption, layout.caption.x, layout.caption.y);
  context.fillStyle = MUTED;
  context.font = `600 ${POSTER.nameSize}px ${family}`;
  lines.forEach((line, i) => {
    context.fillText(line, layout.name.x, layout.name.y[i]!);
  });
  return canvas;
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// "Afiche" (D-62): a letter page with the QR, "Reserva tu cita aquí" and the
// barbershop's name, ready to print for the mirror. Drawn in the browser
// from the matrix the server made (qrMatrix), so no service is involved.
export function PosterDownloadButton({
  matrix,
  caption,
  name,
  fileName,
  label,
}: {
  matrix: boolean[][];
  caption: string;
  name: string;
  fileName: string;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const canvas = drawPoster(matrix, caption, name, await screenFont());
      const blob = canvas ? await toPng(canvas) : null;
      if (!blob) {
        setFailed(true);
        return;
      }
      setFailed(false);
      downloadBlob(blob, fileName);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <Button variant="secondary" size="md" onClick={download} disabled={busy}>
        <ImageIcon size={18} />
        {label}
      </Button>
      <div role="status">
        {failed ? (
          <span className="text-help text-warning mt-2 flex">
            {textos.compartir.falloAfiche}
          </span>
        ) : null}
      </div>
    </div>
  );
}
