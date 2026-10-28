-- =========================================================
-- security.sql — bloquear el acceso público a las tablas
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run
-- =========================================================
-- El servidor usa la clave service_role, que ignora RLS, así que la app sigue
-- funcionando. La clave anon (pública, visible en el navegador) ya no podrá
-- leer ni modificar ninguna de las dos tablas.

-- 1) Activar Row Level Security (sin políticas = nadie con anon/authenticated tiene acceso)
alter table public.grados enable row level security;
alter table public.users  enable row level security;

-- 2) Quitar permisos directos a los roles públicos (defensa adicional)
revoke all on table public.grados from anon, authenticated;
revoke all on table public.users  from anon, authenticated;

-- 3) Ya no se usa "postgres_changes" en el navegador; si la tabla estaba en la
--    publicación de Realtime se puede quitar (ignorar el error si no estaba).
-- alter publication supabase_realtime drop table public.grados;

-- Verificación: ambas filas deben mostrar rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('grados', 'users');
