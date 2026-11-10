import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav, isActive } from "./bottom-nav";
import { textos } from "./textos";

const pathname = vi.hoisted(() => ({ current: "/panel" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const t = textos.ui.navegacion;

describe("BottomNav", () => {
  beforeEach(() => {
    pathname.current = "/panel";
  });

  it("offers the four sections of the owner's panel", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: t.etiqueta });
    expect(nav).toBeInTheDocument();
    for (const name of [t.agenda, t.clientes, t.compartir, t.mas]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("marks exactly one section as the current page", () => {
    pathname.current = "/panel/clientes";
    render(<BottomNav />);
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(t.clientes);
  });
});

describe("isActive", () => {
  it("keeps the agenda active only on its own page", () => {
    expect(isActive("/panel", "/panel")).toBe(true);
    expect(isActive("/panel", "/panel/clientes")).toBe(false);
  });

  it("keeps a section active on its sub-pages", () => {
    expect(isActive("/panel/clientes", "/panel/clientes/123")).toBe(true);
    expect(isActive("/panel/clientes", "/panel/compartir")).toBe(false);
  });
});
