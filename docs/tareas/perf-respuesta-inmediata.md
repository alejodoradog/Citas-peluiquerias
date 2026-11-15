# Respuesta inmediata en todos los toques
Estado: construida el 2026-11-15 en la rama `perf-respuesta-inmediata`, por el fundador con Claude Code. Son las correcciones 1 a 4 del diagnóstico (`docs/tareas/rendimiento-diagnostico.md`), en un solo PR por decisión del fundador. Falta que pase el CI y volver a medir en el sitio desplegado.

La prioridad del fundador: que todo toque muestre una respuesta al instante.

## Qué cambia

### 1. Todo toque responde al instante
- **Los enlaces quedan "en espera" desde el toque.** Un solo escucha para toda la aplicación (`src/ui/tap-feedback.tsx`, montado en el layout raíz) marca con `data-pending` el enlace que se tocó, hasta que cambia la dirección. `globals.css` lo muestra con un pulso suave.
  - Cubre lo que antes no mostraba nada: cambiar de día, de vista o de barbero en la agenda, y los pasos de la reserva.
  - Cubre también los formularios de búsqueda (clientes, admin): marca su botón.
  - No marca lo que no cambia de pantalla: descargas, enlaces a otro sitio o a otra pestaña, y la pantalla que ya está abierta.
  - Si la pantalla no llega, la marca se quita sola a los 8 s.
- **Estado de "presionado":** todo enlace y todo botón se atenúa mientras el dedo está encima.
- **Vuelve el destello del toque del celular,** que Tailwind quitaba, en el color de la marca.
- **Los botones que guardaban sin avisar ahora muestran la espera** y no se pueden enviar dos veces (`src/ui/pending-button.tsx`):
  - "Atendida" y "No asistió";
  - "Cerrar sesión";
  - "Quitar" un bloqueo en el link del barbero;
  - "Ver" en Mis citas;
  - el selector de comisión del cierre;
  - "Guardar" un barbero en el asistente.
- Con movimiento reducido no hay pulso: lo que espera queda atenuado.

### 2. Una espera menos a Supabase en cada pantalla del panel
- **La marca del asistente viene con el acceso.** `getCurrentAccess` trae `setup_completed_at` en la misma lectura de las sedes y lo expone como `barbershop.needsSetup`. Se borró `barbershopNeedsSetup`, que hacía una consulta propia.
- **Consultas en paralelo** donde una no dependía de la otra: el detalle de la cita, reprogramar y el link del barbero.

| Pantalla | Esperas en fila, antes | Ahora |
|---|---|---|
| Pantallas livianas y agenda | 4 | 3 |
| Detalle de la cita | 6 | 4 |
| Reprogramar | 6 | 4 |

### 3. Guardar
- **Una espera menos en la acción y otra en la pantalla siguiente,** por el punto anterior.
- **Se encontró de dónde sale el tiempo muerto** (de 155 a 395 ms en el diagnóstico). Después de una acción con `redirect()`, Next 16.4 no pinta la pantalla siguiente en la misma petición: hace una petición nueva al propio sitio, que vuelve a pasar por Vercel y por el proxy y puede caer en una función fría. Por eso los permisos se leen dos veces, y no hay forma segura de compartirlos entre las dos peticiones.
- **Se quitaron cinco invalidaciones de caché que no hacían nada:** sus patrones no coincidían con ninguna página. Las que refrescan el perfil público siguen todas.
- **Guardar baja unos 90 ms, no los 300 a 400 que estimó el diagnóstico.** La corrección de fondo queda propuesta abajo.

### 4. La reserva elige el día y la hora sin ir al servidor
- **El día, la hora y "Ir al próximo día libre" ya no hacen ninguna petición,** ni al reservar ni al cambiar una cita. Son botones con `aria-pressed` y la pantalla cambia al instante.
- **El servidor sigue calculando la disponibilidad** con el mismo motor. Manda una sola vez las horas libres de los 31 días (unos 10 KB), y el navegador solo las muestra.
- **Al navegador solo llegan fechas y horas libres.** No viajan rangos ocupados, ni qué barbero atiende cada hora, ni datos de clientes.
- **La hora se sigue validando al confirmar,** en la base, igual que antes.
- **El primer "Continuar"** (después de los servicios) ya no recarga la página entera y su botón muestra la espera. Sin JavaScript sigue funcionando como un formulario normal.
- **Siguen yendo al servidor:** elegir el barbero y el "Continuar" hacia los datos. Ahora se marcan "en espera" como cualquier enlace.

## Lo que cambia para quien usa
- **La dirección ya no cambia al tocar un día o una hora.** Si la persona recarga la página en ese paso, la selección vuelve a hoy. "Atrás" desde los datos sí conserva el día y la hora.

## Pruebas
- **Unitarias:** 1.501, todas en verde. Nuevas:
  - `tap-feedback` (11): qué enlaces y formularios se marcan, y cuándo se quita la marca;
  - `pending-button`, `appointment-actions`, `sign-out-button`, `commission-form` y `barber-form`: cada control muestra la espera y no se envía dos veces;
  - `time-chooser`, `reschedule-chooser`, `slot-days` y `services-step` (15): el día y la hora sin navegar, el estado inicial desde la dirección, un día sin horas;
  - `access` (4 casos nuevos) y la acción de citas: la marca del asistente llega sin consulta propia y un dueño sin asistente no escribe nada.
- **E2E, ajustadas porque los chips pasaron de enlaces a botones:** `helpers/reserva.ts`, `reservar.spec.ts`, `gestionar-cita.spec.ts` y `fidelidad.spec.ts`. No se corrieron en local; las corre el CI.
- **Lint y typecheck:** en verde.

## Archivos del socio que toca
- La 4.4 (link del barbero): `src/app/b/[token]/page.tsx` y `day-list.tsx`.
- La 4.6 (cierre): `commission-form.tsx` y la acción `day-close.ts`.
- El acceso del panel, que el socio cambió en el #79: `src/modulos/cuentas/datos/access.ts`.

## Falta
- **Volver a medir en `www.yapoin.com`** con la misma matriz del diagnóstico, cuando se fusione.
- **El arranque en frío (corrección 6 del diagnóstico)** no se toca aquí: sigue siendo la causa número uno y es decisión del fundador y del socio.

## Propuesto para después
1. **Guardar sin redirigir** en las pantallas que vuelven a sí mismas (horario, festivos, link, cierre): la acción devuelve "guardado" y Next vuelve a pintar en la misma petición, sin el salto de red ni el proxy. Es lo que más bajaría el tiempo de guardar. Cambia cuatro formularios y sus pruebas.
2. **`refresh()` en vez de `revalidatePath`** en las acciones que solo afectan al panel: hoy cualquier guardado hace que el navegador descarte todas las pantallas precargadas. Hay que demostrarlo con las pruebas de punta a punta.
3. **Que recargar conserve el día y la hora elegidos** en la reserva, si el fundador lo quiere.
