import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Accessibility of the whole screen in a real browser (contrast with the real
// CSS, roles, names): no serious or critical violation.
export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
  expect(blocking, "axe violations").toEqual([]);
}

// Every visible control is at least 44 × 44 px (F-01). A link inside a
// sentence is exempt (WCAG 2.5.8): its parent has more text than it does.
// `except` leaves out controls drawn to scale on purpose: the cards and free
// spaces of the agenda's grid ("[data-to-scale]", D-30, decision A9 of task
// 4.1), whose rows in D-31 do reach 44 px.
export async function expectTouchTargets(
  page: Page,
  { except }: { except?: string } = {},
) {
  const small = await page.evaluate((except) => {
    const selector =
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="switch"], [role="checkbox"], [tabindex]:not([tabindex="-1"])';
    const found: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (except && element.matches(except)) continue;
      // Visually hidden inputs are measured by their label (switch, checkbox).
      const target =
        element instanceof HTMLInputElement &&
        element.classList.contains("sr-only")
          ? (element.closest("label") ?? element)
          : element;
      const box = target.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      const parentText = element.parentElement?.textContent?.trim() ?? "";
      const ownText = element.textContent?.trim() ?? "";
      const inSentence =
        element.tagName === "A" && parentText.length > ownText.length;
      if (inSentence) continue;
      if (box.width < 44 - 0.5 || box.height < 44 - 0.5) {
        found.push(
          `${element.tagName.toLowerCase()} "${ownText || element.getAttribute("aria-label") || element.getAttribute("name")}" ${Math.round(box.width)}×${Math.round(box.height)}`,
        );
      }
    }
    return found;
  }, except);
  expect(small, "controls under 44 px").toEqual([]);
}

// Text fields of 16 px or more, so iPhones do not zoom in when tapped.
export async function expectNoZoomOnFocus(page: Page) {
  const sizes = await page
    .locator('input:not([type="hidden"]):not(.sr-only)')
    .evaluateAll((inputs) =>
      inputs.map((input) => parseFloat(getComputedStyle(input).fontSize)),
    );
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
}

// Tabbing through the screen always shows a focus ring of 2 px or more.
export async function expectVisibleFocus(page: Page, stops = 12) {
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const element = document.activeElement;
      // The end of the page, or the Next.js dev tools button (a custom
      // element that exists only in development).
      if (!element || element === document.body) return null;
      if (element.tagName.includes("-")) return null;
      const style = getComputedStyle(element);
      // A visually hidden input shows its ring on the drawn control next to it.
      const drawn =
        element.classList.contains("sr-only") && element.nextElementSibling
          ? getComputedStyle(element.nextElementSibling)
          : style;
      return {
        name: element.textContent?.trim() || element.getAttribute("name"),
        width: parseFloat(drawn.outlineWidth),
        style: drawn.outlineStyle,
      };
    });
    if (!ring) break;
    expect(ring.style, `focus ring on ${ring.name}`).not.toBe("none");
    expect(ring.width, `focus ring on ${ring.name}`).toBeGreaterThanOrEqual(2);
  }
}
