-- Corrige a recursão infinita entre RLS de servicos e servicos_favoritos.
-- Aplicar em projetos que já executaram as migrations 0001–0006.

create or replace function public.servico_ativo(p_servico uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.servicos s
     where s.id = p_servico and s.ativo
  );
$$;

revoke execute on function public.servico_ativo(uuid) from public, anon, authenticated, service_role;
grant execute on function public.servico_ativo(uuid) to authenticated, service_role;

drop policy if exists "favoritos: adiciona os seus" on public.servicos_favoritos;
create policy "favoritos: adiciona os seus"
  on public.servicos_favoritos for insert to authenticated
  with check (
    perfil_id = (select auth.uid())
    and (select public.servico_ativo(servico_id))
  );
