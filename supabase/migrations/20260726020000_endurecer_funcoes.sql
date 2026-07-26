-- Endurecimento das funções expostas no schema public.
-- Funções de gatilho não precisam ser chamadas pelo cliente via RPC.

create or replace function public.atualizar_modificado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modificado_em = timezone('utc', now());
  return new;
end;
$$;

-- Esta função é executada somente pelo trigger de auth.users. Mantê-la como
-- SECURITY DEFINER é necessário para inserir o perfil durante o cadastro,
-- mas ela não deve ser invocável pela API REST por anon ou authenticated.
create or replace function public.criar_perfil_para_usuario()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.perfis (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.criar_perfil_para_usuario() from public, anon, authenticated;

-- A função rls_auto_enable não faz parte do aplicativo. Caso exista no
-- projeto, impede que ela seja invocada por RPC sem administração.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
