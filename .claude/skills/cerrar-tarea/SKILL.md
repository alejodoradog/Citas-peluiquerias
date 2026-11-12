---
name: cerrar-tarea
description: Cierra una tarea del proyecto con todos los chequeos, revisión contra la spec y actualización de docs/tareas, y deja su PR listo para que lo fusione el dueño.
---

# Cerrar tarea

1. Confirma que estás en la rama de la tarea (`hito-<fase>-<tema>`, `docs-<tema>` o `ci-<tema>`) y no en `main`.
2. Corre `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e`. Si la tarea tocó migraciones, corre también `pnpm supabase test db`. Si algo falla, corrígelo y no sigas.
3. Pide al subagente `revisor-spec` que compare lo construido con `docs/spec.md` y con la tarea, dándole la lista de archivos cambiados.
4. Si la tarea tocó datos, permisos, links o entradas de usuario, pide lo mismo a `revisor-seguridad`.
5. Resuelve los hallazgos. Si uno requiere una decisión de negocio, pregúntala.
6. Actualiza el archivo de la tarea en `docs/tareas/` con las decisiones tomadas y con lo que quede pendiente. La casilla de `docs/plan.md` se marca después, cuando la tarea se verifique en la URL desplegada.
7. Haz commit y push de la rama, sin líneas de coautoría. Si el PR no existe, ábrelo en borrador hacia `main` con el MCP de GitHub (`create_pull_request` con `draft: true`). Si `gh` está instalado, también sirve `gh pr create --draft`.
8. Di qué se hizo, qué chequeos pasaron con su resultado real y qué debe revisar el dueño del proyecto.

## PR listo

Cuando la tarea está cerrada y el CI está en verde:

1. Actualiza la descripción del PR con lo que trae y la lista de qué probar en la URL desplegada, con los IDs de las pantallas del diseño.
2. Márcalo listo para revisión. El token de GitHub no lee los chequeos: si `gh` no está instalado, pide al dueño que los confirme y que pulse "Ready for review".
3. No lo fusiones: lo fusiona la cuenta `alejodoradog`, con "Create a merge commit".
