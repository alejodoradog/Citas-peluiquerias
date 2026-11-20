# Plan: módulo de productos e inventario (fase 9)

Fecha: 2026-11-19. Lo pidió el socio y lo ejecuta el fundador (Manuel) con Claude Code, tarea por tarea. Este documento manda junto con `CLAUDE.md`, `docs/spec.md` y `docs/trabajo-en-paralelo.md`; si chocan, manda `CLAUDE.md`.

## 1. Qué se quiere

Un módulo para que el **dueño** del establecimiento venda sus productos (ceras, shampoo, tintes, etc.) y lleve su inventario. Lo que pidió el socio:

1. Crear ítems que identifiquen cada producto.
2. Consultarlos cuando los necesite.
3. Registrar la venta de un ítem.
4. Editar los ítems.
5. Registrar un ingreso de stock.
6. Dar de baja un ítem, o una cantidad de un ítem.
7. Ver métricas de sus productos: ventas, rotación y otros indicadores.
8. Activar o desactivar todo el módulo desde la configuración, porque muchos locales no lo necesitan.

**Fuera de alcance de esta fase** (no se construye aunque parezca fácil):
- vender productos en la página pública de reservas;
- factura electrónica DIAN: lo que se registra no es una factura;
- lector de código de barras, proveedores y órdenes de compra;
- comisiones por venta para los profesionales;
- que los profesionales vendan desde "Mi agenda";
- varias bodegas o inventario compartido entre sedes: cada sede tiene el suyo.

## 2. Decisiones que toma el fundador antes de la tarea 9.1

La spec no responde esto. **Según `CLAUDE.md`, no se inventan reglas de negocio:** el agente le pregunta a Manuel cada punto al empezar la 9.0. Si Manuel dice "toma la recomendación", la recomendación queda como decisión provisional en la ficha de la tarea.

| # | Pregunta | Recomendación |
| --- | --- | --- |
| P1 | ¿Quién usa el módulo? | Solo el dueño. Los profesionales no lo ven ni venden. |
| P2 | ¿Está en todos los planes o se cobra aparte? | En todos los planes, sin costo extra, y apagado por defecto. |
| P3 | ¿Se permite stock negativo (vender lo que el sistema dice que no hay)? | No. La venta se rechaza con "Solo quedan N". Para corregir está el "ajuste por conteo". |
| P4 | ¿El precio de costo es obligatorio? | Opcional. El margen solo se calcula para los productos que lo tienen. |
| P5 | ¿Se registra el medio de pago? | Sí, simple: efectivo, transferencia (Nequi/Bre-B), tarjeta u otro. |
| P6 | ¿La venta se asocia a un cliente o a una cita? | Cliente opcional, elegido de la lista de clientes del establecimiento. Sin cita. |
| P7 | ¿El cierre del día suma las ventas de productos? | Sí, en una línea aparte: "Productos", con su total y sin comisión. |
| P8 | ¿Cómo se corrige una venta mal registrada? | Se anula, con motivo, y deja rastro: el stock vuelve. No se edita ni se borra, igual que los pagos (5.4). |
| P9 | ¿"Dar de baja un ítem" borra el producto? | No. Lo **archiva**: sale de la lista y de la venta, y su historial se queda. Solo se borra de verdad un producto sin movimientos. |
| P10 | ¿Motivos de baja de una cantidad? | Vencido, dañado, perdido o robado, uso interno del local, y otro (con nota). |
| P11 | ¿Fotos de producto? | No en esta fase. |
| P12 | ¿Dónde se activa y dónde aparece el módulo? | El interruptor va en Más › "Productos e inventario". Con el módulo activo, esa fila de Más lleva al módulo, y la agenda tiene un acceso rápido "Registrar venta". La barra inferior no cambia. |
| P13 | ¿Qué pasa al desactivarlo? | Se oculta todo y la base rechaza escrituras nuevas, pero **no se borra nada**. Al reactivarlo, todo sigue igual. |
| P14 | ¿Alerta de stock bajo? | Sí: un "stock mínimo" opcional por producto. Los que están por debajo se marcan en la lista y en métricas. Sin correos en esta fase. |
| P15 | ¿Unidades? | Enteros: unidades, frascos, cajas. Nada de gramos ni fracciones. |
| P16 | ¿Diseño de pantallas? | No hay diseño en `docs/diseno/`. O Manuel lo hace en Claude Design y copia el `.dc.html`, o autoriza al agente a construir con los componentes de `src/ui/`, sin diseño previo. |

## 3. Reglas del proyecto que este módulo debe cumplir

Ya están en `CLAUDE.md`; aquí van aplicadas al módulo.

- **Toda tabla nueva lleva `barbershop_id` y RLS.** Un dueño nunca ve ni toca productos de otra sede. Se prueba con pgTAP: otro dueño, un profesional con sesión, anon y el super admin.
- **Dinero en pesos enteros** (`integer`, columnas que terminan en `_cop`). Las cantidades también son enteras.
- **Fechas en UTC en la base.** Los días y periodos de las métricas se cuentan en `America/Bogota`, con `src/lib/fechas`.
- **Reglas de negocio** en `src/modulos/productos/dominio/`, puras y con pruebas. Código en inglés; textos en `src/ui/textos.ts`, en un bloque propio `productos: { … }` puesto antes de `proximamente: {`.
- **El inventario no se descuadra.** El stock sale de un libro de movimientos que no se edita ni se borra. Toda escritura que cambia el stock pasa por funciones `security definer` que bloquean la fila del producto (`for update`), para que dos ventas simultáneas nunca vendan la misma última unidad.
- **Solo lectura cuando la suscripción está pausada:** las escrituras usan `private.writable_barbershop_ids()`, como el resto del panel. En pausa se puede consultar, pero no vender ni mover stock.
- **Infraestructura fija:** no se agregan servicios nuevos ni correos.
- **Forma de trabajo:**
  - una rama y un PR por tarea (`hito-9-<tema>`), en borrador desde el primer push, y listo con el CI en verde;
  - merge de `main` en la rama, nunca rebase; antes de cada push y al terminar el CI, `git fetch` y revisar conflictos y migraciones;
  - commits convencionales que terminan en `(tarea 9.N)`, sin coautoría ni marcas de Claude.
- **pgTAP de esta fase:** del 90 al 99, uno por tarea de base de datos.
- **Revisores:** `revisor-spec` en cada tarea; `revisor-seguridad` en las de base de datos y en la de ventas.

## 4. Modelo de datos (propuesta para la 9.1 a 9.3)

Nombres en inglés. Las columnas exactas las confirma el plan de cada tarea.

**`barbershops.products_enabled`** (`boolean not null default false`): el interruptor del módulo. El dueño la cambia con `grant update (products_enabled)` y la política de siempre, como `booking_interval_minutes` (tarea 7.11). `private.products_writable(barbershop_id)` es verdadera solo si el establecimiento es escribible **y** el módulo está activo; la usan todas las funciones de escritura.

**`public.products`**, el catálogo:
- `id`, `barbershop_id`;
- `name` (obligatorio, único por sede sin importar mayúsculas entre los activos), `sku` (código interno opcional, único por sede) y `category` (texto libre opcional);
- `sale_price_cop` (≥ 0), `cost_cop` (opcional, ≥ 0) y `min_stock` (≥ 0, por defecto 0);
- `stock_on_hand` (entero ≥ 0, con un `check`). **No se escribe directo:** la mantienen las funciones de movimiento;
- `archived_at` (dar de baja el ítem), `created_at` y `updated_at`.
- **Permisos:** RLS de lectura para los miembros de la sede. El dueño crea y edita nombre, sku, categoría, precios y mínimo. **Nadie escribe `stock_on_hand`** sin pasar por una función.

**`public.stock_movements`**, el libro del inventario. Solo se le agregan filas:
- `id`, `barbershop_id` y `product_id`;
- `kind`: `initial`, `restock`, `sale`, `sale_void`, `write_off` o `count_adjustment`;
- `quantity`: con signo; positivo entra y negativo sale;
- `unit_cost_cop`: en los ingresos, y actualiza el costo del producto si se da;
- `reason`: para las bajas (P10), y `note`;
- `sale_id`: para las ventas y sus anulaciones;
- `actor_user_id`, `occurred_at` y `created_at`.
- **Invariante, probada con pgTAP:** `stock_on_hand` es igual a la suma de `quantity` de sus movimientos, y nunca baja de 0.

**`public.product_sales`** y **`public.product_sale_lines`**, las ventas:
- **la venta:** `id`, `barbershop_id`, `sold_at`, `total_cop`, `payment_method` (P5), `customer_id` (opcional, de la misma sede), `note`, `created_by`, y para anularla `voided_at`, `voided_by` y `void_reason`;
- **cada línea:** `sale_id`, `barbershop_id`, `product_id`, `quantity` (> 0), `unit_price_cop` (copiado del producto al vender, como `appointment_services`) y `line_total_cop`.

**Funciones** (`security definer`, `search_path = ''`, solo `authenticated`; cada una comprueba que el dueño llega a esa sede con `private.owner_reaches` y `products_writable`):
| Función | Qué hace |
| --- | --- |
| `create_product(...)` | Crea el producto y, si trae stock inicial, el movimiento `initial`. |
| `update_product(...)` | Cambia los datos. Nunca el stock. |
| `archive_product(id)` / `restore_product(id)` | Da de baja o vuelve a activar el ítem (P9). |
| `delete_product(id)` | Solo si no tiene movimientos más allá del inicial y no tiene ventas. |
| `register_stock_entry(product, qty, unit_cost, note)` | Ingreso de stock (`restock`). |
| `write_off_stock(product, qty, reason, note)` | Baja de una cantidad. Falla con `insufficient_stock` si no alcanza. |
| `adjust_stock_by_count(product, counted, note)` | Conteo físico: registra la diferencia como `count_adjustment`. |
| `register_product_sale(barbershop, lines jsonb, payment_method, customer_id, note)` | Bloquea las filas de los productos en orden de id, revisa el stock de todas las líneas, crea la venta, las líneas y los movimientos `sale`, todo en una transacción. Devuelve el id. |
| `void_product_sale(sale_id, reason)` | Anula la venta: movimientos `sale_void` y el stock vuelve. Solo una vez. |
| `product_metrics(barbershop, from, to)` | Los agregados de la sección 6, de una sola vez. |

Todas van en la lista blanca de `02_rls.test.sql`, en orden alfabético, y los tipos se regeneran con `pnpm db:types`.

## 5. Pantallas (mobile-first, con los componentes de `src/ui/`)

Todas viven en `src/app/(panel)/panel/productos/` y solo existen si el módulo está activo. Si está apagado, cada ruta lleva a Más con un aviso.

1. **Más › "Productos e inventario":** el interruptor de activar o desactivar, con la explicación de qué pasa al apagarlo (P13). Con el módulo activo, el botón "Abrir productos".
2. **Lista de productos:** buscador por nombre o sku; filtros "Todos", "Stock bajo" y "Archivados"; cada fila con nombre, precio, stock y la marca de stock bajo. Botones "Nuevo producto" y "Registrar venta". Estados de vacío, cargando y error.
3. **Ficha del producto:** sus datos, el stock actual y los últimos movimientos con fecha, tipo, cantidad y quién. Acciones: "Editar", "Ingreso de stock", "Dar de baja unidades", "Ajustar por conteo" y "Archivar".
4. **Nuevo y editar producto:** nombre, sku, categoría, precio de venta, costo, stock mínimo y, solo al crear, stock inicial.
5. **Ingreso de stock / dar de baja / ajustar por conteo:** una hoja por acción (`sheet.tsx`), con cantidad, motivo, costo y nota según el caso.
6. **Registrar venta:**
   - el carrito: buscar un producto y agregarlo con su cantidad, que se puede cambiar o quitar; el total en vivo;
   - medio de pago y cliente opcional;
   - "Registrar venta";
   - si una línea ya no tiene stock, la base lo dice y la pantalla señala cuál.
7. **Ventas:** la lista por día, con el detalle de cada venta y "Anular venta" (pide motivo y confirmación).
8. **Métricas:** periodo de hoy, 7 días, 30 días o el mes; tarjetas e indicadores de la sección 6, y las gráficas con el componente de barras de `src/app/(admin)/admin/metricas/bar-chart.tsx` (moverlo a `src/ui/` si hace falta compartirlo).
9. **Cierre del día (si P7 = sí):** la línea "Productos" en `/panel/cierre`, con su total y su detalle, y en el CSV.

Cada pantalla nueva pasa `expectAccessible`, `expectTouchTargets` y `expectNoZoomOnFocus` en su E2E (`.claude/rules/pruebas.md`).

## 6. Métricas e indicadores (dominio puro en `src/modulos/productos/dominio/metrics.ts`)

Todo por periodo, en días de Bogotá, sin contar las ventas anuladas:
- **Ventas:** total vendido (`$`), número de ventas, unidades vendidas y ticket promedio.
- **Margen bruto:** ventas − costo de lo vendido, en pesos y en %. Solo con los productos que tienen costo; la pantalla dice cuántos no lo tienen.
- **Más vendidos:** el top 5 por unidades y por dinero.
- **Rotación:** unidades vendidas en el periodo ÷ stock promedio del periodo. El stock promedio sale del libro de movimientos, no de una foto.
- **Días de inventario:** stock actual ÷ venta diaria promedio del periodo. Si no hubo ventas, "sin ventas".
- **Stock bajo:** productos con `stock_on_hand ≤ min_stock` (y `min_stock > 0`).
- **Productos quietos:** con stock y sin ventas en el periodo.
- **Bajas:** unidades y valor dado de baja (al costo cuando existe), por motivo.
- **Valor del inventario:** stock × costo y stock × precio de venta.
- **Ventas por día y por medio de pago:** para las gráficas.

Cada fórmula lleva sus pruebas con casos a mano: periodo vacío, producto sin costo, anulaciones, una venta a las 11:30 p. m. de Bogotá y producto archivado. La función SQL `product_metrics` entrega los agregados crudos, y el dominio calcula los indicadores.

## 7. Tareas, en orden (una rama y un PR por tarea)

Cada tarea:
- **empieza en modo plan y espera la aprobación de Manuel;**
- escribe su ficha `docs/tareas/9.N-<tema>.md` con el formato de `docs/tareas/8.16-invitar-al-guardar.md` (qué hace, base de datos, decisiones provisionales numeradas, riesgos);
- suma sus pruebas humanas a `docs/pruebas-humanas-hito-9.md`;
- actualiza su fila del tablero en `docs/trabajo-en-paralelo.md`;
- termina con lint, typecheck, unitarias, **todo** pgTAP y sus E2E en verde.

| Tarea | Rama | Qué trae | pgTAP | Lista cuando |
| --- | --- | --- | --- | --- |
| **9.0** Decisiones, spec y tablero | `docs-fase-9-productos` | Las respuestas a P1–P16 en `docs/decisiones/0011-modulo-productos.md`; la spec al día (funcionalidades, pantallas, reglas de negocio y modelo de datos); "Fase 9" en `docs/plan.md` con sus casillas; las filas 9.1–9.9 en el tablero; `docs/pruebas-humanas-hito-9.md` vacío por secciones; y los diseños, si Manuel los hace. | — | La decisión 0011 está aceptada por Manuel. |
| **9.1** Interruptor y catálogo (base) | `hito-9-catalogo-db` | `products_enabled`, `products_writable`, la tabla `products` con su RLS y las funciones de producto (crear, editar, archivar, restaurar y borrar). | 90 | pgTAP prueba el aislamiento entre sedes, los permisos por columna, que `stock_on_hand` no se escribe directo, el módulo apagado, la solo lectura y los nombres repetidos. |
| **9.2** Inventario (base) | `hito-9-inventario-db` | `stock_movements`, `register_stock_entry`, `write_off_stock` y `adjust_stock_by_count`. | 91 | pgTAP prueba la invariante "stock = suma de movimientos", que nunca baja de 0, que el libro no se edita ni se borra, y la concurrencia (dos bajas a la vez sobre la última unidad: una pasa), probada a mano con dos `psql` como en la 7.6c. |
| **9.3** Ventas (base) | `hito-9-ventas-db` | `product_sales`, `product_sale_lines`, `register_product_sale`, `void_product_sale` y `product_metrics`. | 92 | pgTAP prueba la venta con varias líneas, la falta de stock en una línea (no se guarda nada), la anulación una sola vez, el precio copiado, el cliente de otra sede (rechazado) y que las métricas cuadran con un caso hecho a mano. |
| **9.4** Activar el módulo en la app | `hito-9-activar` | Más › "Productos e inventario" con el interruptor; las rutas protegidas cuando está apagado; el acceso "Registrar venta" en la agenda (P12). | — | E2E: activar, ver el módulo; desactivar, las rutas llevan a Más y los datos siguen. |
| **9.5** Catálogo en la app | `hito-9-catalogo` | Lista con búsqueda y filtros, ficha, nuevo, editar, archivar y restaurar. Dominio y validación Zod. | — | E2E: crear, buscar, editar y archivar; un nombre repetido da su mensaje. |
| **9.6** Movimientos en la app | `hito-9-movimientos` | Ingreso de stock, baja con motivo, ajuste por conteo y el historial en la ficha. | — | E2E: entra stock, sale stock, la baja de más se rechaza con "Solo quedan N" y el historial lo muestra. |
| **9.7** Registrar y anular ventas | `hito-9-ventas` | El carrito, el medio de pago, el cliente opcional, la lista de ventas y la anulación. | — | E2E: vender dos productos y ver bajar su stock; anular y verlo volver; vender más de lo que hay da el mensaje. Pasa `revisor-seguridad`. |
| **9.8** Métricas | `hito-9-metricas` | El dominio de la sección 6, la pantalla y las gráficas. | — | Unitarias de cada fórmula. E2E: con ventas sembradas, las tarjetas muestran los números esperados. |
| **9.9** Cierre del día y cierre de fase | `hito-9-cierre` | La línea "Productos" en el cierre del día y su CSV (si P7). `revisor-spec` sobre toda la fase y las pruebas humanas completas. | 93 (si toca el cierre) | Las casillas de la fase 9 en `docs/plan.md` se marcan solo después de verlas en `www.yapoin.com`. |

**El orden importa:** la 9.1, la 9.2 y la 9.3 son la base y van en serie. Las demás se apoyan en ellas. La 9.5 y la 9.6 pueden ir en paralelo en worktrees separados, pero las migraciones se fusionan en el orden de la tabla. Si `main` trae una migración con número mayor que la tuya, renombra la tuya con la hora UTC actual antes de fusionar.

## 8. Riesgos y cómo se cubren

- **Descuadre del inventario:** el libro de movimientos es la fuente de verdad; las funciones bloquean filas; pgTAP prueba la invariante; nada escribe el stock directo.
- **Ventas simultáneas de la última unidad:** el bloqueo en orden de id evita interbloqueos entre dos carritos con los mismos productos.
- **Datos de otra sede:** RLS más `owner_reaches` en cada función. El cliente de la venta debe ser de la misma sede.
- **Rendimiento de las métricas:** índices por `(barbershop_id, occurred_at)` en `stock_movements` y por `(barbershop_id, sold_at)` en `product_sales`. Una sola llamada por pantalla.
- **Confusión con la contabilidad:** la pantalla de ventas dice que no es una factura electrónica.
- **El módulo apagado con datos:** no se borra nada; las escrituras se rechazan en la base, no solo en la pantalla.

## 9. El prompt para empezar

Manuel lo pega en una sesión nueva de Claude Code, en el repo actualizado (`git pull` en `main`):

> Vamos a construir el módulo de productos e inventario de Yapoin (fase 9). Lee completos, en este orden: `CLAUDE.md`, `docs/plan-modulo-productos.md`, `docs/trabajo-en-paralelo.md`, `docs/spec.md` y `.claude/rules/`. Ejecuta el plan de principio a fin, tarea por tarea, en el orden de su sección 7 (9.0 → 9.9). Empieza por la 9.0: hazme las preguntas P1 a P16 de la sección 2, de a pocas y con la recomendación de cada una. Con mis respuestas escribe la decisión 0011 y actualiza la spec, el plan, el tablero y las pruebas humanas. En cada tarea: modo plan primero y espera mi aprobación antes de editar; una rama y un PR por tarea, en borrador desde el primer push; pruebas antes del código; lint, typecheck, unitarias, todo pgTAP y las E2E de la tarea en verde; `revisor-spec` siempre y `revisor-seguridad` en la 9.1, 9.2, 9.3 y 9.7; la ficha `docs/tareas/9.N-<tema>.md`, sus pruebas humanas y su fila del tablero en el mismo PR. Antes de cada push y al terminar el CI, haz `git fetch`, mete `main` en la rama (merge, no rebase) y resuelve conflictos y números de migración. No pases a la siguiente tarea hasta que el PR anterior esté listo con el CI en verde, y avísame para fusionarlo. Si algo no lo responde la spec ni la decisión 0011, pregúntame: no inventes reglas de negocio. Sin coautoría ni marcas de Claude en commits ni PR.
