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
