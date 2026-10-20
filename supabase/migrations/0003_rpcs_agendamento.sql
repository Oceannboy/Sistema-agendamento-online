-- =====================================================================
-- 0003_rpcs_agendamento.sql
-- Lógica central: horários disponíveis e RPCs de agendamento.
--
-- A cliente NÃO escreve direto em agendamentos. Ela chama:
--   criar_agendamento, remarcar_agendamento, cancelar_agendamento
-- Admin usa também: admin_criar_agendamento, alterar_status_agendamento.
--
-- CÓDIGOS DE ERRO (SQLSTATE próprio; a mensagem é um código curto que o
-- front traduz para PT-BR). O PostgREST devolve { code, message }.
--   AG001 horario_conflito         -> "Esse horário acabou de ser reservado, escolha outro"
--   AG002 fora_do_expediente
--   AG003 horario_bloqueado
--   AG004 horario_no_passado
--   AG005 servico_invalido
--   AG006 prazo_cancelamento
--   AG007 agendamento_nao_encontrado
--   AG008 agendamento_inativo
--   AG009 nao_autenticado
--   AG010 dados_invalidos / titulo_invalido / cliente_nao_informado / cliente_invalido
--   AG011 antecedencia_minima
--   AG012 sem_permissao
--   AG013 papel_protegido / campo_protegido (triggers de perfis)
--
-- Todas as funções são security definer com search_path fixo.
-- Execução liberada só a authenticated (ver 0004).
-- =====================================================================

-- ---------------------------------------------------------------------
-- horarios_disponiveis(p_data, p_servico, p_ignorar)
-- Devolve os inícios possíveis do dia (data no fuso America/Sao_Paulo).
--  * respeita faixas de funcionamento (várias por dia) e o intervalo configurado
--  * só cabe se o serviço termina antes de fechar
--  * descarta conflitos e bloqueios
--  * descarta o passado e, para cliente, a antecedência mínima
--  * p_ignorar: id do agendamento em edição (o próprio horário aparece livre)
-- security definer: precisa enxergar agendamentos de todos, mas só devolve
-- horários livres, sem expor dados de ninguém.
-- ---------------------------------------------------------------------
create or replace function public.horarios_disponiveis(
  p_data     date,
  p_servico  uuid,
  p_ignorar  uuid default null
)
returns table (inicio timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select c.intervalo_min,
           case when public.is_admin() then 0 else c.antecedencia_min_minutos end as antecedencia
      from public.configuracoes c
     where c.id = 1
  ),
  srv as (
    select s.duracao_min
      from public.servicos s
     where s.id = p_servico and s.ativo
  )
  select distinct g.ini
    from srv
   cross join cfg
    join public.horarios_funcionamento h
      on h.dia_semana = extract(dow from p_data)::int
   cross join lateral generate_series(
          ((p_data + h.abre)  at time zone 'America/Sao_Paulo'),
          ((p_data + h.fecha) at time zone 'America/Sao_Paulo') - make_interval(mins => srv.duracao_min),
          make_interval(mins => cfg.intervalo_min)
        ) as g(ini)
   where g.ini > now()
     and g.ini >= now() + make_interval(mins => cfg.antecedencia)
     and not exists (
           select 1 from public.agendamentos a
            where a.status <> 'cancelado'
              and a.id is distinct from p_ignorar
              and tstzrange(a.inicio, a.fim) &&
                  tstzrange(g.ini, g.ini + make_interval(mins => srv.duracao_min)))
     and not exists (
           select 1 from public.bloqueios b
            where tstzrange(b.inicio, b.fim) &&
                  tstzrange(g.ini, g.ini + make_interval(mins => srv.duracao_min)))
   order by g.ini;
$$;

-- ---------------------------------------------------------------------
-- dias_do_mes(p_ano, p_mes, p_servico, p_ignorar)
-- Uma chamada só para pintar o calendário do mês:
--   tem_agendamento = a usuária já tem agendamento ativo no dia (ponto vermelho)
--   sem_horario     = nenhum horário livre para o serviço (ponto cinza)
--   loja_fechada    = não há expediente nesse dia da semana
-- ---------------------------------------------------------------------
create or replace function public.dias_do_mes(
  p_ano      int,
  p_mes      int,
  p_servico  uuid,
  p_ignorar  uuid default null
)
returns table (dia date, tem_agendamento boolean, sem_horario boolean, loja_fechada boolean)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente   uuid := auth.uid();
  v_primeiro  date;
  v_dias      int;
begin
  if v_cliente is null then
    raise exception 'nao_autenticado' using errcode = 'AG009';
  end if;
  if p_mes not between 1 and 12 or p_ano not between 2000 and 2100 then
    raise exception 'dados_invalidos' using errcode = 'AG010';
  end if;

  v_primeiro := make_date(p_ano, p_mes, 1);
  v_dias := ((v_primeiro + interval '1 month')::date - v_primeiro);

  return query
  select (v_primeiro + g.i)::date,
         exists (
           select 1 from public.agendamentos a
            where a.cliente_id = v_cliente
              and a.status <> 'cancelado'
              and (a.inicio at time zone 'America/Sao_Paulo')::date = (v_primeiro + g.i)
         ),
         not exists (
           select 1 from public.horarios_disponiveis((v_primeiro + g.i), p_servico, p_ignorar)
         ),
         not exists (
           select 1 from public.horarios_funcionamento h
            where h.dia_semana = extract(dow from (v_primeiro + g.i))::int
         )
    from generate_series(0, v_dias - 1) as g(i);
end;
$$;

-- ---------------------------------------------------------------------
-- _ag_validar_janela: regras comuns a criar e remarcar (uso interno).
-- Ordem das checagens: passado, antecedência, expediente, bloqueio, conflito.
-- p_admin = true dispensa antecedência mínima e o alinhamento à grade de
-- horários (admin pode encaixar às 10:15), mas NÃO dispensa expediente,
-- bloqueio nem conflito.
-- ---------------------------------------------------------------------
create or replace function public._ag_validar_janela(
  p_inicio       timestamptz,
  p_duracao_min  int,
  p_ignorar      uuid,
  p_admin        boolean
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg        public.configuracoes%rowtype;
  v_fim        timestamptz := p_inicio + make_interval(mins => p_duracao_min);
  v_ini_local  timestamp   := p_inicio at time zone 'America/Sao_Paulo';
  v_fim_local  timestamp   := (p_inicio + make_interval(mins => p_duracao_min)) at time zone 'America/Sao_Paulo';
begin
  select * into v_cfg from public.configuracoes where id = 1;

  -- 1) no futuro e com a antecedência mínima
  if p_inicio <= now() then
    raise exception 'horario_no_passado' using errcode = 'AG004';
  end if;
  if not p_admin
     and p_inicio < now() + make_interval(mins => v_cfg.antecedencia_min_minutos) then
    raise exception 'antecedencia_minima' using errcode = 'AG011';
  end if;

  -- 2) dentro do horário de funcionamento (mesmo dia, cabe numa faixa e,
  --    para cliente, alinhado à grade do intervalo configurado)
  if v_fim_local::date <> v_ini_local::date
     or not exists (
       select 1 from public.horarios_funcionamento h
        where h.dia_semana = extract(dow from v_ini_local)::int
          and h.abre  <= v_ini_local::time
          and h.fecha >= v_fim_local::time
          and (p_admin
               or mod((extract(epoch from (v_ini_local::time - h.abre)) / 60)::int,
                      v_cfg.intervalo_min) = 0)
     ) then
    raise exception 'fora_do_expediente' using errcode = 'AG002';
  end if;

  -- 3) sem bloqueio
  if exists (
    select 1 from public.bloqueios b
     where tstzrange(b.inicio, b.fim) && tstzrange(p_inicio, v_fim)
  ) then
    raise exception 'horario_bloqueado' using errcode = 'AG003';
  end if;

  -- 4) sem conflito (a constraint sem_conflito continua como proteção final)
  if exists (
    select 1 from public.agendamentos a
     where a.status <> 'cancelado'
       and a.id is distinct from p_ignorar
       and tstzrange(a.inicio, a.fim) && tstzrange(p_inicio, v_fim)
  ) then
    raise exception 'horario_conflito' using errcode = 'AG001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- criar_agendamento(p_servico, p_inicio, p_titulo)
-- Cria um agendamento para a usuária logada. Fim e status são definidos aqui.
-- ---------------------------------------------------------------------
create or replace function public.criar_agendamento(
  p_servico  uuid,
  p_inicio   timestamptz,
  p_titulo   text default null
)
returns public.agendamentos
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_srv     public.servicos%rowtype;
  v_ini     timestamptz;
  v_titulo  text;
  v_ag      public.agendamentos%rowtype;
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = 'AG009';
  end if;
  if p_servico is null or p_inicio is null then
    raise exception 'dados_invalidos' using errcode = 'AG010';
  end if;

  select * into v_srv from public.servicos where id = p_servico and ativo;
  if not found then
    raise exception 'servico_invalido' using errcode = 'AG005';
  end if;

  v_titulo := nullif(trim(coalesce(p_titulo, '')), '');
  if char_length(coalesce(v_titulo, '')) > 60 then
    raise exception 'titulo_invalido' using errcode = 'AG010';
  end if;
  v_titulo := coalesce(v_titulo, v_srv.nome);

  v_ini := date_trunc('minute', p_inicio);
  perform public._ag_validar_janela(v_ini, v_srv.duracao_min, null, false);

  begin
    insert into public.agendamentos (cliente_id, servico_id, titulo, inicio, fim, status)
    values (v_uid, v_srv.id, v_titulo, v_ini,
            v_ini + make_interval(mins => v_srv.duracao_min), 'confirmado')
    returning * into v_ag;
  exception when exclusion_violation then
    -- duas pessoas clicaram ao mesmo tempo: a constraint barrou a segunda
    raise exception 'horario_conflito' using errcode = 'AG001';
  end;

  return v_ag;
end;
$$;

-- ---------------------------------------------------------------------
-- remarcar_agendamento(p_id, p_servico, p_inicio, p_titulo)
-- Dona do agendamento (ou admin). Cliente respeita o prazo de cancelamento.
-- p_servico null = mantém o serviço; p_titulo null = mantém o título
-- (texto vazio = usa o nome do serviço).
-- ---------------------------------------------------------------------
create or replace function public.remarcar_agendamento(
  p_id       uuid,
  p_servico  uuid,
  p_inicio   timestamptz,
  p_titulo   text default null
)
returns public.agendamentos
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_admin   boolean;
  v_cfg     public.configuracoes%rowtype;
  v_ag      public.agendamentos%rowtype;
  v_srv     public.servicos%rowtype;
  v_ini     timestamptz;
  v_titulo  text;
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = 'AG009';
  end if;
  if p_id is null or p_inicio is null then
    raise exception 'dados_invalidos' using errcode = 'AG010';
  end if;

  v_admin := public.is_admin();
  select * into v_cfg from public.configuracoes where id = 1;

  select * into v_ag from public.agendamentos where id = p_id for update;
  if not found or (v_ag.cliente_id is distinct from v_uid and not v_admin) then
    raise exception 'agendamento_nao_encontrado' using errcode = 'AG007';
  end if;
  if v_ag.status not in ('pendente', 'confirmado') or v_ag.inicio <= now() then
    raise exception 'agendamento_inativo' using errcode = 'AG008';
  end if;
  if not v_admin
     and v_ag.inicio < now() + make_interval(hours => v_cfg.prazo_cancelamento_horas) then
    raise exception 'prazo_cancelamento' using errcode = 'AG006';
  end if;

  select * into v_srv from public.servicos where id = coalesce(p_servico, v_ag.servico_id);
  if not found or (not v_srv.ativo and v_srv.id <> v_ag.servico_id) then
    raise exception 'servico_invalido' using errcode = 'AG005';
  end if;

  if p_titulo is null then
    v_titulo := v_ag.titulo;
  else
    v_titulo := nullif(trim(p_titulo), '');
    if char_length(coalesce(v_titulo, '')) > 60 then
      raise exception 'titulo_invalido' using errcode = 'AG010';
    end if;
    v_titulo := coalesce(v_titulo, v_srv.nome);
  end if;

  v_ini := date_trunc('minute', p_inicio);
  perform public._ag_validar_janela(v_ini, v_srv.duracao_min, v_ag.id, v_admin);

  begin
    update public.agendamentos
       set servico_id    = v_srv.id,
           titulo        = v_titulo,
           inicio        = v_ini,
           fim           = v_ini + make_interval(mins => v_srv.duracao_min),
           atualizado_em = now()
     where id = v_ag.id
    returning * into v_ag;
  exception when exclusion_violation then
    raise exception 'horario_conflito' using errcode = 'AG001';
  end;

  return v_ag;
end;
$$;

-- ---------------------------------------------------------------------
-- cancelar_agendamento(p_id)
-- Dona do agendamento (ou admin). Cliente só cancela dentro do prazo.
-- ---------------------------------------------------------------------
create or replace function public.cancelar_agendamento(p_id uuid)
returns public.agendamentos
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_admin  boolean;
  v_cfg    public.configuracoes%rowtype;
  v_ag     public.agendamentos%rowtype;
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = 'AG009';
  end if;
  if p_id is null then
    raise exception 'dados_invalidos' using errcode = 'AG010';
  end if;

  v_admin := public.is_admin();
  select * into v_cfg from public.configuracoes where id = 1;

  select * into v_ag from public.agendamentos where id = p_id for update;
  if not found or (v_ag.cliente_id is distinct from v_uid and not v_admin) then
    raise exception 'agendamento_nao_encontrado' using errcode = 'AG007';
  end if;
  if v_ag.status not in ('pendente', 'confirmado') then
    raise exception 'agendamento_inativo' using errcode = 'AG008';
  end if;
  if not v_admin
     and v_ag.inicio < now() + make_interval(hours => v_cfg.prazo_cancelamento_horas) then
    raise exception 'prazo_cancelamento' using errcode = 'AG006';
  end if;

  update public.agendamentos
     set status        = 'cancelado',
         cancelado_em  = now(),
         cancelado_por = v_uid,
         atualizado_em = now()
   where id = v_ag.id
  returning * into v_ag;

  return v_ag;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_criar_agendamento: a dona marca para quem chamou no WhatsApp.
-- Informe p_cliente (cliente com conta) OU p_nome_avulso (+ telefone).
-- Dispensa antecedência mínima e grade de horários; respeita expediente,
-- bloqueios e conflitos.
-- ---------------------------------------------------------------------
create or replace function public.admin_criar_agendamento(
  p_servico          uuid,
  p_inicio           timestamptz,
  p_titulo           text default null,
  p_cliente          uuid default null,
  p_nome_avulso      text default null,
  p_telefone_avulso  text default null
)
returns public.agendamentos
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_srv     public.servicos%rowtype;
  v_ini     timestamptz;
  v_titulo  text;
  v_nome    text := nullif(trim(coalesce(p_nome_avulso, '')), '');
  v_tel     text := nullif(trim(coalesce(p_telefone_avulso, '')), '');
  v_ag      public.agendamentos%rowtype;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = 'AG009';
  end if;
  if not public.is_admin() then
    raise exception 'sem_permissao' using errcode = 'AG012';
  end if;
  if p_servico is null or p_inicio is null then
    raise exception 'dados_invalidos' using errcode = 'AG010';
  end if;

  select * into v_srv from public.servicos where id = p_servico and ativo;
  if not found then
    raise exception 'servico_invalido' using errcode = 'AG005';
  end if;

  if p_cliente is not null then
    if not exists (select 1 from public.perfis where id = p_cliente) then
      raise exception 'cliente_invalido' using errcode = 'AG010';
    end if;
    v_nome := null;
    v_tel  := null;
  elsif v_nome is null then
    raise exception 'cliente_nao_informado' using errcode = 'AG010';
  elsif char_length(v_nome) > 80 or char_length(coalesce(v_tel, '')) > 20 then
    raise exception 'dados_invalidos' using errcode = 'AG010';
  end if;

  v_titulo := nullif(trim(coalesce(p_titulo, '')), '');
  if char_length(coalesce(v_titulo, '')) > 60 then
    raise exception 'titulo_invalido' using errcode = 'AG010';
  end if;
  v_titulo := coalesce(v_titulo, v_srv.nome);

  v_ini := date_trunc('minute', p_inicio);
  perform public._ag_validar_janela(v_ini, v_srv.duracao_min, null, true);

  begin
    insert into public.agendamentos (
      cliente_id, cliente_nome_avulso, cliente_telefone_avulso,
      servico_id, titulo, inicio, fim, status
    )
    values (
      p_cliente, v_nome, v_tel,
      v_srv.id, v_titulo, v_ini,
      v_ini + make_interval(mins => v_srv.duracao_min), 'confirmado'
    )
    returning * into v_ag;
  exception when exclusion_violation then
    raise exception 'horario_conflito' using errcode = 'AG001';
  end;

  return v_ag;
end;
$$;

-- ---------------------------------------------------------------------
-- alterar_status_agendamento: admin confirma, conclui, cancela ou reabre.
-- ---------------------------------------------------------------------
create or replace function public.alterar_status_agendamento(
  p_id      uuid,
  p_status  text
)
returns public.agendamentos
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_ag   public.agendamentos%rowtype;
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = 'AG009';
  end if;
  if not public.is_admin() then
    raise exception 'sem_permissao' using errcode = 'AG012';
  end if;
  if p_status is null or p_status not in ('pendente', 'confirmado', 'cancelado', 'concluido') then
    raise exception 'dados_invalidos' using errcode = 'AG010';
  end if;

  select * into v_ag from public.agendamentos where id = p_id for update;
  if not found then
    raise exception 'agendamento_nao_encontrado' using errcode = 'AG007';
  end if;

  begin
    update public.agendamentos
       set status        = p_status,
           cancelado_em  = case when p_status = 'cancelado' then coalesce(cancelado_em, now()) else null end,
           cancelado_por = case when p_status = 'cancelado' then coalesce(cancelado_por, v_uid) else null end,
           atualizado_em = now()
     where id = v_ag.id
    returning * into v_ag;
  exception when exclusion_violation then
    -- reabrir um agendamento cancelado cujo horário já foi ocupado
    raise exception 'horario_conflito' using errcode = 'AG001';
  end;

  return v_ag;
end;
$$;
