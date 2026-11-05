# Datos de prueba

`supabase/seed.sql` llena la base local con dos barberías ficticias. Se carga solo en tu computador, cada vez que corres:

```bash
pnpm supabase db reset
```

Nunca se carga en Supabase de la nube. Las contraseñas de abajo son públicas a propósito: sirven solo para la base local.

**Importante:** el seed crea un super admin con contraseña pública. Nunca lo corras contra un proyecto de la nube. Eso incluye `db push` con `--include-seed`, `db reset` con `--linked` o `--db-url`, y `psql` con una URL remota. Como segunda barrera, el seed se niega a correr si la base ya tiene alguna cuenta o barbería, como ocurre en cualquier proyecto en uso. Esa barrera no protege un proyecto de la nube recién creado y vacío.

## Cuentas

Todas usan la contraseña `barberia-local-1`. Se entra por `http://localhost:3000/ingresar`.

| Correo | Quién es | Llega a |
| --- | --- | --- |
| `carlos@barberias.test` | Carlos Pérez, dueño de La Barbería del Barrio | `/panel` |
| `jose@barberias.test` | José Rodríguez, dueño de Barbería Don José | `/panel` |
| `admin@barberias.test` | Super admin de la plataforma | `/admin` |

Los correos que envía Supabase local (por ejemplo, la recuperación de contraseña) llegan a Mailpit, en `http://127.0.0.1:44324`.

## Qué trae cada barbería

| | La Barbería del Barrio | Barbería Don José |
| --- | --- | --- |
| Link | `la-barberia-del-barrio` | `barberia-don-jose` |
| Ciudad | Chapinero, Bogotá | Laureles, Medellín |
| Suscripción | Prueba gratis de 20 días desde el `db reset` | Activa, plan Básico, con un pago por Nequi registrado |
| Horario | Lunes a sábado, 9:00 a 13:00 y 14:00 a 19:00 | Lunes a sábado, 8:00 a 18:00 |
| Barberos | Carlos (el dueño, que también corta) y Andrés | José y Mateo (Mateo recibe avisos por correo) |
| Servicios | Corte, barba, corte + barba, cejas y corte niños | Los mismos, con otros precios |
| Clientes | 5, entre ellos Juan Gómez, con 2 inasistencias | 3, entre ellos Camilo Ochoa, solo con nombre porque su única cita es manual |
| Bloqueos | Andrés tiene una diligencia el siguiente día hábil, de 15:00 a 16:00 | Toda la barbería cierra dentro de una semana por capacitación |
| Abono | Nequi | — |

## Citas

Las fechas se calculan desde el día del `db reset`, en hora de Colombia, y saltan los domingos porque las dos barberías cierran ese día. Así siempre hay citas para "hoy" y "mañana".

- **La Barbería del Barrio:** dos días con citas pasadas (atendidas y dos inasistencias de Juan), tres citas hoy (una cancelada por el cliente) y dos mañana.
- **Barbería Don José:** una cita atendida ayer, dos hoy (una cancelada por la barbería) y una mañana.

## Links privados de los barberos

Los tokens son conocidos para poder probar "Mi agenda" cuando exista (tarea 4.4). En la base solo se guarda su hash, como en producción.

| Barbero | Token |
| --- | --- |
| Carlos | `demo-barbero-carlos` |
| Andrés | `demo-barbero-andres` |
| José | `demo-barbero-jose` |
| Mateo | `demo-barbero-mateo` |
