# Diagnóstico de rendimiento
Estado: diagnóstico terminado el 2026-11-15, en la rama `docs-rendimiento`, por el fundador con Claude Code. Esta tarea solo midió y dejó este informe: no cambió código del producto. Falta que el fundador decida qué correcciones se hacen.

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

## Resultados (2026-11-15)
Medido en `www.yapoin.com` con una barbería de prueba, desde un computador en Colombia con buena red, después del #79 y el #80. Los tiempos van en milisegundos.

### Por tipo de toque

| Tipo de toque | Ejemplos | Algo cambia en la pantalla | Aparece el contenido (mediana / peor) | Muestras |
|---|---|---|---|---|
| Panel: ir a otra pantalla | barra inferior, filas de "Más", "+", abrir un cliente, volver | a los 4–19 ms (esqueleto) | 411 / 834 | 33 |
| Panel: la misma pantalla con otro filtro | día siguiente y anterior, Día o Semana, filtro de barbero | **nada hasta el contenido** | 450 / 757 | 9 |
| Panel: guardar | horario, servicio | a los 3–12 ms (el botón pasa a "en espera") | **841 a 1.106** | 3 |
| Reserva pública: cada paso | barbero, día, hora, "Continuar" | **nada hasta el contenido** | 320–490 / 937 | 5 por paso |
| Reserva pública, celular simulado | los mismos | **nada hasta el contenido** | 390–635 / 691 | 5 por paso |

- El celular simulado es un Pixel 7 con red 4G lenta (150 ms de latencia) y procesador 4 veces más lento. Agrega de 40 a 100 ms por toque.
- "Reservar" es el único toque de la reserva que se siente inmediato: muestra el esqueleto a los 30 ms, aunque su contenido tarda 320 ms como los demás.
- "Continuar" en los servicios recarga la página entera (5 de 5). Es el paso más lento de la reserva.

### A dónde se va el tiempo de una pantalla del panel (411 ms)

| Tramo | ms | De dónde sale el número |
|---|---|---|
| El viaje del navegador a Vercel y la respuesta hasta el primer byte | ~145 | Navegador. De eso, 35 a 65 ms son el viaje de red |
| Cuatro esperas en fila a Supabase | ~175 | Registros de Supabase (mediana 174, percentil 75 de 281) |
| Pintar en el servidor, enviar y pintar en el navegador | ~90 | El resto |

Las cuatro esperas son, en orden:
1. `getUser`, un viaje a Supabase Auth;
2. el perfil y las sedes, que desde el #79 salen juntos;
3. `barbershopNeedsSetup`;
4. los datos de la pantalla, en paralelo.

Cada espera dura unos 45 ms: la mitad es Supabase procesando y la otra mitad el viaje entre Vercel y Supabase. La base tarda de 1 a 5 ms por consulta.

El #79 del socio ya quitó una espera: antes eran 266 ms de mediana y ahora son 174.

### A dónde se va el tiempo al guardar (cerca de 1 s)
De los tres guardados del horario, vistos desde Supabase (de 590 a 760 ms) y desde el navegador (de 841 a 1.106 ms):

| Tramo | ms |
|---|---|
| Permisos antes de escribir (tres esperas) | ~125 |
| La escritura (`set_barbershop_hours`) | 25 a 105 |
| Tiempo muerto después de escribir y antes de empezar a pintar | 155 a 395 |
| Pintar la pantalla siguiente (las mismas cuatro esperas, con los permisos leídos otra vez) | ~175 |
| Red, envío y navegador | 150 a 250 |

El tiempo muerto no es de Supabase. Por el código, lo más probable es la invalidación de la caché (cinco `revalidatePath` y la etiqueta del perfil público) y el `redirect`. Esto es una lectura, no una medida: hay que confirmarlo con un cronómetro en una vista previa.

### Arranque en frío y picos
**Después de unos minutos sin uso, abrir el panel tardó 2,8 s.** En caliente, la misma carga tardó 0,7 s.

| Tramo de la carga en frío | ms | De dónde sale el número |
|---|---|---|
| Resolver el nombre y abrir la conexión | ~390 | Navegador |
| Primer byte (la parte fija de la página) | ~100 | Navegador |
| Arrancar la función de Vercel | ~1.100 | Inferido: lo que el navegador esperó los datos (2.291) menos lo que se ve en Supabase |
| Las esperas a Supabase, en frío | ~1.190 | Registros de Supabase |

- **En frío, Supabase responde 10 veces más lento:** `getUser` pasó de 20 a 441 ms, y el perfil y las sedes de 20 a unos 290 ms. Las llamadas siguientes ya salen normales.
- **El sitio se enfría rápido.** Para Supabase, el rato sin uso de esta prueba fue de solo 4 minutos, no de 15: algo renovó la sesión en el intermedio. Con pocas barberías, casi toda visita empieza en frío.
- **Cerca de 1 de cada 10 toques tarda más aun en uso continuo:** en 25 minutos, 19 peticiones a Supabase pasaron de 300 ms (de 500 a 800 ms la mayoría). En el navegador se vieron como pantallas de 757, 834 y 1.549 ms, y una carga completa de 1,6 s.
- **Renovar la sesión:** de 680 a 741 ms, una vez por hora. En la muestra se renovó dos veces a la vez.

### Los servicios de terceros

| Servicio | Resultado |
|---|---|
| **Vercel** | Con la función caliente responde parejo: unos 145 ms hasta el primer byte. En frío, arrancar la función cuesta cerca de 1,1 s (inferido). El viaje de red desde Colombia es de 35 a 65 ms. Falta revisar su panel (la cuenta es del socio): los arranques en frío y si Fluid Compute está activo |
| **Supabase Auth** | `getUser` cuesta una espera por pantalla (20 a 30 ms de proceso). Renovar el token es lo más lento que hay: 0,7 s. `getClaims` del proxy valida en local y no va a la red |
| **Supabase (API y base)** | En caliente, de 14 a 26 ms por llamada; la base, de 1 a 5 ms. En frío, las primeras llamadas tardan de 270 a 440 ms, y en uso continuo hay picos de 0,5 a 0,8 s. El proyecto es Nano, el tamaño más pequeño |
| **Supabase Storage** | Sin medir |
| **Cloudflare DNS** | De 190 a 220 ms la primera vez; después queda en caché |
| **Cloudflare Turnstile** | En "Mis citas", el botón estuvo apagado 5,4 s, hasta que llegó el token. Puede estar inflado, porque la ventana de la prueba estaba tapada. Hay que verlo en un celular |
| **OpenFreeMap** | Sin medir. Solo carga cuando el mapa entra en la pantalla |
| **Resend** | No participa en ningún toque |

**Peso:** el panel carga 16 archivos de JavaScript, 755 KB sin comprimir. La primera carga completa tarda de 1,1 a 1,4 s en el computador, y la de las páginas públicas 2,2 s en el celular simulado. No es la causa de los toques lentos.

### Contra las metas

| Meta | Hoy |
|---|---|
| Algo cambia en menos de 100 ms | Se cumple al cambiar de pantalla y al guardar en el panel. **No se cumple** en los filtros de la agenda ni en ningún paso de la reserva |
| La pantalla siguiente en menos de 500 ms | Se cumple en la mediana (411 ms). **No se cumple** en frío (2,8 s) ni en cerca de 1 de cada 10 toques |
| Guardar en menos de 800 ms | **No se cumple:** de 841 a 1.106 ms |

### Lo que no se midió
- **Un celular real con datos móviles.** El celular simulado da una idea; falta la prueba del fundador.
- **El panel de Vercel:** la duración de las funciones y los arranques en frío vistos desde adentro.
- **"Atendida", "No asistió" y cancelar,** porque cambian datos. Por el código siguen el patrón de guardar.
- **El admin de plataforma.** Usa el mismo patrón de permisos que el panel.
- **El build de producción en local.** No hizo falta: los tramos medidos suman el total con un margen menor al 10 %.

## Veredicto de cada hipótesis

| # | Hipótesis | Veredicto |
|---|---|---|
| H1 | Al tocar no cambia nada | **Confirmada** en los filtros de la agenda y en toda la reserva. En los cambios de pantalla del panel el esqueleto sí aparece al instante; lo que falta ahí es el estado de "presionado" |
| H2 | Esperas en fila por pantalla | **Confirmada:** cuatro esperas, 174 ms |
| H3 | Guardar cuesta el doble | **Confirmada:** cerca de 1 s, con los permisos leídos dos veces y un tiempo muerto de 155 a 395 ms |
| H4 | El esqueleto depende de la precarga | **Confirmada en parte:** falla cuando solo cambia el filtro, y justo después de guardar (el esqueleto llegó a los 167 ms) |
| H5 | La reserva va al servidor en cada toque | **Confirmada** |
| H6 | Infraestructura pequeña | **Confirmada:** 2,8 s en frío después de unos minutos sin uso, picos de 0,5 a 0,8 s en cerca de 1 de cada 10 toques y renovaciones de 0,7 s |
| H7 | Botones sin estado de espera | Sin medir (cambian datos). Sigue en pie por el código |
| H8 | Peso | **Menor:** afecta la primera carga, no los toques |

**Descartado con medidas:** el proxy (no va a la red), la base de datos (de 1 a 5 ms por consulta), las políticas RLS y las regiones.

## Causas, en orden
1. **El sitio se enfría:** 2,8 s en el primer toque después de unos minutos sin uso, y cerca de 1 de cada 10 toques lento en uso continuo. Con pocas barberías, es lo que más se va a sentir.
2. **Toques sin ninguna respuesta visible** durante 375 a 757 ms: los filtros de la agenda y todos los pasos de la reserva.
3. **Guardar tarda cerca de 1 s:** repite los permisos y pierde de 155 a 395 ms después de escribir.
4. **Cuatro esperas en fila en cada pantalla del panel:** 174 de los 411 ms. En frío, cada espera se multiplica.
5. **La reserva va al servidor en cada toque,** hasta para resaltar una hora.
6. **Peso del JavaScript:** solo en la primera carga.

## Plan correctivo propuesto
Una rama y un PR por tarea, cada uno con la medición de antes y después. El fundador decide cuáles se hacen y en qué orden.

| # | Tarea (rama) | Qué cambia | Mejora esperada | Riesgo |
|---|---|---|---|---|
| 1 | `perf-respuesta-inmediata` | Estado de "presionado" en botones, enlaces, filas y chips. Indicador de carga en los enlaces que no cambian de pantalla (día, vista, filtro, pasos de la reserva). El encabezado de la agenda y de la reserva queda fuera del esqueleto. Estado de espera en los botones de H7 | Respuesta visible en menos de 100 ms en todos los toques. Hoy son de 375 a 757 ms sin nada | Bajo |
| 2 | `perf-menos-esperas` | `setup_completed_at` viene en la misma lectura de las sedes. Las consultas del detalle de la cita salen en paralelo | Una espera menos: unos 45 ms en cada pantalla y en cada guardado | Bajo |
| 3 | `perf-guardar` | Primero, un cronómetro en una vista previa para ubicar el tiempo muerto. Después: no repetir los permisos entre la acción y la pantalla siguiente, y una sola invalidación de caché | Guardar pasa de cerca de 1.000 ms a 600 o 700 | Medio |
| 4 | `perf-reserva-cliente` | El día y la hora se eligen en el cliente, como ya hace el panel (`slot-chooser.tsx`). "Continuar" deja de recargar la página | Elegir día y hora pasa de 350–450 ms a inmediato. "Continuar" pasa de 480–635 ms a unos 350 | Medio |
| 5 | `perf-sesion-local` | Validar la sesión con `getClaims` (firma local) y no con `getUser` | Otra espera menos: unos 45 ms en cada pantalla y en cada guardado | **Alto, es seguridad:** una sesión revocada seguiría valiendo hasta que venza el token (1 hora). Decisión del fundador |
| 6 | Arranque en frío | Tres pasos. Primero, mirar en el panel de Vercel los arranques en frío y si Fluid Compute está activo. Segundo, decidir si se mantiene caliente el sitio con una visita automática cada pocos minutos (con `pg_cron` y `pg_net`, que ya se usan). Tercero, volver a medir en producción (Micro, plan Pro, tarea 6.4) | El primer toque pasaría de 2,8 s a menos de 1 s | Decisión del fundador y del socio |
| 7 | `perf-peso` | Partir `textos.ts` por zona; sacar zod del cliente donde se pueda | Primera carga más corta en celulares | Bajo |

Con las tareas 1 a 3, el panel quedaría con respuesta visible inmediata en todos los toques, las pantallas en unos 365 ms y guardar en unos 650 ms. Con la 5, las pantallas bajarían a unos 320 ms.
