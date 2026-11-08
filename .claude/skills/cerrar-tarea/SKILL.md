---
name: cerrar-tarea
description: Cierra una tarea del proyecto con todos los chequeos, revisión contra la spec y actualización de docs/tareas; al cerrar un hito, deja listo su PR.
---

# Cerrar tarea

1. Confirma que estás en la rama `desarrollo` y no en `main`.
2. Corre `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e`. Si la tarea tocó migraciones, corre también `pnpm supabase test db`. Si algo falla, corrígelo y no sigas.
3. Pide al subagente `revisor-spec` que compare lo construido con `docs/spec.md` y con la tarea, dándole la lista de archivos cambiados.
4. Si la tarea tocó datos, permisos, links o entradas de usuario, pide lo mismo a `revisor-seguridad`.
5. Resuelve los hallazgos. Si uno requiere una decisión de negocio, pregúntala.
6. Actualiza el archivo de la tarea en `docs/tareas/` con las decisiones tomadas y con lo que quede pendiente, y marca sus casillas en `docs/plan.md`, solo las comprobadas.
7. Haz commit y push de `desarrollo`, sin líneas de coautoría. Si el PR del hito no existe, ábrelo en borrador con `gh pr create --draft --base main --head desarrollo`.
8. Di qué se hizo, qué chequeos pasaron con su resultado real y qué debe revisar el dueño del proyecto.

## Cierre del hito

Cuando la última tarea del hito está cerrada y `gh pr checks` muestra todo en verde:

1. Actualiza la descripción del PR con lo que trae el hito y la lista de qué probar en la URL desplegada, con los IDs de las pantallas del diseño.
2. Márcalo listo con `gh pr ready`.
3. No lo fusiones: lo fusiona la cuenta dueña del proyecto en Vercel, con "Create a merge commit".
