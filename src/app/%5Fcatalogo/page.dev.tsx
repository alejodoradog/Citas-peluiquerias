import { notFound } from "next/navigation";
import { ActionBar } from "@/ui/action-bar";
import { BottomNav } from "@/ui/bottom-nav";
import { BrandHeader } from "@/ui/brand";
import { Button, ButtonLink } from "@/ui/button";
import { Card } from "@/ui/card";
import { Checkbox } from "@/ui/checkbox";
import { Chip } from "@/ui/chip";
import { Fab } from "@/ui/fab";
import { Field } from "@/ui/field";
import { CalendarIcon } from "@/ui/icons";
import { List, ListRow } from "@/ui/list";
import { Notice } from "@/ui/notice";
import { EmptyState, ErrorState, LoadingState } from "@/ui/states";
import { Steps } from "@/ui/steps";
import { Switch } from "@/ui/switch";
import { TextLink } from "@/ui/text-link";

// Development-only catalog of the F-01 components (a "*.dev.tsx" page, left
// out of production builds by next.config.ts). The e2e tests check every
// component here in a real browser: accessibility, touch size and keyboard.
// Its sample copy is test data, not interface text.
export default function Catalogo() {
  // Second barrier: never on Vercel or in a production server, even if
  // NODE_ENV were changed there.
  if (process.env.VERCEL_ENV || process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5.5 px-5 pt-7 pb-40">
      <BrandHeader />
      <h1 className="text-title">Catálogo de F-01</h1>
      <Steps current={2} total={3} />

      <section className="flex flex-col gap-3">
        <h2 className="text-section">Botones</h2>
        <Button>Reservar cita</Button>
        <Button variant="secondary">Cómo llegar</Button>
        <Button variant="danger">Cancelar cita</Button>
        <Button variant="dangerSolid">Borrar cliente</Button>
        <Button variant="text">Ver los 5 servicios</Button>
        <Button size="md" variant="secondary">
          Crear cita
        </Button>
        <Button size="sm" variant="secondary" block={false}>
          Cerrar sesión
        </Button>
        <Button disabled>Guardando…</Button>
        <ButtonLink href="/registro">Crear cuenta gratis</ButtonLink>
        <TextLink href="/ingresar" standalone>
          Volver a ingresar
        </TextLink>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section">Campos y controles</h2>
        <Field label="Nombre" name="nombre" defaultValue="Camila Rojas" />
        <Field
          label="Correo"
          name="correo"
          defaultValue="camila.rojas@correo"
          error="Revisa el correo. Debe verse como nombre@correo.com."
        />
        <Field
          label="Celular"
          name="celular"
          optional
          placeholder="300 123 4567"
          help="Solo para que la barbería te pueda llamar."
        />
        <Switch
          label="Avisos por correo"
          description="Recibe cada nueva reserva o cancelación."
          name="avisos"
          defaultChecked
        />
        <Switch label="Reservas en línea" name="reservas" />
        <Checkbox label="Yo también corto" name="corto" defaultChecked />
        <Checkbox label="Corte" name="corte" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section">Estados</h2>
        <div className="flex flex-wrap gap-2">
          <Chip tone="brand">Confirmada</Chip>
          <Chip tone="warning">Nueva</Chip>
          <Chip tone="success">Atendida</Chip>
          <Chip tone="danger">No asistió</Chip>
          <Chip tone="neutral">Cancelada por cliente</Chip>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section">Avisos</h2>
        <Notice tone="info" title="Sin correo no hay confirmación">
          El cliente no recibe confirmación ni recordatorio.
        </Notice>
        <Notice
          tone="warning"
          title="Tu prueba gratis vence en 3 días"
          action={<a href="#pagar">Ver cómo pagar</a>}
        >
          Paga para seguir recibiendo reservas.
        </Notice>
        <Notice tone="danger" title="Tu barbería venció el 24 de nov" />
        <Notice tone="success" title="Cita marcada como atendida" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section">Listas y tarjetas</h2>
        <List>
          <ListRow
            href="#corte"
            title="Corte"
            subtitle="40 min"
            trailing={<strong>$25.000</strong>}
          />
          <ListRow
            href="#barba"
            title="Barba"
            subtitle="20 min"
            icon={<CalendarIcon />}
            trailing={<Chip tone="neutral">Inactivo</Chip>}
          />
        </List>
        <Card>
          <p className="text-muted text-sm">
            Tarjeta base: fondo blanco, borde Línea, radio 16 px.
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section">Vacío, cargando y error</h2>
        <EmptyState
          icon={<CalendarIcon size={32} />}
          title="Aún no tienes citas hoy"
          action={
            <Button variant="secondary" size="md">
              Crear cita
            </Button>
          }
        >
          Comparte tu link para recibir la primera.
        </EmptyState>
        <LoadingState />
        <ErrorState
          title="Algo salió mal"
          action={
            <Button variant="secondary" size="md">
              Intentar de nuevo
            </Button>
          }
        >
          No pudimos cargar esta página.
        </ErrorState>
      </section>

      <ActionBar>
        <Button>Guardar</Button>
      </ActionBar>
      <Fab href="#nueva" label="Nueva cita" />
      <BottomNav />
    </main>
  );
}
