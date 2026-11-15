# 0009 Mapa de la barbería con MapLibre y OpenFreeMap

Fecha: 2026-11-14 · Tareas: 2.4 (D-57) y 3.2 (página pública) · Estado: **propuesta**; la pidió el socio y espera la aceptación del fundador. La redactó Claude Code.

Agrega un servicio externo a la 0007, gratis y sin cuenta: los mapas de OpenFreeMap. El resto de la 0007 sigue igual. Con la aceptación, `CLAUDE.md` lo nombra junto a la infraestructura fija.

## Contexto

- **La spec pide el mapa** en la página pública ("dirección con mapa", funciones P1). El diseño D-57 también lo muestra en los datos de la barbería.
- **Hasta ahora no había servicio de mapas.** La 0007 no tenía uno, así que la decisión provisional P2 de la 2.4 dejó un recuadro rayado y un link "Ver en el mapa" a Google Maps.
- **Lo que se descartó:**
  - **Google Maps embebido** (Maps Embed API): es gratis, pero Google Cloud pide una cuenta con tarjeta y, en Colombia, un prepago de unos $100.000.
  - **mapcn con su configuración por defecto:** usa los mapas de CARTO, que para un negocio piden cuenta y llave, con tope de un millón de pedidos al mes.

## Decisión

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Librería | **MapLibre GL** (`maplibre-gl`), la misma sobre la que está hecho mapcn. Un componente propio, pequeño: `src/ui/shop-map.tsx`. |
| 2 | Mapas | **OpenFreeMap** (`tiles.openfreemap.org`, estilo `positron`): gratis y sin tope de visitas, permite uso comercial, no pide registro ni llave y no pone cookies. |
| 3 | Crédito | El de OpenStreetMap, obligatorio. MapLibre lo pone solo, plegado en su botón ⓘ. |
| 4 | Dónde se ve | En los datos de la barbería del panel (D-57) y arriba en la página pública, debajo de "Cómo llegar", como vista previa antes de reservar. Solo cuando la barbería tiene su ubicación guardada. |
| 5 | Cómo se ve | Un mapa quieto, con el pin en el color de la marca: no se arrastra ni hace zoom, para que en el celular no atrape el scroll. Carga cuando la persona baja hasta él. |
| 6 | Al tocarlo | Se abre la app de mapas de la persona:<br>- **Android:** el celular muestra sus apps de mapas (link `geo:`) o abre la predeterminada.<br>- **iPhone:** una hoja con Apple Maps, Google Maps y Waze, porque el iPhone no tiene esa lista.<br>- **Computador:** Google Maps en otra pestaña. |
| 7 | Código propio | El worker de MapLibre se sirve desde la app (`public/maplibre`), no desde un CDN. Una prueba avisa si queda distinto del que trae la versión instalada. |

## Costos y riesgos

- **Costo:** cero. OpenFreeMap vive de donaciones.
- **Si OpenFreeMap se cae o cierra:** el recuadro queda rayado, como antes, y tocarlo sigue abriendo la app de mapas. Cambiar de proveedor es cambiar una dirección (`STYLE_URL`): por ejemplo, MapTiler o Stadia, que tienen planes gratis con cuenta.
- **Privacidad (Ley 1581):** el navegador del cliente le pide los mapas a OpenFreeMap, que ve su IP, como cualquier sitio. No pone cookies ni pide datos. La política de datos (6.5, punto 5) ya lo nombra; la versión no cambia porque nadie la había aceptado todavía.
- **En el panel**, al tocar "Usar mi ubicación actual", el mapa pide las imágenes de ese punto antes de guardarlo: OpenFreeMap ve la IP del dueño cerca de esa posición, aunque no la guarde. Se acepta, porque el dueño necesita ver el punto antes de guardarlo y no se envía ningún otro dato.
- **Peso:** MapLibre pesa unos 300 KB comprimidos. Solo se descarga cuando el mapa entra en pantalla.
