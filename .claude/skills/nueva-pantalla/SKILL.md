---
name: nueva-pantalla
description: Crea una pantalla mobile-first con estados de carga, vacío y error, y su prueba. Úsala para cualquier pantalla nueva en src/app.
---

# Nueva pantalla

1. Confirma en `docs/spec.md` y en la tarea qué debe hacer la pantalla. Si no lo responden, pregunta; no inventes reglas de negocio.
2. Lee la guía de Next.js que aplique en `node_modules/next/dist/docs/`, porque esta versión puede diferir de lo que recuerdas.
3. Usa la skill `frontend-design` para que la pantalla no se vea genérica.
4. Escribe primero la prueba de Playwright en `tests/e2e` y mírala fallar. Corre en viewport de celular.
5. Construye la pantalla:
   - Diseño para celular primero.
   - Estados de carga, vacío y error, además del normal.
   - Textos solo desde `src/ui/textos.ts`, en español de Colombia.
   - Fechas y horas con `src/lib/fechas`.
   - Reglas de negocio en `src/modulos/*/dominio`, nunca dentro de la pantalla.
6. Revisa la accesibilidad básica: HTML semántico, etiquetas, foco visible y contraste.
7. Corre `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e`.
