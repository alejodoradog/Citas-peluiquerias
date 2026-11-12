---
name: revisar-avance
description: Revisa el estado del proyecto contra docs/plan.md y CLAUDE.md (ramas, PRs, casillas, reglas y código de lo que está en revisión) y dice si se puede seguir. Úsala antes de empezar una tarea nueva o cuando el dueño pida el estado.
---

# Revisar avance

Solo lectura: no edita, no hace commit y no fusiona. Primero los pasos baratos; los subagentes solo cuando hay código en revisión.

## 1. Foto del repositorio (barato)

1. Corre `git fetch origin --prune` y anota:
   - en qué rama estás y si hay cambios sin commit (`git status -sb`);
   - cada rama remota con `git rev-list --left-right --count origin/main...origin/<rama>`: cuántos commits lleva adelante de `main` y cuántos atrás.
2. Lista los PRs abiertos y los últimos fusionados con el MCP de GitHub (`list_pull_requests`). Si `gh` está instalado, `gh pr checks <n>` da el estado de CI. Si no, dilo: el dueño confirma los chequeos en GitHub.

## 2. Plan contra lo fusionado

1. Saca las casillas de `docs/plan.md` (`- [x]` y `- [ ]` con su número de tarea).
2. Compáralas con lo que ya está en `main` (`git log origin/main --oneline`, buscando "(tarea N.N)") y con la línea `Estado:` de cada archivo de `docs/tareas/`.
3. Señala:
   - tareas fusionadas con la casilla sin marcar;
   - casillas marcadas sin código ni prueba en `main`;
   - tareas cuyo `Estado:` dice algo distinto de lo que muestra Git;
   - decisiones marcadas como provisionales o abiertas que bloqueen la siguiente tarea.

## 3. Reglas de CLAUDE.md

Revisa solo lo que cambió desde el último hito fusionado (`git diff --name-only origin/main...<rama>` de cada PR abierto, o el último merge):

- forma de trabajo: ramas y PRs como dice CLAUDE.md; si la práctica real es distinta, repórtalo como discrepancia, sin corregirla;
- commits convencionales y sin coautoría ni marcas de Claude (`git log --format=%B`);
- migraciones nuevas: `barbershop_id`, RLS y prueba en `supabase/tests` (busca con Grep en los archivos cambiados);
- no revises los archivos de variables de entorno: el hook `guard.mjs` bloquea cualquier comando que los nombre, y `.gitignore` ya los excluye;
- textos de interfaz en `src/ui/textos.ts`, reglas de negocio en `src/modulos/*/dominio` con pruebas.

## 4. Código en revisión (solo si hay PRs abiertos o ramas adelante de main)

Para cada PR abierto, con su lista de archivos cambiados:

1. Pide a `revisor-spec` que compare contra `docs/spec.md`, `docs/plan.md` y el archivo de su tarea.
2. Si toca datos, permisos, links o entradas de usuario, pide lo mismo a `revisor-seguridad`.
3. Lanza los dos en paralelo y no repitas su trabajo.

Si el dueño pide ahorrar, salta este paso y dilo.

## 5. Informe

En español, corto:

1. **Veredicto:** se puede seguir con la siguiente tarea, o no, y por qué.
2. **Estado:** fase actual, tareas hechas, en revisión y pendientes.
3. **Bloqueos:** lo que debe resolverse antes de seguir, con quién lo hace (dueño o Claude Code).
4. **Discrepancias:** entre plan, tareas, Git y CLAUDE.md.
5. **Siguiente paso:** la tarea que sigue según el plan.

No afirmes que algo pasa (CI, pruebas) si no lo viste.
