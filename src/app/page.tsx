import { textos } from "@/ui/textos";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-3xl font-semibold">{textos.inicio.titulo}</h1>
      <p className="text-lg">{textos.inicio.descripcion}</p>
    </main>
  );
}
