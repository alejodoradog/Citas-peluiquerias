"use client";

import { useState } from "react";
import { Button } from "./button";
import { ImageIcon } from "./icons";
import {
  coverCrop,
  fitFontSize,
  POSTER,
  POSTER_COLORS,
  POSTER_LINK_WIDTH,
  POSTER_TEXT_WIDTH,
  posterLayout,
  wrapLines,
} from "./poster-layout";
import { downloadBlob, fillModules } from "./qr-download-button";
import { textos } from "./textos";

// A font or a logo that never arrives must not keep the poster from
// downloading.
const FONT_WAIT_MS = 3000;
const LOGO_WAIT_MS = 5000;

// The font of the screen (Bricolage Grotesque, from next/font), so the poster
// reads like the app. The canvas only uses it once it is loaded.
async function screenFont(): Promise<string> {
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const fonts = (document as { fonts?: FontFaceSet }).fonts;
  if (fonts?.load) {
    const loads = Promise.all([
      fonts.load(`700 ${POSTER.nameSize}px ${family}`),
      fonts.load(`600 ${POSTER.linkSize}px ${family}`),
    ]);
    await Promise.race([
      loads.catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS)),
    ]);
  }
  return family;
}

// The barbershop's logo, from the public images bucket (it allows any
// origin, so the canvas can still be exported). Null when there is none or it
// does not load: the poster goes without it.
function loadLogo(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => resolve(null), LOGO_WAIT_MS);
    image.crossOrigin = "anonymous";
    image.onload = () => {
      clearTimeout(timer);
      resolve(image.naturalWidth > 0 ? image : null);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = url;
  });
}

type Box = { x: number; y: number; width: number; height: number };

function roundedRect(
  context: CanvasRenderingContext2D,
  { x, y, width, height }: Box,
  radius: number,
) {
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, radius);
  } else {
    context.rect(x, y, width, height);
  }
}

// The brand mark of BrandHeader (the `comb` utility of globals.css): a bar
// with the teeth of a comb under it, 3 of every 9 units.
function drawComb(context: CanvasRenderingContext2D, comb: Box) {
  const unit = comb.height / 12;
  context.fillStyle = POSTER_COLORS.white;
  context.fillRect(comb.x, comb.y, comb.width, Math.round(4 * unit));
  for (let x = 0; x < comb.width; x += 9 * unit) {
    context.fillRect(comb.x + x, comb.y, 3 * unit, comb.height);
  }
}

// Two soft circles of light on the brand color, at opposite corners, so the
// page does not look flat. They stay behind everything else.
function drawGlow(context: CanvasRenderingContext2D, bandY: number) {
  context.fillStyle = "rgba(255, 255, 255, 0.07)";
  for (const [x, y, radius] of [
    [POSTER.width + 40, 120, 380],
    [-90, bandY - 160, 320],
  ] as const) {
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fill();
  }
}

type PosterContent = {
  matrix: ReadonlyArray<ReadonlyArray<boolean>>;
  caption: string;
  name: string;
  link: string;
};

// Draws the letter page in the colors of Yapoin: the logo and the name in
// white on the brand color, the QR in plain black on a white card for any
// scanner, and the Yapoin brand in the band at the foot.
function drawPoster(
  { matrix, caption, name, link }: PosterContent,
  logo: HTMLImageElement | null,
  family: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER.width;
  canvas.height = POSTER.height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.font = `700 ${POSTER.nameSize}px ${family}`;
  const lines = wrapLines(
    name,
    POSTER_TEXT_WIDTH,
    (text) => context.measureText(text).width,
    POSTER.nameMaxLines,
  );
  const layout = posterLayout(matrix.length, lines.length, logo !== null);

  context.fillStyle = POSTER_COLORS.brand;
  context.fillRect(0, 0, POSTER.width, POSTER.height);
  drawGlow(context, layout.band.y);
  context.textAlign = "center";
  context.textBaseline = "top";

  if (logo && layout.logo) {
    const tile = layout.logo;
    context.fillStyle = POSTER_COLORS.white;
    roundedRect(context, tile, tile.radius);
    context.fill();
    const inner = {
      x: tile.x + tile.padding,
      y: tile.y + tile.padding,
      width: tile.width - 2 * tile.padding,
      height: tile.height - 2 * tile.padding,
    };
    const crop = coverCrop(logo.naturalWidth, logo.naturalHeight);
    context.save();
    roundedRect(context, inner, tile.radius - tile.padding);
    context.clip();
    context.drawImage(
      logo,
      crop.sx,
      crop.sy,
      crop.side,
      crop.side,
      inner.x,
      inner.y,
      inner.width,
      inner.height,
    );
    context.restore();
  }

  context.fillStyle = POSTER_COLORS.white;
  context.font = `700 ${POSTER.nameSize}px ${family}`;
  lines.forEach((line, i) => {
    context.fillText(line, layout.name.x, layout.name.y[i]!);
  });

  roundedRect(context, layout.card, layout.card.radius);
  context.fill();
  fillModules(context, matrix, layout.qr.x, layout.qr.y, layout.qr.scale);
  context.fillStyle = POSTER_COLORS.ink;
  context.font = `700 ${POSTER.captionSize}px ${family}`;
  context.fillText(caption, layout.caption.x, layout.caption.y);
  const linkSize = fitFontSize(link, POSTER_LINK_WIDTH, (text, size) => {
    context.font = `600 ${size}px ${family}`;
    return context.measureText(text).width;
  });
  context.fillStyle = POSTER_COLORS.brandStrong;
  context.font = `600 ${linkSize}px ${family}`;
  context.fillText(link, layout.link.x, layout.link.y);
  context.fillStyle = POSTER_COLORS.brandSoft;
  context.font = `600 ${POSTER.hintSize}px ${family}`;
  context.fillText(textos.compartir.aficheAyuda, layout.hint.x, layout.hint.y);
  context.fillStyle = POSTER_COLORS.brandStrong;

  context.fillRect(
    layout.band.x,
    layout.band.y,
    layout.band.width,
    layout.band.height,
  );
  drawComb(context, layout.comb);
  context.font = `700 ${POSTER.brandSize}px ${family}`;
  context.fillText(textos.marca, layout.brand.x, layout.brand.y);
  return canvas;
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function posterPng(
  content: PosterContent,
  logo: HTMLImageElement | null,
  family: string,
): Promise<Blob | null> {
  const canvas = drawPoster(content, logo, family);
  return canvas ? toPng(canvas) : null;
}

// "Afiche" (D-62): a letter page with the barbershop's logo and name, the QR
// with "Reserva tu cita aquí" and the link, and the Yapoin brand, ready to
// print for the mirror. Drawn in the browser from the matrix the server made
// (qrMatrix), so no service is involved.
export function PosterDownloadButton({
  matrix,
  caption,
  name,
  link,
  logoUrl,
  fileName,
  label,
}: {
  matrix: boolean[][];
  caption: string;
  name: string;
  // The link written out, without the protocol ("yapoin.com/slug").
  link: string;
  logoUrl: string | null;
  fileName: string;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const content = { matrix, caption, name, link };
      const [family, logo] = await Promise.all([
        screenFont(),
        loadLogo(logoUrl),
      ]);
      let blob: Blob | null;
      try {
        blob = await posterPng(content, logo, family);
      } catch (error) {
        // A logo the browser will not let the canvas export: without it.
        if (!logo) throw error;
        blob = await posterPng(content, null, family);
      }
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
