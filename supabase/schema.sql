-- =====================================================================
-- schema.sql — banco completo do sistema de agendamento (para colar no
-- SQL Editor do Supabase de uma vez). É a concatenação, em ordem, das
-- migrations 0001 a 0005. Rode em um projeto NOVO (não é idempotente).
-- Depois rode seed.sql. Testes opcionais: tests/testes.sql
-- =====================================================================


-- >>>>>>>>>> 0001_tabelas.sql <<<<<<<<<<

-- =====================================================================
-- 0001_tabelas.sql
-- Tabelas do sistema de agendamento (base: SQL da proposta, Seção 6)
-- Acrescenta: perfis.usuario, perfis.avatar_url, agendamentos.titulo,
-- servicos_favoritos, configuracoes e agendamento avulso (cliente sem conta).
-- Fuso de referência de todo o sistema: America/Sao_Paulo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- perfis: dados do usuário além do login (liga com auth.users)
-- ---------------------------------------------------------------------
create table public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null default '' check (char_length(nome) <= 80),
  -- Login por "usuário": sempre minúsculo (normalizado por trigger) e único.
  usuario     text not null unique
              check (usuario ~ '^[a-z0-9._]{3,20}$'),
  telefone    text check (telefone is null or char_length(telefone) <= 20),
  avatar_url  text,
  papel       text not null default 'cliente' check (papel in ('cliente', 'admin')),
  criado_em   timestamptz not null default now()
);

comment on table public.perfis is
  'Dados do usuário além do login. O papel só pode ser alterado por admin (trigger) ou pelo SQL Editor/service_role.';

-- ---------------------------------------------------------------------
-- servicos: catálogo da loja
-- Serviços não são apagados (agendamentos antigos dependem deles): só desativados.
-- ---------------------------------------------------------------------
create table public.servicos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null check (char_length(trim(nome)) between 1 and 60),
  descricao    text,
  preco        numeric(10,2) not null check (preco >= 0),
  duracao_min  int not null check (duracao_min > 0 and duracao_min <= 480),
  ativo        boolean not null default true,
  foto_url     text,
  criado_em    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- horarios_funcionamento: quando a loja atende
-- Aceita mais de uma faixa por dia (ex.: 09-12 e 13-18 = intervalo de almoço).
-- ---------------------------------------------------------------------
create table public.horarios_funcionamento (
  id          uuid primary key default gen_random_uuid(),
  dia_semana  int not null check (dia_semana between 0 and 6), -- 0 = domingo
  abre        time not null,
  fecha       time not null,
  constraint horario_valido check (fecha > abre)
);

create index horarios_funcionamento_dia_idx on public.horarios_funcionamento (dia_semana);

-- ---------------------------------------------------------------------
-- bloqueios: períodos indisponíveis (feriado, folga, imprevisto)
-- ---------------------------------------------------------------------
create table public.bloqueios (
  id         uuid primary key default gen_random_uuid(),
  inicio     timestamptz not null,
  fim        timestamptz not null,
  motivo     text,
  criado_em  timestamptz not null default now(),
  constraint bloqueio_valido check (fim > inicio)
);

create index bloqueios_periodo_idx on public.bloqueios using gist (tstzrange(inicio, fim));

-- ---------------------------------------------------------------------
-- configuracoes: linha única com as regras de negócio ajustáveis
-- ---------------------------------------------------------------------
create table public.configuracoes (
  id                          int primary key default 1 check (id = 1),
  antecedencia_min_minutos    int not null default 120 check (antecedencia_min_minutos >= 0),
  prazo_cancelamento_horas    int not null default 24  check (prazo_cancelamento_horas >= 0),
  intervalo_min               int not null default 30  check (intervalo_min between 5 and 120)
);

comment on table public.configuracoes is
  'Linha única (id = 1): antecedência mínima para agendar, prazo para cancelar/remarcar e intervalo entre horários.';

insert into public.configuracoes (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- agendamentos: reservas feitas
-- cliente_id é opcional para permitir agendamento manual de quem chamou no
-- WhatsApp e não tem conta (nome/telefone avulsos).
-- Clientes NÃO escrevem aqui direto: usam as RPCs da migration 0003.
-- ---------------------------------------------------------------------
create table public.agendamentos (
  id                       uuid primary key default gen_random_uuid(),
  cliente_id               uuid references public.perfis(id) on delete cascade,
  cliente_nome_avulso      text check (cliente_nome_avulso is null or char_length(cliente_nome_avulso) <= 80),
  cliente_telefone_avulso  text check (cliente_telefone_avulso is null or char_length(cliente_telefone_avulso) <= 20),
  servico_id               uuid not null references public.servicos(id),
  titulo                   text check (titulo is null or char_length(titulo) <= 60),
  inicio                   timestamptz not null,
  fim                      timestamptz not null,
  status                   text not null default 'confirmado'
                           check (status in ('pendente', 'confirmado', 'cancelado', 'concluido')),
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now(),
  cancelado_em             timestamptz,
  cancelado_por            uuid references public.perfis(id) on delete set null,

  constraint agendamento_valido check (fim > inicio),
  constraint cliente_identificado check (
    cliente_id is not null or nullif(trim(coalesce(cliente_nome_avulso, '')), '') is not null
  ),

  -- Proteção FINAL contra conflito: o próprio banco recusa dois agendamentos
  -- ativos com horários sobrepostos (vale mesmo com cliques simultâneos).
  --
  -- COMO EVOLUIR PARA VÁRIOS PROFISSIONAIS (fase 2):
  --   create extension if not exists btree_gist;
  --   -- 1) criar a tabela profissionais (id, nome, ativo) e adicionar
  --   --    profissional_id em agendamentos, horarios_funcionamento e bloqueios;
  --   -- 2) trocar a constraint:
  --   --    alter table agendamentos drop constraint sem_conflito;
  --   --    alter table agendamentos add constraint sem_conflito
  --   --      exclude using gist (profissional_id with =, tstzrange(inicio, fim) with &&)
  --   --      where (status <> 'cancelado');
  --   -- 3) incluir p_profissional nas funções horarios_disponiveis e nas RPCs.
  constraint sem_conflito
    exclude using gist (tstzrange(inicio, fim) with &&)
    where (status <> 'cancelado')
);

create index agendamentos_cliente_inicio_idx on public.agendamentos (cliente_id, inicio);
create index agendamentos_inicio_idx on public.agendamentos (inicio);

-- ---------------------------------------------------------------------
-- servicos_favoritos: atalhos do perfil (chave composta)
-- ---------------------------------------------------------------------
create table public.servicos_favoritos (
  perfil_id   uuid not null references public.perfis(id) on delete cascade,
  servico_id  uuid not null references public.servicos(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (perfil_id, servico_id)
);


-- >>>>>>>>>> 0002_funcoes_e_triggers.sql <<<<<<<<<<

-- =====================================================================
-- 0002_funcoes_e_triggers.sql
-- Funções auxiliares e triggers.
-- Todas as funções security definer têm search_path fixo.
-- Os GRANT/REVOKE de execução ficam na migration 0004.
-- =====================================================================

-- ---------------------------------------------------------------------
-- is_admin(): o usuário logado é administrador?
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and papel = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- Normalização de perfis: usuário sempre minúsculo, textos sem espaços nas pontas.
-- ---------------------------------------------------------------------
create or replace function public.perfis_normaliza()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.usuario  := lower(trim(new.usuario));
  new.nome     := trim(coalesce(new.nome, ''));
  new.telefone := nullif(trim(coalesce(new.telefone, '')), '');
  return new;
end;
$$;

create trigger perfis_normaliza
before insert or update on public.perfis
for each row execute function public.perfis_normaliza();

-- ---------------------------------------------------------------------
-- Proteção contra escalada de privilégio:
-- a usuária NÃO altera o próprio papel (nem o id). Só admin altera papel.
--
-- A função é SECURITY INVOKER de propósito: current_user é o papel real da
-- sessão. Quem chega pela API (anon/authenticated) precisa ser admin;
-- SQL Editor (postgres) e service_role são confiáveis.
-- ---------------------------------------------------------------------
create or replace function public.perfis_protege_campos()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'campo_protegido' using errcode = 'AG013';
  end if;

  if new.papel is distinct from old.papel then
    if current_user in ('anon', 'authenticated') and not public.is_admin() then
      raise exception 'papel_protegido' using errcode = 'AG013';
    end if;
  end if;

  return new;
end;
$$;

create trigger perfis_protege_campos
before update on public.perfis
for each row execute function public.perfis_protege_campos();

-- ---------------------------------------------------------------------
-- handle_new_user: cria o perfil quando alguém se cadastra no Supabase Auth.
-- Lê nome, usuario e telefone dos metadados do cadastro
-- (auth.signUp({ options: { data: { nome, usuario, telefone } } })).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario text;
begin
  v_usuario := lower(trim(coalesce(new.raw_user_meta_data->>'usuario', '')));

  if v_usuario = '' then
    -- Usuário criado fora do app (ex.: painel do Supabase): usuário provisório.
    v_usuario := 'u' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into public.perfis (id, nome, usuario, telefone)
  values (
    new.id,
    left(trim(coalesce(new.raw_user_meta_data->>'nome', '')), 80),
    v_usuario,
    left(nullif(trim(coalesce(new.raw_user_meta_data->>'telefone', '')), ''), 20)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- define_fim: o fim do atendimento é calculado no servidor a partir da
-- duração do serviço (nunca vem da tela). Recalcula só quando início ou
-- serviço mudam, para não alterar agendamentos antigos se a duração mudar.
-- ---------------------------------------------------------------------
create or replace function public.define_fim()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  select new.inicio + make_interval(mins => s.duracao_min)
    into new.fim
    from public.servicos s
   where s.id = new.servico_id;
  return new;
end;
$$;

create trigger trg_define_fim
before insert or update of inicio, servico_id on public.agendamentos
for each row execute function public.define_fim();

-- ---------------------------------------------------------------------
-- usuario_disponivel: usada só pelo servidor (service_role) no cadastro.
-- ---------------------------------------------------------------------
create or replace function public.usuario_disponivel(p_usuario text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.perfis where usuario = lower(trim(p_usuario))
  );
$$;


-- >>>>>>>>>> 0003_rpcs_agendamento.sql <<<<<<<<<<

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


-- >>>>>>>>>> 0004_rls_e_grants.sql <<<<<<<<<<

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


-- >>>>>>>>>> 0005_storage.sql <<<<<<<<<<

-- =====================================================================
-- 0005_storage.sql
-- Storage: fotos dos serviços (escrita só admin) e avatares das usuárias
-- (cada uma escreve só na própria pasta: avatares/<id_da_usuaria>/arquivo).
-- Os buckets são públicos para leitura (URL pública), mas só quem tem
-- política consegue enviar, trocar ou apagar arquivos.
-- Limite de 2 MB por arquivo e só JPEG, PNG ou WebP.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('servicos-fotos', 'servicos-fotos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatares',       'avatares',       true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- servicos-fotos: só admin ----------------------------------------------
create policy "servicos-fotos: admin le"
  on storage.objects for select to authenticated
  using (bucket_id = 'servicos-fotos' and (select public.is_admin()));

create policy "servicos-fotos: admin envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'servicos-fotos' and (select public.is_admin()));

create policy "servicos-fotos: admin troca"
  on storage.objects for update to authenticated
  using (bucket_id = 'servicos-fotos' and (select public.is_admin()))
  with check (bucket_id = 'servicos-fotos' and (select public.is_admin()));

create policy "servicos-fotos: admin apaga"
  on storage.objects for delete to authenticated
  using (bucket_id = 'servicos-fotos' and (select public.is_admin()));

-- avatares: cada usuária na própria pasta -------------------------------
create policy "avatares: le o proprio"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatares'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: envia o proprio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: troca o proprio"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatares'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatares'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: apaga o proprio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatares'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

