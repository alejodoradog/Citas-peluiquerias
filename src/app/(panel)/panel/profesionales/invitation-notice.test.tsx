import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SAVE_INVITE_REFUSALS } from "@/modulos/cuentas/dominio/professional-access";
import { textos } from "@/ui/textos";
import { InvitationNotice } from "./invitation-notice";

const t = textos.barberos.acceso;

describe("InvitationNotice", () => {
  it("says the invitation went to the email read from the database", async () => {
    render(
      <InvitationNotice
        notice="sent"
        name="Kevin"
        email="kevin@correo.com"
        pending
      />,
    );
    expect(
      await screen.findByText(t.alGuardar.enviada("kevin@correo.com")),
    ).toBeInTheDocument();
  });

  it("does not claim it when the database has no invitation pending", () => {
    const { container } = render(
      <InvitationNotice
        notice="sent"
        name="Kevin"
        email="kevin@correo.com"
        pending={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each(SAVE_INVITE_REFUSALS)(
    "says the professional was saved and why %s kept the invitation from going out",
    async (code) => {
      render(
        <InvitationNotice
          notice={code}
          name="Kevin"
          email="kevin@correo.com"
          pending={false}
        />,
      );
      expect(
        await screen.findByText(t.alGuardar.noSalio("Kevin")),
      ).toBeInTheDocument();
      expect(screen.getByText(t.errores[code])).toBeInTheDocument();
      expect(screen.queryByText(/kevin@correo\.com/)).not.toBeInTheDocument();
    },
  );
});
