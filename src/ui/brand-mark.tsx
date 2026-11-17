import { cx } from "./cx";

// The comb of Yapoin's icon (src/app/icon.svg), tilted, without its tile: the
// official logo (decision D1 of phase 7, 2026-11-16). It takes the color of
// the text around it, so it is the brand color on light screens and white on
// the brand color. The same shape is drawn on the poster
// (poster-download-button.tsx).
export const COMB_VIEWBOX = "80 112 352 300";

// The bar and the teeth, in the 512 × 512 space of the icon, turned -16°
// around its center.
export const COMB_ROTATION = { degrees: -16, cx: 256, cy: 256 } as const;
export const COMB_PARTS = [
  { x: 96, y: 148, width: 320, height: 66, radius: 33 },
  { x: 96, y: 190, width: 38, height: 190, radius: 19 },
  { x: 166.5, y: 190, width: 38, height: 160, radius: 19 },
  { x: 237, y: 190, width: 38, height: 190, radius: 19 },
  { x: 307.5, y: 190, width: 38, height: 160, radius: 19 },
  { x: 378, y: 190, width: 38, height: 190, radius: 19 },
] as const;

export function CombMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={COMB_VIEWBOX}
      aria-hidden="true"
      className={cx("shrink-0 fill-current", className)}
    >
      <g
        transform={`rotate(${COMB_ROTATION.degrees} ${COMB_ROTATION.cx} ${COMB_ROTATION.cy})`}
      >
        {COMB_PARTS.map((part) => (
          <rect
            key={part.x + part.height}
            x={part.x}
            y={part.y}
            width={part.width}
            height={part.height}
            rx={part.radius}
          />
        ))}
      </g>
    </svg>
  );
}
