import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, StrictMode, useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
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
    // Coming back is a later navigation, never the same task.
    await act(async () => {});
    rerender(page("visible"));
    expect(screen.getByRole("button")).toHaveTextContent("Cuenta 0");
  });

  it("keeps what the person started under Strict Mode's double setup", async () => {
    const user = userEvent.setup();
    render(<StrictMode>{page("visible")}</StrictMode>);
    await user.click(screen.getByRole("button"));
    await act(async () => {});
    expect(screen.getByRole("button")).toHaveTextContent("Cuenta 1");
  });

  it("does not mount the children again for Strict Mode's double setup", async () => {
    const setups = vi.fn();
    function Probe() {
      useEffect(() => {
        setups();
      }, []);
      return null;
    }
    render(
      <StrictMode>
        <FreshOnReturn>
          <Probe />
        </FreshOnReturn>
      </StrictMode>,
    );
    await act(async () => {});
    // Strict Mode sets an effect up twice on the first mount; a new key
    // would mount the children again and set it up twice more.
    expect(setups).toHaveBeenCalledTimes(2);
  });
});
