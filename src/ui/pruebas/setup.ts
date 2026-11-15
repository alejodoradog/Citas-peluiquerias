import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not implement modal dialogs. This minimal stand-in opens and
// closes them like a browser does (the open attribute and the close event);
// focus trapping and the backdrop only exist in a real browser.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// findBy… and waitFor wait 1 s by default. With the whole suite and
// coverage, a save cycle (click → the fake action → useActionState → a new
// render) can take longer, and a test fails although the screen is right
// (the partner's note in docs/trabajo-en-paralelo.md, 2026-11-15). Five
// seconds still fails fast on a real bug.
configure({ asyncUtilTimeout: 5_000 });

// Each test renders into a fresh document.
afterEach(() => {
  cleanup();
});
