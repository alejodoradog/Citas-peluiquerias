# Diagnóstico de rendimiento
Estado: en curso desde el 2026-11-15, en la rama `docs-rendimiento`, por el fundador con Claude Code. Esta tarea solo mide y deja un informe: no cambia código del producto.

## El problema
En `www.yapoin.com`, desde el celular y desde Chrome en el computador, al tocar algunos botones la respuesta tarda cerca de un segundo. Se nota sobre todo en el panel. Se revisa toda la plataforma.

Nadie lo había medido: el repo no tenía ninguna medición de tiempos de respuesta.

## Metas propuestas
El fundador las confirma con el informe.
- Algo cambia en la pantalla en menos de 100 ms después de cualquier toque.
- La pantalla siguiente del panel aparece en menos de 500 ms con buena red.
- Guardar termina en menos de 800 ms.

## Hipótesis (leídas en el código; cada una se confirma o se descarta midiendo)

| # | Hipótesis | Dónde está |
|---|---|---|
| H1 | **Al tocar no cambia nada en la pantalla.** Ningún botón o enlace tiene estado de "presionado", Tailwind quita el destello nativo del toque y los enlaces no muestran que están cargando. Todo el tiempo del servidor se siente como "no pasó nada". | `src/ui/button.tsx`, `src/ui/bottom-nav.tsx` |
| H2 | **Cada pantalla del panel hace de 4 a 6 esperas en fila antes de pintar:** `getClaims` en el proxy, `getUser` (un viaje a Supabase Auth), el perfil y las sedes, `barbershopNeedsSetup`, y después los datos. | `src/lib/supabase/proxy.ts`, `src/modulos/cuentas/datos/access.ts`, `src/app/(panel)/panel/ready-owner.ts` |
| H3 | **Guardar cuesta el doble:** la acción hace sus esperas de permisos y la escritura, y el `redirect()` vuelve a pintar la pantalla siguiente con todas las suyas. Son unas 9 esperas en fila. | `src/modulos/agenda/acciones/owner-appointment.ts`, `src/modulos/barberias/acciones/shop-hours.ts` |
| H4 | **El esqueleto solo aparece al instante si el enlace ya se precargó** (`partialPrefetching`). No hay ningún `loading.tsx`. En la agenda y en la reserva, el esqueleto tapa también el encabezado. | `next.config.ts`, `src/app/(panel)/panel/page.tsx` |
| H5 | **En la reserva pública, cada toque es un viaje al servidor:** el barbero, el día y cada hora. El primer "Continuar" recarga la página entera. | `src/app/[slug]/reservar/slot-picker.tsx`, `services-step.tsx` |
| H6 | **La infraestructura de prueba es la más pequeña:** el sitio usa `barberias-dev` (Nano, plan gratis) y Vercel Hobby. Puede haber arranques en frío. | `docs/operacion/configurar-barberias-dev.md` |
| H7 | **Botones de guardar sin estado de espera:** "Atendida", "No asistió", cerrar sesión, "Quitar", "Ver" en Mis citas. | `src/app/(panel)/panel/citas/[id]/appointment-actions.tsx` |
| H8 | **Peso en el celular:** `textos.ts` (105 KB) va en cada pantalla del panel, y zod y el mapa en la página pública. | `src/ui/textos.ts`, `src/ui/shop-map.tsx` |

**Descartado al leer el código:** demoras artificiales, animaciones largas, la demora de 300 ms del toque, un service worker y regiones cruzadas (las funciones y la base están ambas en el este de EE. UU.). Las políticas RLS están bien escritas.

## Cómo se mide
Tres capas, sin tocar el producto.
1. **En el navegador, sobre `www.yapoin.com`.** Por cada toque:
   - el tiempo hasta el primer cambio visible;
   - el tiempo de la petición al servidor;
   - si el enlace ya se había precargado.
2. **En Supabase (`barberias-dev`), solo lectura.** Los registros dicen cuántas llamadas hace cada toque, en qué orden y cuánto tarda cada una; `pg_stat_statements` dice cuánto de eso es la base.
3. **En local, con build de producción** (`pnpm build` y `pnpm start`). Da el piso del código sin red.

**Los toques que se miden** (unos 20):
- panel: las pestañas de la barra inferior, el día siguiente y el anterior, abrir una cita, "+", "Atendida", guardar el horario, guardar un servicio, las filas de "Más";
- reserva pública: "Reservar", "Continuar", el barbero, el día, la hora;
- links: `/c/[token]` y `/b/[token]`;
- cuentas: ingresar y registro;
- admin: la lista, la ficha y registrar pago.

**Tres condiciones por toque,** con cinco repeticiones: computador con buena red; celular simulado (red 4G lenta y procesador 4 veces más lento); y el primer toque tras 15 minutos sin uso.

## Servicios de terceros que entran en la medición
Cada servicio que participa en un toque se mide por separado, para saber cuánto pone cada uno.

| Servicio | Qué hace en un toque | Qué se revisa |
|---|---|---|
| **Vercel** | Recibe cada petición y corre el servidor (funciones en `iad1`, plan Hobby) | Por dónde entra la petición desde Colombia (`x-vercel-id`); el arranque en frío contra la función caliente; qué sale de la caché del borde; la duración de las funciones en su panel de observabilidad; Fluid Compute, la memoria y los límites de Hobby |
| **Supabase Auth** | Valida la sesión en cada pantalla y la renueva cada hora | El tiempo de `getUser` y el de la renovación del token |
| **Supabase (API y base)** | Los datos de cada pantalla | Cuántas llamadas, en qué orden y cuánto tarda cada una; el tamaño Nano de `barberias-dev` |
| **Supabase Storage** | Los logos y las fotos | El peso y el tiempo de las imágenes en la página pública y en el panel |
| **Cloudflare DNS** | Resuelve `yapoin.com` | El tiempo de resolución en la primera visita |
| **Cloudflare Turnstile** | Protege ingresar, el registro, la reserva y "Mis citas"; el botón espera su respuesta | Cuánto tarda en cargar el script y en entregar el token; cuánto tarda la verificación del lado del servidor |
| **OpenFreeMap** | Los mapas de la página pública | Si cargar el mapa frena los toques de esa página |
| **Resend** | Los correos | No participa en un toque: los correos se encolan en la base y salen después. Se comprueba que ninguna acción lo espere |

Las fuentes no dependen de nadie: `next/font` las sirve desde el mismo sitio.

## Primera medida (2026-11-15)
Desde un computador en Colombia, las páginas públicas preconstruidas (inicio, ingresar, registro, términos) responden en 350 a 400 ms. De eso, unos 220 ms son abrir la conexión con Washington (`iad1`). Lo estático no explica el segundo.

## Resultados
Pendiente.

## Causas, en orden
Pendiente.

## Plan correctivo propuesto
Pendiente. Sale del informe: una tarea por causa, con su esfuerzo, su riesgo y la mejora esperada. Cada corrección va en su propia rama `perf-<tema>`, con la medición de antes y después.
