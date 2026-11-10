// The poster of D-62 ("Afiche"): a letter page at 150 dpi with only what the
// QR block of the screen shows, the QR, "Reserva tu cita aquí" and the
// barbershop's name (decision P1 of task 2.5). Pure, so it is tested without
// a canvas.
export const POSTER = {
  width: 1275,
  height: 1650,
  // One inch: what most home printers cannot reach, plus room to tape it.
  margin: 150,
  qrMaxSide: 825,
  gapAfterQr: 80,
  captionSize: 72,
  captionHeight: 86,
  gapAfterCaption: 24,
  nameSize: 48,
  nameLineHeight: 60,
  nameMaxLines: 3,
} as const;

// The widest a line of text can be, between the side margins.
export const POSTER_TEXT_WIDTH = POSTER.width - 2 * POSTER.margin;

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

export type PosterLayout = {
  qr: { x: number; y: number; scale: number };
  caption: { x: number; y: number };
  name: { x: number; y: number[]; lineHeight: number };
  // Where the last line ends, for the vertical centering.
  bottom: number;
};

// Where everything goes for a QR of `modules` modules and a name of
// `nameLines` lines. Text is drawn centered at x with its top at y. The QR
// modules are whole pixels, so no edge is blurred.
export function posterLayout(modules: number, nameLines: number): PosterLayout {
  const scale = Math.floor(POSTER.qrMaxSide / modules);
  const side = scale * modules;
  const height =
    side +
    POSTER.gapAfterQr +
    POSTER.captionHeight +
    (nameLines > 0
      ? POSTER.gapAfterCaption + nameLines * POSTER.nameLineHeight
      : 0);
  const top = Math.round((POSTER.height - height) / 2);
  const captionY = top + side + POSTER.gapAfterQr;
  const nameY = captionY + POSTER.captionHeight + POSTER.gapAfterCaption;
  const center = POSTER.width / 2;
  return {
    qr: { x: (POSTER.width - side) / 2, y: top, scale },
    caption: { x: center, y: captionY },
    name: {
      x: center,
      y: Array.from(
        { length: nameLines },
        (_, i) => nameY + i * POSTER.nameLineHeight,
      ),
      lineHeight: POSTER.nameLineHeight,
    },
    bottom: top + height,
  };
}
