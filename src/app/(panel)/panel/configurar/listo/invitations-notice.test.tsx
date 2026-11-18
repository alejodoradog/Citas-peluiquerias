import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";
import { textos } from "@/ui/textos";
import { InvitationsNotice, type TeamInvitation } from "./invitations-notice";

const t = textos.asistente.listo.invitaciones;
const member = (
  id: string,
  name: string,
  state: TeamInvitation["state"],
): TeamInvitation => ({
  id,
  name,
  email: `${name.toLowerCase()}@correo.com`,
  state,
});

describe("InvitationsNotice", () => {
  it("lists who got their invitation, with their email", async () => {
    render(
      <InvitationsNotice
        team={[member("1", "Ana", "invited"), member("2", "Beto", "invited")]}
      />,
    );
    expect(
      await screen.findByText(
        t.enviadas("a Ana (ana@correo.com) y a Beto (beto@correo.com)", true),
      ),
    ).toBeInTheDocument();
  });

  it("speaks in singular for one, and joins three", async () => {
    const { rerender } = render(
      <InvitationsNotice team={[member("1", "Ana", "invited")]} />,
    );
    expect(
      await screen.findByText(t.enviadas("a Ana (ana@correo.com)", false)),
    ).toBeInTheDocument();
    rerender(
      <InvitationsNotice
        team={[
          member("1", "Ana", "invited"),
          member("2", "Beto", "invited"),
          member("3", "Dani", "invited"),
        ]}
      />,
    );
    expect(
      await screen.findByText(/a Ana \(.*\), a Beto \(.*\) y a Dani \(.*\)/),
    ).toBeInTheDocument();
  });

  it("says who did not get theirs, with a link to their page", async () => {
    render(
      <InvitationsNotice
        team={[member("1", "Ana", "invited"), member("3", "Carlos", "none")]}
      />,
    );
    expect(await screen.findByText(t.noSalio("Carlos"))).toBeInTheDocument();
    expect(screen.getByText(t.invitalo)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: t.abrirFicha("Carlos") }),
    ).toHaveAttribute("href", routes.panelBarberEdit("3"));
    expect(screen.queryByText(t.noSalio("Ana"))).not.toBeInTheDocument();
  });

  it("says nothing without professionals to invite or with access already", () => {
    const { container, rerender } = render(<InvitationsNotice team={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <InvitationsNotice
        team={[member("1", "Ana", "active"), member("2", "Beto", "revoked")]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
