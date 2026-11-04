# Crear un super admin

El super admin no se registra por la web: el registro siempre crea dueños. Se crea a mano, en dos pasos.

## En tu computador (Supabase local)

1. Con `pnpm supabase start` corriendo, abre Supabase Studio en `http://127.0.0.1:44323`.
2. En **Authentication → Users**, crea el usuario con su correo y una contraseña. No le pongas datos de barbería.
3. En **SQL Editor**, corre esto cambiando el correo y el nombre:

```sql
insert into public.profiles (id, role, full_name)
select id, 'super_admin', 'Tu nombre'
from auth.users
where email = 'tu-correo@ejemplo.com';
```

4. Entra por `/ingresar` con ese correo y contraseña. Llegas a `/admin`.

## En producción

Es el mismo procedimiento, en el proyecto `barberias-prod` de Supabase, y lo hace solo el dueño del proyecto. Claude Code no toca producción. Se hará en la tarea 6.4.

## Quitar el acceso

Para desactivar a un super admin sin borrar su historial (por ejemplo, los pagos que registró):

```sql
update public.profiles
set active = false
where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
```
