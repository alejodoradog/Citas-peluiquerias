"use client";

import { useState } from "react";
import { Button } from "./button";
import { DownloadIcon } from "./icons";
import { textos } from "./textos";

const CANVAS_SIZE = 1024;

// Draws the QR on a 1024 px canvas, large enough to print sharp on a letter
// page. Modules are whole pixels, centered, so no edge is blurred. Plain black
// on white, the most readable for any scanner.
function drawQr(matrix: ReadonlyArray<ReadonlyArray<boolean>>) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const modules = matrix.length;
  const scale = Math.floor(CANVAS_SIZE / modules);
  const offset = Math.floor((CANVAS_SIZE - scale * modules) / 2);
  fillModules(context, matrix, offset, offset, scale);
  return canvas;
}

// The dark modules in plain black, one whole-pixel square each, from (x, y).
// Shared with the poster of D-62.
export function fillModules(
  context: CanvasRenderingContext2D,
  matrix: ReadonlyArray<ReadonlyArray<boolean>>,
  left: number,
  top: number,
  scale: number,
) {
  context.fillStyle = "#000000";
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        context.fillRect(left + x * scale, top + y * scale, scale, scale);
      }
    });
  });
}

// Hands a finished image to the browser as a download, without leaving the
// link on the page.
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers start the download after click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// "Descargar QR para imprimir" (D-14, D-62). The matrix comes from the
// server (qrMatrix), so the QR library never reaches the browser.
export function QrDownloadButton({
  matrix,
  fileName,
  label,
}: {
  matrix: boolean[][];
  fileName: string;
  label: string;
}) {
  const [failed, setFailed] = useState(false);

  function download() {
    const canvas = drawQr(matrix);
    if (!canvas) {
      setFailed(true);
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        setFailed(true);
        return;
      }
      setFailed(false);
      downloadBlob(blob, fileName);
    }, "image/png");
  }

  return (
    <div className="flex flex-col">
      <Button variant="secondary" size="md" onClick={download}>
        <DownloadIcon size={18} />
        {label}
      </Button>
      <div role="status">
        {failed ? (
          <span className="text-help text-warning mt-2 flex">
            {textos.ui.qr.falloDescarga}
          </span>
        ) : null}
      </div>
    </div>
  );
}
