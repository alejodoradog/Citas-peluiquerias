---
name: cerrar-tarea
description: Cierra una tarea del proyecto con todos los chequeos, revisión contra la spec, actualización de docs/tareas y apertura del PR.
---

# Cerrar tarea

1. Confirma que estás en la rama de la tarea y no en `main`.
2. Corre `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e`. Si la tarea tocó migraciones, corre también `pnpm supabase test db`. Si algo falla, corrígelo y no sigas.
3. Pide al subagente `revisor-spec` que compare lo construido con `docs/spec.md` y con la tarea, dándole la lista de archivos cambiados.
4. Si la tarea tocó datos, permisos, links o entradas de usuario, pide lo mismo a `revisor-seguridad`.
5. Resuelve los hallazgos. Si uno requiere una decisión de negocio, pregúntala.
6. Actualiza el archivo de la tarea en `docs/tareas/` con las decisiones tomadas y con lo que quede pendiente, y marca sus casillas en `docs/plan.md`, solo las comprobadas. Hazlo en esta misma rama, para que lleguen a `main` con la tarea.
7. Haz commit y push de la rama, y abre el PR con el MCP de GitHub. Si no está disponible, entrega el enlace para abrirlo a mano.
8. Di qué se hizo, qué chequeos pasaron con su resultado real y qué debe revisar el dueño del proyecto.

No fusiones el PR: eso lo decide el dueño del proyecto.
