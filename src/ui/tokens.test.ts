import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The theme in globals.css must carry every value of the F-01 design page
// (docs/diseno/F01-Fundamentos.dc.html), so screens use tokens, not hex.
const css = readFileSync(
  join(process.cwd(), "src", "app", "globals.css"),
  "utf8",
);

function token(name: string): string | undefined {
  return css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
}

describe("design tokens", () => {
  it.each([
    ["color-ink", "#16211f"],
    ["color-muted", "#4c5c58"],
    ["color-paper", "#f4f7f6"],
    ["color-line", "#cbd6d3"],
    ["color-brand", "#1e7f8c"],
    ["color-brand-strong", "#145a63"],
    ["color-brand-soft", "#e2f0f2"],
    ["color-danger", "#b42318"],
    ["color-danger-soft", "#fdecea"],
    ["color-success", "#1d6b3a"],
    ["color-success-soft", "#e5f3ea"],
    ["color-warning", "#7a4a00"],
    ["color-warning-soft", "#fff3dc"],
    ["color-neutral-soft", "#e9eeed"],
    // Field and checkbox borders: darker than the design's line so they reach
    // 3:1 against white (WCAG 1.4.11), as the founder chose.
    ["color-line-strong", "#7f908c"],
  ])("%s is %s", (name, value) => {
    expect(token(name)).toBe(value);
  });

  it.each([
    ["text-display", "2rem"],
    ["text-title", "1.625rem"],
    ["text-section", "1.25rem"],
    ["text-button", "1.0625rem"],
    ["text-body", "0.9375rem"],
    ["text-label", "0.875rem"],
    ["text-help", "0.8125rem"],
    ["text-chip", "0.75rem"],
  ])("%s is %s", (name, value) => {
    expect(token(name)).toBe(value);
  });

  it.each([
    ["radius-field", "0.75rem"],
    ["radius-button", "0.875rem"],
    ["radius-card", "1rem"],
  ])("%s is %s", (name, value) => {
    expect(token(name)).toBe(value);
  });

  it("uses Bricolage Grotesque", () => {
    expect(token("font-sans")).toMatch(/^var\(--font-bricolage\)/);
  });

  it("defines the floating button shadow", () => {
    expect(token("shadow-fab")).toBe("0 6px 16px rgba(20, 90, 99, 0.35)");
  });
});
