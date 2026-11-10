import { notFound } from "next/navigation";
import { ActionBar } from "@/ui/action-bar";
import { Avatar } from "@/ui/avatar";
import { BottomNav } from "@/ui/bottom-nav";
import { BrandHeader } from "@/ui/brand";
import { Button, ButtonLink } from "@/ui/button";
import { Card } from "@/ui/card";
import { Checkbox } from "@/ui/checkbox";
import { Chip } from "@/ui/chip";
import { CopyButton } from "@/ui/copy-button";
import { Fab } from "@/ui/fab";
import { Field } from "@/ui/field";
import { CalendarIcon, EditIcon, ImageIcon, PlusIcon } from "@/ui/icons";
import { List, ListRow } from "@/ui/list";
import { Notice } from "@/ui/notice";
import { QrCode, qrMatrix } from "@/ui/qr-code";
import { QrDownloadButton } from "@/ui/qr-download-button";
import { SelectField } from "@/ui/select-field";
import { ShareButton } from "@/ui/share-button";
import { EmptyState, ErrorState, LoadingState } from "@/ui/states";
import { Steps } from "@/ui/steps";
import { Switch } from "@/ui/switch";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";
import { TopBar, TopBarAction } from "@/ui/top-bar";
import { SheetSample } from "./sheet-sample.dev";

const SAMPLE_LINK = "https://ejemplo.com/barberia-la-esquina";

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
          {textos.cuentas.salir}
        </Button>
        <Button disabled>{textos.cuentas.nuevaClave.enviando}</Button>
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
        <Checkbox
          label="Yo también atiendo"
          description="Tu agenda aparece junto a la de los demás."
          name="atiendo"
        />
        <div className="flex items-center gap-1">
          <Checkbox
            label="Ofrecer Barba"
            name="ofrecer-barba"
            size="lg"
            hideLabel
            defaultChecked
          />
          <span className="text-body font-bold">Barba</span>
        </div>
        <Field
          label="Precio"
          name="precio"
          prefix="$"
          inputMode="numeric"
          defaultValue="25.000"
        />
        <SelectField
          label="Duración"
          name="duracion"
          defaultValue="40"
          help="La duración va de 5 a 240 minutos, de 5 en 5."
          options={[
            { value: "30", label: "30 min" },
            { value: "40", label: "40 min" },
            { value: "45", label: "45 min" },
          ]}
        />
        <SelectField
          label="Duración con error"
          name="duracion-error"
          error="Elige una duración."
          options={[{ value: "", label: "Elige" }]}
        />
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
        <List>
          <ListRow
            href="#mario"
            title="Mario Gómez"
            badge={<Chip tone="brand">Tú</Chip>}
            subtitle="Horario de la barbería · 4 servicios"
            icon={<Avatar name="Mario Gómez" size="md" />}
          />
          <ListRow
            href="#kevin"
            title="Kevin"
            subtitle="Horario propio · link activo"
            icon={<Avatar name="Kevin" size="md" />}
          />
        </List>
        <div className="flex items-center gap-3.5">
          <Avatar name="Andrés Ruiz" size="lg" />
          <Button variant="secondary" size="sm" block={false}>
            <ImageIcon size={18} />
            Subir foto
          </Button>
        </div>
        <Card>
          <p className="text-muted text-sm">
            Tarjeta base: fondo blanco, borde Línea, radio 16 px.
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section">Barras superiores y hoja</h2>
        <div className="rounded-card border-line border bg-white">
          <TopBar title="Tus servicios" subtitle="Paso 2 de 3" />
          <div className="px-5 pb-4">
            <Steps current={2} total={3} announce={false} />
          </div>
        </div>
        <div className="rounded-card border-line border bg-white">
          <TopBar
            title="Servicios"
            back={{ href: "#mas", label: textos.ui.volver }}
            action={
              <TopBarAction
                href="#agregar"
                label="Agregar servicio"
                icon={<PlusIcon size={24} />}
              />
            }
          />
        </div>
        <div className="rounded-card border-line border bg-white">
          <TopBar
            title="Agregar barbero"
            close={{ href: "#barberos", label: textos.ui.cerrar }}
          />
        </div>
        <SheetSample />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section">Compartir el link</h2>
        <Card>
          <span className="text-help text-muted">Link de reservas</span>
          <strong className="text-lg break-all">{SAMPLE_LINK}</strong>
          <div className="grid grid-cols-2 items-start gap-2.5">
            <CopyButton
              text={SAMPLE_LINK}
              label="Copiar"
              copiedLabel="Link copiado"
            />
            <ShareButton
              url={SAMPLE_LINK}
              title="Barbería La Esquina"
              text="Reserva tu cita aquí"
              label="Compartir"
            />
          </div>
        </Card>
        <div className="self-center">
          <QrCode value={SAMPLE_LINK} label="Código QR del link de reservas" />
        </div>
        <QrDownloadButton
          matrix={qrMatrix(SAMPLE_LINK)}
          fileName="qr-barberia-la-esquina.png"
          label="Descargar QR para imprimir"
        />
        <Button variant="text" size="md">
          <EditIcon size={18} />
          Editar texto
        </Button>
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
      <Fab href="#nueva" label={textos.ui.nuevaCita} />
      <BottomNav />
    </main>
  );
}
