-- Dados pessoais do Mapa de Concursos. Os concursos públicos continuam em JSON;
-- este banco armazena somente preferências e eventos de cada pessoa usuária.

create extension if not exists pgcrypto;

create or replace function public.atualizar_modificado_em()
returns trigger
language plpgsql
as $$
begin
  new.modificado_em = timezone('utc', now());
  return new;
end;
$$;

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default timezone('utc', now()),
  modificado_em timestamptz not null default timezone('utc', now())
);

create table public.favoritos (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  concurso_id text not null,
  criado_em timestamptz not null default timezone('utc', now()),
  primary key (usuario_id, concurso_id)
);

create table public.pesquisas_salvas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  origem jsonb not null default '{}'::jsonb,
  filtros jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default timezone('utc', now()),
  modificado_em timestamptz not null default timezone('utc', now())
);

create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  criterios jsonb not null default '{}'::jsonb,
  frequencia text not null default 'diaria' check (frequencia in ('imediata', 'diaria', 'semanal')),
  ativo boolean not null default true,
  criado_em timestamptz not null default timezone('utc', now()),
  modificado_em timestamptz not null default timezone('utc', now())
);

create table public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  token_push text not null unique,
  plataforma text not null check (plataforma in ('android', 'ios', 'web')),
  ativo boolean not null default true,
  criado_em timestamptz not null default timezone('utc', now()),
  modificado_em timestamptz not null default timezone('utc', now())
);

create table public.envios_notificacao (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  concurso_id text,
  alerta_id uuid references public.alertas(id) on delete set null,
  tipo text not null check (tipo in ('novo_concurso', 'prazo_inscricao', 'alteracao_concurso')),
  enviado_em timestamptz not null default timezone('utc', now()),
  unique nulls not distinct (usuario_id, concurso_id, alerta_id, tipo)
);

create index favoritos_usuario_id_idx on public.favoritos(usuario_id);
create index pesquisas_salvas_usuario_id_idx on public.pesquisas_salvas(usuario_id);
create index alertas_usuario_id_idx on public.alertas(usuario_id);
create index dispositivos_usuario_id_idx on public.dispositivos(usuario_id);
create index envios_notificacao_usuario_id_idx on public.envios_notificacao(usuario_id);

create trigger perfis_modificado_em
before update on public.perfis
for each row execute function public.atualizar_modificado_em();

create trigger pesquisas_salvas_modificado_em
before update on public.pesquisas_salvas
for each row execute function public.atualizar_modificado_em();

create trigger alertas_modificado_em
before update on public.alertas
for each row execute function public.atualizar_modificado_em();

create trigger dispositivos_modificado_em
before update on public.dispositivos
for each row execute function public.atualizar_modificado_em();

alter table public.perfis enable row level security;
alter table public.favoritos enable row level security;
alter table public.pesquisas_salvas enable row level security;
alter table public.alertas enable row level security;
alter table public.dispositivos enable row level security;
alter table public.envios_notificacao enable row level security;

-- As tabelas não são expostas automaticamente pela Data API. Somente pessoas
-- autenticadas e automações seguras podem alcançá-las; o RLS decide quais linhas.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on table public.perfis to authenticated, service_role;
grant select, insert, update, delete on table public.favoritos to authenticated, service_role;
grant select, insert, update, delete on table public.pesquisas_salvas to authenticated, service_role;
grant select, insert, update, delete on table public.alertas to authenticated, service_role;
grant select, insert, update, delete on table public.dispositivos to authenticated, service_role;
grant select on table public.envios_notificacao to authenticated;
grant select, insert, update, delete on table public.envios_notificacao to service_role;

create policy "pessoa acessa o proprio perfil"
on public.perfis for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "pessoa gerencia os proprios favoritos"
on public.favoritos for all
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

create policy "pessoa gerencia as proprias pesquisas"
on public.pesquisas_salvas for all
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

create policy "pessoa gerencia os proprios alertas"
on public.alertas for all
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

create policy "pessoa gerencia os proprios dispositivos"
on public.dispositivos for all
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

create policy "pessoa le os proprios envios"
on public.envios_notificacao for select
using (auth.uid() = usuario_id);
