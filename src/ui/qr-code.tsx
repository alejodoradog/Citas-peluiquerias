import { encode } from "uqr";

// QR codes are made on the server with uqr (MIT, no network, no external
// service). Error correction M survives a scratched or creased print; the
// 4-module light margin is the quiet zone scanners need.
export function qrMatrix(text: string): boolean[][] {
  return encode(text, { ecc: "M", border: 4 }).data;
}

// One SVG path for the whole code: a rectangle for every run of dark modules
// in a row, so a long link stays a short path.
export function qrPath(matrix: ReadonlyArray<ReadonlyArray<boolean>>): string {
  let path = "";
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      const run = x - start;
      path += `M${start} ${y}h${run}v1h-${run}z`;
    }
  });
  return path;
}

// QR of the booking link (D-14, D-62): white, Line border and 12 px radius.
// It is an image named by its label; the modules are drawn in ink.
export function QrCode({
  value,
  label,
  size = 168,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const matrix = qrMatrix(value);
  const modules = matrix.length;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${modules} ${modules}`}
      shapeRendering="crispEdges"
      className="border-line text-ink rounded-[0.75rem] border bg-white"
    >
      <path d={qrPath(matrix)} fill="currentColor" />
    </svg>
  );
}
