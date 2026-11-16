import { routes } from "@/lib/routes";
import { FlowShell } from "@/ui/flow-shell";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";

// What D-54 shows while it loads: its bar, so the owner can close it, and
// grey blocks where the form goes.
export function EditorLoading({ title }: { title: string }) {
  return (
    <FlowShell
      header={
        <TopBar
          title={title}
          titleAs="h1"
          close={{ href: routes.panelBarbers, label: textos.ui.cerrar }}
        />
      }
    >
      <LoadingState label={textos.barberos.cargando} />
    </FlowShell>
  );
}
