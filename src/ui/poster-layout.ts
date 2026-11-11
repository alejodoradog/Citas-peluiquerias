// The poster of D-62 ("Afiche"): a letter page at 150 dpi in the colors of
// Yapoin. The barbershop's logo and name on top, the QR in a white card with
// "Reserva tu cita aquí" and the link written out, and the Yapoin brand at the
// foot (the founder's design, which replaced decision P1 of task 2.5). Pure,
// so it is tested without a canvas.
export const POSTER = {
  width: 1275,
  height: 1650,
  // One inch: what most home printers cannot reach, plus room to tape it.
  margin: 150,
  // The barbershop's logo, when it has one, on a white tile.
  logoSize: 150,
  logoPadding: 12,
  logoRadius: 32,
  gapAfterLogo: 28,
  nameSize: 68,
  nameLineHeight: 80,
  nameMaxLines: 2,
  gapAfterName: 44,
  // The white card that holds the QR, so any scanner reads it. The QR
  // brings its own quiet zone (qrMatrix), so the card's padding is small.
  cardPadding: 28,
  cardRadius: 48,
  qrMaxSide: 600,
  gapAfterQr: 8,
  captionSize: 64,
  captionHeight: 78,
  gapAfterCaption: 12,
  linkSize: 42,
  linkMinSize: 26,
  linkHeight: 54,
  // How to scan, under the card, for whoever has never done it.
  gapBeforeHint: 32,
  hintSize: 36,
  hintHeight: 44,
  // The band at the foot with the Yapoin brand: the comb over the name.
  bandHeight: 200,
  combWidth: 150,
  combHeight: 30,
  gapAfterComb: 22,
  brandSize: 56,
  brandHeight: 66,
} as const;

// The colors of the app (src/app/globals.css).
export const POSTER_COLORS = {
  brand: "#1e7f8c",
  brandStrong: "#145a63",
  brandSoft: "#e2f0f2",
  ink: "#16211f",
  white: "#ffffff",
} as const;

// The widest a line of text can be, between the side margins.
export const POSTER_TEXT_WIDTH = POSTER.width - 2 * POSTER.margin;

// The card spans the margins; the link fits inside its padding.
export const POSTER_LINK_WIDTH = POSTER_TEXT_WIDTH - 2 * POSTER.cardPadding;

const ELLIPSIS = "…";

// Splits a word that is wider than the line by itself, character by
// character, so nothing spills past the margin.
function splitWord(
  word: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const pieces: string[] = [];
  let piece = "";
  for (const char of word) {
    if (piece && measure(piece + char) > maxWidth) {
      pieces.push(piece);
      piece = char;
    } else {
      piece += char;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

// The longest start of the text that fits with an ellipsis after it.
function truncate(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string {
  let end = text.length;
  while (
    end > 0 &&
    measure(text.slice(0, end).trimEnd() + ELLIPSIS) > maxWidth
  ) {
    end -= 1;
  }
  return text.slice(0, end).trimEnd() + ELLIPSIS;
}

// Greedy word wrap: as many words per line as fit in maxWidth, measured by
// the caller (the canvas, in the browser). Past maxLines the last line ends
// in an ellipsis.
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
  maxLines = Number.POSITIVE_INFINITY,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (measure(word) <= maxWidth) {
      line = word;
      continue;
    }
    const pieces = splitWord(word, maxWidth, measure);
    lines.push(...pieces.slice(0, -1));
    line = pieces.at(-1) ?? "";
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines - 1);
  const rest = lines.slice(maxLines - 1).join(" ");
  return [...kept, truncate(rest, maxWidth, measure)];
}

// The largest size, from `size` down to `min`, at which the text fits in
// maxWidth. A link is never cut: past `min` it is drawn at `min` anyway.
export function fitFontSize(
  text: string,
  maxWidth: number,
  measureAt: (text: string, size: number) => number,
  size: number = POSTER.linkSize,
  min: number = POSTER.linkMinSize,
): number {
  let current = size;
  while (current > min && measureAt(text, current) > maxWidth) current -= 1;
  return current;
}

type Box = { x: number; y: number; width: number; height: number };

export type PosterLayout = {
  logo: (Box & { radius: number; padding: number }) | null;
  name: { x: number; y: number[]; lineHeight: number };
  card: Box & { radius: number };
  qr: { x: number; y: number; scale: number };
  caption: { x: number; y: number };
  link: { x: number; y: number };
  hint: { x: number; y: number };
  band: Box;
  comb: Box;
  brand: { x: number; y: number };
  // Where the content above the band starts and ends, for the centering.
  top: number;
  bottom: number;
};

// Where everything goes for a QR of `modules` modules, a name of `nameLines`
// lines and a logo or none. Text is drawn centered at x with its top at y.
// The QR modules are whole pixels, so no edge is blurred.
export function posterLayout(
  modules: number,
  nameLines: number,
  hasLogo: boolean,
): PosterLayout {
  const center = POSTER.width / 2;
  const scale = Math.floor(POSTER.qrMaxSide / modules);
  const side = scale * modules;
  const cardWidth = POSTER_TEXT_WIDTH;
  const cardHeight =
    POSTER.cardPadding +
    side +
    POSTER.gapAfterQr +
    POSTER.captionHeight +
    POSTER.gapAfterCaption +
    POSTER.linkHeight +
    POSTER.cardPadding;
  const logoHeight = hasLogo ? POSTER.logoSize + POSTER.gapAfterLogo : 0;
  const nameHeight =
    nameLines > 0 ? nameLines * POSTER.nameLineHeight + POSTER.gapAfterName : 0;
  const hintHeight = POSTER.gapBeforeHint + POSTER.hintHeight;
  const height = logoHeight + nameHeight + cardHeight + hintHeight;

  // Centered in the page above the band.
  const bandY = POSTER.height - POSTER.bandHeight;
  const top = Math.round((bandY - height) / 2);
  const nameY = top + logoHeight;
  const cardY = nameY + nameHeight;
  const qrY = cardY + POSTER.cardPadding;
  const captionY = qrY + side + POSTER.gapAfterQr;
  const linkY = captionY + POSTER.captionHeight + POSTER.gapAfterCaption;

  const brandBlock =
    POSTER.combHeight + POSTER.gapAfterComb + POSTER.brandHeight;
  const combY = bandY + Math.round((POSTER.bandHeight - brandBlock) / 2);

  return {
    logo: hasLogo
      ? {
          x: (POSTER.width - POSTER.logoSize) / 2,
          y: top,
          width: POSTER.logoSize,
          height: POSTER.logoSize,
          radius: POSTER.logoRadius,
          padding: POSTER.logoPadding,
        }
      : null,
    name: {
      x: center,
      y: Array.from(
        { length: nameLines },
        (_, i) => nameY + i * POSTER.nameLineHeight,
      ),
      lineHeight: POSTER.nameLineHeight,
    },
    card: {
      x: POSTER.margin,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      radius: POSTER.cardRadius,
    },
    qr: { x: (POSTER.width - side) / 2, y: qrY, scale },
    caption: { x: center, y: captionY },
    link: { x: center, y: linkY },
    hint: { x: center, y: cardY + cardHeight + POSTER.gapBeforeHint },
    band: { x: 0, y: bandY, width: POSTER.width, height: POSTER.bandHeight },
    comb: {
      x: (POSTER.width - POSTER.combWidth) / 2,
      y: combY,
      width: POSTER.combWidth,
      height: POSTER.combHeight,
    },
    brand: { x: center, y: combY + POSTER.combHeight + POSTER.gapAfterComb },
    top,
    bottom: top + height,
  };
}

// Where a logo of any proportion is drawn to fill a square tile without
// stretching: the centered square of the image (like object-fit: cover).
export function coverCrop(
  width: number,
  height: number,
): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return {
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) / 2),
    side,
  };
}
