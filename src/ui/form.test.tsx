import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { FormState } from "@/lib/formularios/form-state";
import { AuthHeading, AuthShell } from "./auth-shell";
import { Field } from "./field";
import { ActionForm, SubmitButton, useFormAction } from "./form";
import { LegalPage } from "./legal-page";
import { Notice } from "./notice";

type State = FormState<"email" | "name", "email_invalid" | "taken", "sent">;

const messages = {
  email_invalid: "Revisa el correo.",
  taken: "Ya existe.",
  invalid: "Revisa este dato.",
};

// A fake Server Action: the email decides what it answers.
async function action(_previous: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email"));
  const name = String(formData.get("name"));
  if (!email.includes("@")) {
    return {
      status: "invalid",
      fieldErrors: { email: "email_invalid" },
      values: { email, name },
    };
  }
  if (email.startsWith("usado")) {
    return { status: "failed", error: "taken", values: { email, name } };
  }
  return { status: "done", notice: "sent" };
}

function TestForm() {
  const form = useFormAction(action, messages);
  if (form.notice === "sent") return <p>Enviado</p>;
  return (
    <ActionForm form={form}>
      {form.formError ? (
        <Notice
          tone="danger"
          title={`${form.formErrorCode}: ${form.formError}`}
        />
      ) : null}
      <Field label="Nombre" name="name" defaultValue={form.value("name")} />
      <Field
        label="Correo"
        name="email"
        defaultValue={form.value("email")}
        error={form.fieldError("email")}
      />
      <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
    </ActionForm>
  );
}

describe("useFormAction and ActionForm", () => {
  it("shows the field error, keeps what was typed and focuses the field", async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.type(screen.getByLabelText("Nombre"), "Carlos");
    await user.type(screen.getByLabelText("Correo"), "sin-arroba");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const email = await screen.findByLabelText("Correo");
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(email).toHaveAccessibleDescription("Revisa el correo.");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Carlos");
    await waitFor(() => expect(email).toHaveFocus());
  });

  it("names the failure with its copy and its code", async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.type(screen.getByLabelText("Correo"), "usado@correo.com");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "taken: Ya existe.",
    );
  });

  it("passes the success notice on", async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.type(screen.getByLabelText("Correo"), "nuevo@correo.com");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Enviado")).toBeInTheDocument();
  });
});

describe("account screen frame", () => {
  it("shows the brand, one h1 and the intro", () => {
    render(
      <AuthShell>
        <AuthHeading title="Ingresa a tu barbería" intro="Una línea." />
      </AuthShell>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Yapoin" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Ingresa a tu barbería" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Una línea.")).toBeInTheDocument();
  });

  it("says a legal page is on its way and links home", () => {
    render(<LegalPage title="Términos de uso" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Términos de uso" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver al inicio" }),
    ).toHaveAttribute("href", "/");
  });
});
