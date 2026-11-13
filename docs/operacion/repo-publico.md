# Repo público: revisión y ajustes

El repo `alejodoradog/Citas-peluiquerias` pasa a público (decisión del fundador y su socio, 2026-11-12). Así GitHub Actions no gasta minutos y Vercel despliega los commits de los dos. Este documento dice qué se revisó y qué hay que configurar en GitHub.

## Revisión de secretos (2026-11-12)
Se revisó todo lo que GitHub haría público: las 211 confirmaciones de todas las ramas y las de los 49 PR (`refs/pull/*`), incluidas ramas ya borradas.

**No hay ninguna clave ni contraseña real.** Se buscaron:
- llaves de AWS, GitHub, Supabase (`sb_secret_`, `sb_publishable_`, JWT), Stripe, Google y Slack;
- llaves privadas y cadenas de conexión de Postgres;
- el identificador del proyecto `barberias-dev`;
- archivos `.env`, `.pem` y `.key`, copias de la base y datos de prospectos (`gtm/`).

Lo que aparece y no es un riesgo:
- **Site Key de Turnstile** (`0x4AAAAAAF9s1ghuLnsBHG-O`): es pública por diseño, porque va en la página.
- **Llaves de prueba de Cloudflare** (`1x0000…`): públicas, de la documentación de Cloudflare.
- **Contraseñas de prueba** (`barberia-local-1`, `clave-segura-1`): solo sirven para la base local y la del CI.
- **Un ejemplo de cadena de conexión** con `TU_REF` y `[YOUR-PASSWORD]`.
- **Teléfonos**: todos inventados (`+573001112233`, …).

Lo que queda visible y conviene saber:
- **Los correos de los autores de los commits.** Para que los commits nuevos no muestren el correo, cada uno puede activar en GitHub, en Settings → Emails, "Keep my email addresses private" y "Block command line pushes that expose my email". Los commits viejos los conservan.
- **Los correos de las cuentas de prueba de `barberias-dev`** (`yapoin927@gmail.com` y `admin-prueba@yapoin.com`), sin contraseña. Esas cuentas deben tener contraseñas largas y únicas, sobre todo la de super admin.
- **Commits firmados por Claude o con "Co-Authored-By: Claude"** de las primeras tareas (17 y 33). No es un riesgo. Borrarlos exigiría reescribir el historial, y GitHub igual los conserva en los PR cerrados.
- **La spec, el plan, las decisiones y los diseños** (`docs/`): el producto queda a la vista. Los datos de prospectos y la capa personal del fundador nunca entraron al repo.

## Workflows
- **`ci.yml`**, en cada PR:
  - permisos de solo lectura;
  - sin secretos;
  - los PR de un fork corren sin secretos y sin escribir el caché de `main`.
- **`migrate-dev.yml` y `browser-packages.yml`:** solo corren en `main`, a mano o programados, nunca con código de un PR.
- **`auto-approve.yml`:**
  - nunca hace checkout del código de un PR;
  - solo fusiona PR de `manuel-alejandro429`, listos y con el CI en verde;
  - pasa el nombre de la rama por una variable de entorno, no dentro del script, así que no se puede inyectar;
  - desde este cambio, además, exige que el PR y su CI vengan de este mismo repositorio, nunca de un fork.

## Lo que configura el dueño del repo en GitHub
1. **Antes de hacerlo público:** fusionar el PR de este documento, que trae el endurecimiento de `auto-approve.yml`.
2. **Settings → Actions → General:**
   - "Fork pull request workflows from outside collaborators": **Require approval for all external contributors**, para que nadie de afuera use los runners sin permiso;
   - "Workflow permissions": **Read repository contents** (ya está así en cada workflow).
3. **Settings → Code security:** activar **Secret scanning** y **Push protection**, que son gratis en repos públicos, para que GitHub bloquee un push con una clave. Activar también **Dependabot alerts**.
4. **Settings → Branches → `main`:**
   - exigir PR;
   - exigir los checks `checks`, `database` y `e2e`;
   - no permitir force push ni borrar la rama.
5. **El secreto `MERGE_TOKEN`:** debe ser un token *fine-grained* solo de este repo, con Contents y Pull requests de escritura. Si es un token clásico con acceso a todo, conviene cambiarlo.
6. **Settings → General → Danger Zone → Change visibility → Public.**
