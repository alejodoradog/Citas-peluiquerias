import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, useState } from "react";
import { describe, expect, it } from "vitest";
import { FreshOnReturn } from "./fresh-on-return";

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {`Cuenta ${count}`}
    </button>
  );
}

const page = (mode: "visible" | "hidden") => (
  <Activity mode={mode}>
    <FreshOnReturn>
      <Counter />
    </FreshOnReturn>
  </Activity>
);

describe("FreshOnReturn", () => {
  it("keeps the state while the screen stays visible", async () => {
    const user = userEvent.setup();
    const { rerender } = render(page("visible"));
    await user.click(screen.getByRole("button"));
    rerender(page("visible"));
    expect(screen.getByRole("button")).toHaveTextContent("Cuenta 1");
  });

  it("starts the children again after the screen was hidden", async () => {
    const user = userEvent.setup();
    const { rerender } = render(page("visible"));
    await user.click(screen.getByRole("button"));
    rerender(page("hidden"));
    rerender(page("visible"));
    expect(screen.getByRole("button")).toHaveTextContent("Cuenta 0");
  });
});
