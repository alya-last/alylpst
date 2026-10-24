-- Panel "Her şeyi imha et" işlevi: public ve private şemalarını TAMAMEN siler (tablolar, veriler, fonksiyonlar,
-- güvenlik kuralları, tetikleyiciler, görünümler) ve boş bir public şeması bırakır.
-- Yalnızca service_role çağırabilir; panel tarafında tam yetki + "imha et" onayı gerekir.
create or replace function public.imha_verileri()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  select count(*) into n
  from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind in ('r', 'p');

  drop schema if exists private cascade;
  drop schema if exists public cascade;
  create schema public;
  grant usage on schema public to postgres, anon, authenticated, service_role;
  grant all on schema public to postgres, service_role;
  alter default privileges in schema public grant all on tables to postgres, service_role;
  alter default privileges in schema public grant all on functions to postgres, service_role;
  alter default privileges in schema public grant all on sequences to postgres, service_role;
  return n;
end;
$$;

revoke all on function public.imha_verileri() from public, anon, authenticated;
grant execute on function public.imha_verileri() to service_role;
