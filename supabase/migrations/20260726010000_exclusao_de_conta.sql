-- A exclusão precisa alcançar auth.users, que não pode ser alterada pelo
-- cliente diretamente. A função usa o usuário presente no JWT e não aceita
-- identificador como argumento, evitando que uma pessoa exclua outra conta.

create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória para excluir a conta.';
  end if;

  delete from auth.users
  where id = auth.uid();
end;
$$;

revoke execute on function public.excluir_minha_conta() from public;
grant execute on function public.excluir_minha_conta() to authenticated;
