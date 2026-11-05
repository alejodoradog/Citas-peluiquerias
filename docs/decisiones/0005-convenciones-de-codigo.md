# 0005 Convenciones de código

Fecha: 2026-11-04 · Tarea: 1.7 · Estado: aceptada por el dueño del proyecto.

## Contexto

Al cerrar la fase 1, la revisión de arquitectura (Arxitect) encontró desorden que era barato arreglar antes de la fase 2: cada formulario repetía su código, dos módulos dependían uno del otro y no había una regla de dónde van las consultas. La fase 2 agrega unos 10 formularios y pantallas de guardar y editar, así que estas reglas se fijan ahora.

## Capas y dependencias

1. **`src/lib`** es la base estable: clientes de Supabase, fechas, validación, formularios, rutas. **Nunca importa de `src/modulos`.**
2. **`src/modulos/<módulo>`** tiene tres capas:
   - `dominio/`: reglas puras, sin base de datos, con pruebas.
   - `datos/`: consultas a Supabase. Cada función recibe el cliente o lo crea, y nombra las columnas que lee (nunca `select *`; ver decisión 0002, punto 2).
   - `acciones/`: Server Actions. Solo coordinan: validan, comprueban el acceso, llaman a `datos` y traducen errores. No arman consultas.
3. **Los módulos no dependen de las acciones de otros módulos.** Lo que se comparte va a `src/lib`. Por ejemplo, el correo, la contraseña y los errores de Supabase Auth, que usan tanto `barberias` como `cuentas`.
4. **`src/ui`** son componentes visuales y textos. **`src/app`** son las pantallas, que usan los módulos y `src/ui`.
5. **Guardas de ruta.** `cuentas/guards.ts` decide quién entra a cada pantalla (`requireOwner`, `requireSuperAdmin`) a partir de `cuentas/datos/access.ts`. El acceso del dueño trae el `id` de su barbería, que la fase 2 necesita para guardar.

## Formularios

6. **Un solo `FormState`** (`src/lib/formularios/form-state.ts`) con cuatro estados: `idle`, `invalid` (errores por campo y lo que se escribió), `failed` (un error general) y `done` (con un aviso opcional).
7. **`readForm`** lee los campos, valida y devuelve lo escrito para mostrarlo otra vez, **excepto los campos secretos**, como las contraseñas, que nunca vuelven al navegador.
8. **En la pantalla**, `useFormAction(action, mensajes)` entrega `fieldError(campo)`, `formError`, `value(campo)` y `notice`, con los nombres de campo tipados. `<ActionForm>` dibuja el formulario y pone el foco en el primer campo con error.
9. **Errores por código.** Los esquemas usan códigos como mensaje (`phone_invalid`). `parseWith` usa la ruta completa del campo (`hours.3.start`) y convierte en `invalid` cualquier mensaje que no sea un código, para que nunca llegue a la pantalla un texto de Zod en inglés.
10. **Los textos de error viven con su módulo** en `src/ui/textos.ts`: `textos.<módulo>.errores`, con las claves iguales a los códigos, más `invalid`. TypeScript comprueba que cada código tenga su texto (`satisfies`).

## Acciones

11. **Un archivo por entidad:** `cuentas/acciones/account.ts`, `barberias/acciones/barbershops.ts` y, en la fase 2, por ejemplo `servicios/acciones/services.ts`.
12. **Nombres verbo + entidad:** `createService`, `updateService`, `deactivateService`.
13. **Firma de las acciones de formulario:** `(estadoAnterior, formData) → FormState`. Las acciones que siempre redirigen (`signOut`, `confirmPasswordRecovery`, `confirmEmailAddress`) reciben solo los datos y no devuelven nada.
14. **Los campos de formulario van en camelCase** (`tokenHash`, `ownerName`).

## Rutas y reglas duplicadas

15. **Rutas en `src/lib/routes.ts`.** El código no escribe rutas a mano. El `matcher` de `src/proxy.ts` debe ser literal (lo exige Next), así que las repite.
16. **Toda regla que vive en SQL y en TypeScript tiene una prueba que compara las dos copias:**
    - links reservados (`RESERVED_SLUGS`) frente al check de la base de datos;
    - toda carpeta de primer nivel de `src/app` frente a los links reservados;
    - días de la prueba gratis (`TRIAL_DAYS`) frente al trigger de registro.
17. **`barbershop_id` por defecto:** en las tablas que escribe el dueño, la base de datos usa la barbería de la sesión si la pantalla no la envía. Es una red de seguridad: la app la sigue enviando y RLS la sigue comprobando.
18. **Fechas de calendario** (`2026-11-24`, en hora de Colombia) usan el tipo `BogotaDate` de `src/lib/fechas`.
