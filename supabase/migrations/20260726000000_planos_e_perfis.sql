-- Base para os planos Gratuito e Plus. A cobrança ainda não é implementada:
-- toda pessoa começa no plano gratuito e somente uma automação segura poderá
-- conceder ou renovar o Plus no futuro.

create table public.planos (
  codigo text primary key check (codigo in ('gratuito', 'plus')),
  limite_alertas smallint not null check (limite_alertas > 0),
  tipos_alerta jsonb not null,
  lembretes_prazo boolean not null,
  exibir_anuncios boolean not null,
  criado_em timestamptz not null default timezone('utc', now()),
  modificado_em timestamptz not null default timezone('utc', now())
);

insert into public.planos (
  codigo,
  limite_alertas,
  tipos_alerta,
  lembretes_prazo,
  exibir_anuncios
)
values
  ('gratuito', 1, '["cidade"]'::jsonb, false, true),
  ('plus', 10, '["cidade", "uf", "raio", "nacional"]'::jsonb, true, false);

alter table public.perfis
  add column plano text not null default 'gratuito' references public.planos(codigo),
  add column plano_expira_em timestamptz,
  add column plano_atualizado_em timestamptz not null default timezone('utc', now());

-- Contas existentes podem ter sido criadas antes de haver o gatilho abaixo.
insert into public.perfis (id)
select id
from auth.users
on conflict (id) do nothing;

create or replace function public.criar_perfil_para_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfis (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists usuario_auth_criado on auth.users;

create trigger usuario_auth_criado
after insert on auth.users
for each row execute procedure public.criar_perfil_para_usuario();

create trigger planos_modificado_em
before update on public.planos
for each row execute function public.atualizar_modificado_em();

alter table public.planos enable row level security;

grant select on table public.planos to anon, authenticated;
grant select, insert, update, delete on table public.planos to service_role;

create policy "qualquer pessoa le os planos publicos"
on public.planos for select
using (true);

-- Perfil só pode ser consultado pela própria pessoa. O app não recebe permissão
-- para atualizar o plano: essa alteração será feita apenas por backend seguro
-- após validar uma assinatura do Google Play.
drop policy if exists "pessoa acessa o proprio perfil" on public.perfis;

create policy "pessoa le o proprio perfil"
on public.perfis for select
using (auth.uid() = id);

revoke insert, update, delete on table public.perfis from authenticated;
grant select on table public.perfis to authenticated;
