import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_REFRESH_MS } from "@/modulos/agenda/dominio/live-agenda";
import { LiveRefresh } from "./live-refresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LiveRefresh", () => {
  it("asks the server again every minute while the tab is visible", () => {
    render(<LiveRefresh />);
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(LIVE_REFRESH_MS));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(LIVE_REFRESH_MS));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("waits while the tab is hidden and refreshes on coming back", () => {
    render(<LiveRefresh />);
    act(() => setVisibility("hidden"));
    act(() => vi.advanceTimersByTime(5 * LIVE_REFRESH_MS));
    expect(refresh).not.toHaveBeenCalled();
    act(() => setVisibility("visible"));
    expect(refresh).toHaveBeenCalledTimes(1);
    // The next one counts a whole minute from the return.
    act(() => vi.advanceTimersByTime(LIVE_REFRESH_MS - 1));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("stops when the agenda goes away", () => {
    const { unmount } = render(<LiveRefresh />);
    unmount();
    act(() => vi.advanceTimersByTime(3 * LIVE_REFRESH_MS));
    act(() => setVisibility("visible"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
