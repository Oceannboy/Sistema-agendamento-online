-- =====================================================================
-- 0004_rls_e_grants.sql
-- Segurança: RLS ativa em TODAS as tabelas, políticas para cliente e admin,
-- privilégios mínimos nas tabelas e controle de execução das funções.
--
-- Regras de escrita:
--  * agendamentos: nenhuma escrita direta pela API. Só pelas RPCs (0003).
--  * perfis: a usuária edita o próprio perfil; papel protegido por trigger.
--  * servicos / horarios_funcionamento / bloqueios / configuracoes:
--    escrita só admin. Leitura pública de serviços ativos e horários.
--
-- Atenção: toda função NOVA criada no futuro herda EXECUTE para public/anon
-- no Supabase. Sempre faça o revoke/grant explícito (veja o fim deste arquivo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) RLS em todas as tabelas
-- ---------------------------------------------------------------------
alter table public.perfis                  enable row level security;
alter table public.servicos                enable row level security;
alter table public.horarios_funcionamento  enable row level security;
alter table public.bloqueios               enable row level security;
alter table public.configuracoes           enable row level security;
alter table public.agendamentos            enable row level security;
alter table public.servicos_favoritos      enable row level security;

-- ---------------------------------------------------------------------
-- 2) Privilégios de tabela (o RLS filtra as linhas; isto limita os comandos)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- visitante (sem login): só vitrine
grant select on public.servicos, public.horarios_funcionamento to anon;

-- usuária logada
grant select, update                 on public.perfis                 to authenticated;
grant select, insert, update, delete on public.servicos               to authenticated; -- escrita: só admin (RLS)
grant select, insert, update, delete on public.horarios_funcionamento to authenticated; -- escrita: só admin (RLS)
grant select, insert, update, delete on public.bloqueios              to authenticated; -- só admin (RLS)
grant select, update                 on public.configuracoes          to authenticated; -- update: só admin (RLS)
grant select                         on public.agendamentos           to authenticated; -- escrita só via RPC
grant select, insert, delete         on public.servicos_favoritos     to authenticated;

-- ---------------------------------------------------------------------
-- 3) Políticas
-- (select ...) em volta de auth.uid() e is_admin() permite ao Postgres
-- avaliar uma vez por consulta, em vez de uma vez por linha.
-- ---------------------------------------------------------------------

-- perfis ---------------------------------------------------------------
create policy "perfis: le o proprio"
  on public.perfis for select to authenticated
  using (id = (select auth.uid()));

create policy "perfis: admin le todos"
  on public.perfis for select to authenticated
  using ((select public.is_admin()));            -- admin enxerga nome e telefone dos clientes

create policy "perfis: edita o proprio"
  on public.perfis for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));         -- o papel é protegido pelo trigger perfis_protege_campos

create policy "perfis: admin edita"
  on public.perfis for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
-- Sem política de INSERT/DELETE: o perfil nasce pelo trigger handle_new_user
-- e some junto com o usuário (on delete cascade).

-- servicos -------------------------------------------------------------
create policy "servicos: leitura publica dos ativos"
  on public.servicos for select to anon, authenticated
  using (ativo);

-- Mantém visível (para a própria cliente) um serviço desativado que ela já
-- agendou ou favoritou; senão o nome sumiria do histórico.
create policy "servicos: cliente ve os que ja usou"
  on public.servicos for select to authenticated
  using (
    exists (select 1 from public.agendamentos a
             where a.servico_id = servicos.id and a.cliente_id = (select auth.uid()))
    or exists (select 1 from public.servicos_favoritos f
                where f.servico_id = servicos.id and f.perfil_id = (select auth.uid()))
  );

create policy "servicos: admin escreve"
  on public.servicos for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- horarios_funcionamento -----------------------------------------------
create policy "horarios: leitura publica"
  on public.horarios_funcionamento for select to anon, authenticated
  using (true);

create policy "horarios: admin escreve"
  on public.horarios_funcionamento for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- bloqueios: somente admin ---------------------------------------------
create policy "bloqueios: admin tudo"
  on public.bloqueios for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- configuracoes --------------------------------------------------------
create policy "configuracoes: leitura para logados"
  on public.configuracoes for select to authenticated
  using (true);

create policy "configuracoes: admin altera"
  on public.configuracoes for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- agendamentos: só leitura (escrita pelas RPCs security definer) ---------
create policy "agend: cliente ve os seus"
  on public.agendamentos for select to authenticated
  using (cliente_id = (select auth.uid()));

create policy "agend: admin ve todos"
  on public.agendamentos for select to authenticated
  using ((select public.is_admin()));

-- servicos_favoritos ---------------------------------------------------
create policy "favoritos: ve os seus"
  on public.servicos_favoritos for select to authenticated
  using (perfil_id = (select auth.uid()));

create policy "favoritos: adiciona os seus"
  on public.servicos_favoritos for insert to authenticated
  with check (
    perfil_id = (select auth.uid())
    and exists (select 1 from public.servicos s where s.id = servico_id and s.ativo)
  );

create policy "favoritos: remove os seus"
  on public.servicos_favoritos for delete to authenticated
  using (perfil_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 4) Execução de funções: revoga de public/anon e concede só a quem precisa
-- ---------------------------------------------------------------------

-- Funções de trigger e internas: ninguém chama pela API.
revoke execute on function public.perfis_normaliza()      from public, anon, authenticated, service_role;
revoke execute on function public.perfis_protege_campos() from public, anon, authenticated, service_role;
revoke execute on function public.handle_new_user()       from public, anon, authenticated, service_role;
revoke execute on function public.define_fim()            from public, anon, authenticated, service_role;
revoke execute on function public._ag_validar_janela(timestamptz, int, uuid, boolean)
                                                           from public, anon, authenticated, service_role;

-- Usada só pelo servidor (Server Action de cadastro, com service_role).
revoke execute on function public.usuario_disponivel(text) from public, anon, authenticated;
grant  execute on function public.usuario_disponivel(text) to service_role;

-- is_admin() é usada pelas políticas RLS das usuárias logadas.
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated, service_role;

-- RPCs de agendamento: só usuária logada.
revoke execute on function public.horarios_disponiveis(date, uuid, uuid) from public, anon;
grant  execute on function public.horarios_disponiveis(date, uuid, uuid) to authenticated, service_role;

revoke execute on function public.dias_do_mes(int, int, uuid, uuid) from public, anon;
grant  execute on function public.dias_do_mes(int, int, uuid, uuid) to authenticated, service_role;

revoke execute on function public.criar_agendamento(uuid, timestamptz, text) from public, anon;
grant  execute on function public.criar_agendamento(uuid, timestamptz, text) to authenticated, service_role;

revoke execute on function public.remarcar_agendamento(uuid, uuid, timestamptz, text) from public, anon;
grant  execute on function public.remarcar_agendamento(uuid, uuid, timestamptz, text) to authenticated, service_role;

revoke execute on function public.cancelar_agendamento(uuid) from public, anon;
grant  execute on function public.cancelar_agendamento(uuid) to authenticated, service_role;

revoke execute on function public.admin_criar_agendamento(uuid, timestamptz, text, uuid, text, text) from public, anon;
grant  execute on function public.admin_criar_agendamento(uuid, timestamptz, text, uuid, text, text) to authenticated, service_role;

revoke execute on function public.alterar_status_agendamento(uuid, text) from public, anon;
grant  execute on function public.alterar_status_agendamento(uuid, text) to authenticated, service_role;
